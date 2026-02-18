/**
 * Factory that creates the notification sending helper.
 * This is THE single entry point for all notification creation in any app.
 */

import type { NotificationSystemConfig } from '../types.js';
import type {
  ServerFirestore,
  CreateNotificationInput,
  NotificationHelper,
} from './types.js';

const DEFAULT_COUNT_CAP = 5000;
const DEFAULT_ACTOR_CAP = 5;

/**
 * Create a notification helper bound to a Firestore instance and config.
 *
 * @example
 * ```ts
 * // In your Cloud Function:
 * import admin from 'firebase-admin';
 * import { createNotificationHelper } from '@ttt-productions/notification-core/server';
 * import { TTT_NOTIFICATION_CONFIG } from './notification-config.js';
 *
 * const db = admin.firestore();
 * const notifier = createNotificationHelper(db as any, TTT_NOTIFICATION_CONFIG);
 *
 * // Auto-selects delivery mode based on type config:
 * await notifier.send({ type: 'content_report', actorId: '...', actorName: '...', metadata: {...} });
 * ```
 */
export function createNotificationHelper(
  db: ServerFirestore,
  config: NotificationSystemConfig,
): NotificationHelper {
  const pendingPath = config.pendingCollectionPath ?? 'pendingNotifications';

  function getTypeConfig(type: string) {
    const typeConfig = config.types[type];
    if (!typeConfig) {
      throw new Error(`[notification-core] Unknown notification type: ${type}`);
    }
    const categoryConfig = config.categories[typeConfig.category];
    if (!categoryConfig) {
      throw new Error(`[notification-core] Unknown category: ${typeConfig.category}`);
    }
    return { typeConfig, categoryConfig };
  }

  function resolveTargetPath(
    defaultPath: string | ((metadata: Record<string, unknown>) => string),
    metadata: Record<string, unknown>,
  ): string {
    return typeof defaultPath === 'function' ? defaultPath(metadata) : defaultPath;
  }

  async function sendRealTime(input: CreateNotificationInput): Promise<void> {
    const { type, actorId, actorName, targetUserId, metadata } = input;
    const { typeConfig, categoryConfig } = getTypeConfig(type);
    const activePath = categoryConfig.activePath;

    const dedupKey = typeConfig.dedupKeyPattern(metadata);
    const countCap = typeConfig.countCap ?? DEFAULT_COUNT_CAP;
    const actorCap = typeConfig.actorCap ?? DEFAULT_ACTOR_CAP;

    // Dedup check: query for existing doc with same dedupKey
    const activeCollection = db.collection(activePath);
    const existingQuery = activeCollection
      .where('dedupKey', '==', dedupKey)
      .where('category', '==', typeConfig.category)
      .limit(1);

    const existingSnap = await existingQuery.get();

    if (!existingSnap.empty) {
      // Increment existing notification
      const existingDoc = existingSnap.docs[0];
      const existingData = existingDoc.data() as Record<string, unknown>;
      const currentCount = (existingData.count as number) || 1;
      const currentActorIds = (existingData.latestActorIds as string[]) || [];
      const currentActorNames = (existingData.latestActorNames as string[]) || [];

      // Cap actors
      const newActorIds = [actorId, ...currentActorIds.filter((id: string) => id !== actorId)].slice(0, actorCap);
      const newActorNames = [actorName, ...currentActorNames.filter((_: string, i: number) => currentActorIds[i] !== actorId)].slice(0, actorCap);

      const newCount = Math.min(currentCount + 1, countCap);

      await existingDoc.ref.update({
        count: newCount,
        latestActorIds: newActorIds,
        latestActorNames: newActorNames,
        message: typeConfig.messagePattern(metadata, newCount),
        updatedAt: Date.now(),
      });
    } else {
      // Create new notification
      const targetPath = resolveTargetPath(typeConfig.defaultTargetPath, metadata);
      const now = Date.now();

      const newDoc: Omit<import('../types.js').NotificationDoc, 'id'> = {
        type,
        dedupKey,
        category: typeConfig.category,
        targetUserId: targetUserId ?? null,
        title: typeConfig.titlePattern(metadata),
        message: typeConfig.messagePattern(metadata, 1),
        count: 1,
        latestActorIds: [actorId],
        latestActorNames: [actorName],
        targetPath,
        metadata,
        createdAt: now,
        updatedAt: now,
      };

      await activeCollection.add(newDoc as Record<string, unknown>);
    }
  }

  async function queueForBatch(input: CreateNotificationInput): Promise<void> {
    const { type, actorId, actorName, targetUserId, metadata } = input;
    const { typeConfig } = getTypeConfig(type);

    const pendingDoc: Omit<import('../types.js').PendingNotification, 'id'> = {
      type,
      category: typeConfig.category,
      targetUserId: targetUserId ?? null,
      actorId,
      actorName,
      metadata,
      createdAt: Date.now(),
    };

    await db.collection(pendingPath).add(pendingDoc as Record<string, unknown>);
  }

  async function send(input: CreateNotificationInput): Promise<void> {
    const { typeConfig } = getTypeConfig(input.type);
    if (typeConfig.delivery === 'realtime') {
      return sendRealTime(input);
    }
    return queueForBatch(input);
  }

  return { send, sendRealTime, queueForBatch };
}
