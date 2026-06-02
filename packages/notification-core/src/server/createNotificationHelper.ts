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
/** Firestore hard limit on writes per batch. */
const MAX_BATCH_WRITES = 500;

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
 * await notifier.send({ type: 'content_report', actorId: '...', metadata: {...} });
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
    const { type, actorId, targetUserId, metadata } = input;
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

      // Cap actors (id-only — newest first, deduped)
      const newActorIds = [actorId, ...currentActorIds.filter((id: string) => id !== actorId)].slice(0, actorCap);

      const newCount = Math.min(currentCount + 1, countCap);

      await existingDoc.ref.update({
        count: newCount,
        latestActorIds: newActorIds,
        message: typeConfig.messagePattern(metadata, newCount),
        // New activity on an existing notification re-lights the unread badge.
        seenAt: 0,
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
        targetPath,
        metadata,
        // Active docs are created unseen so the unread count() predicate matches.
        seenAt: 0,
        createdAt: now,
        updatedAt: now,
      };

      await activeCollection.add(newDoc as Record<string, unknown>);
    }
  }

  async function queueForBatch(input: CreateNotificationInput): Promise<void> {
    const pendingDoc = buildPendingDoc(input, Date.now());
    await db.collection(pendingPath).add(pendingDoc as Record<string, unknown>);
  }

  function buildPendingDoc(
    input: CreateNotificationInput,
    now: number,
  ): Omit<import('../types.js').PendingNotification, 'id'> {
    const { type, actorId, targetUserId, metadata } = input;
    const { typeConfig } = getTypeConfig(type);
    // Pending docs carry NO seenAt — seenAt lives only on active docs, set by
    // the materializer (sendRealTime / processBatchHelper).
    return {
      type,
      category: typeConfig.category,
      targetUserId: targetUserId ?? null,
      actorId,
      metadata,
      createdAt: now,
    };
  }

  async function queueManyForBatch(inputs: CreateNotificationInput[]): Promise<void> {
    if (inputs.length === 0) return;

    const pendingCollection = db.collection(pendingPath);
    const now = Date.now();

    // Write in ≤500-write chunks (the Firestore batch limit).
    for (let i = 0; i < inputs.length; i += MAX_BATCH_WRITES) {
      const chunk = inputs.slice(i, i + MAX_BATCH_WRITES);
      const batch = db.batch();
      for (const input of chunk) {
        const ref = pendingCollection.doc();
        batch.set(ref, buildPendingDoc(input, now) as Record<string, unknown>);
      }
      await batch.commit();
    }
  }

  async function send(input: CreateNotificationInput): Promise<void> {
    const { typeConfig } = getTypeConfig(input.type);
    if (typeConfig.delivery === 'realtime') {
      return sendRealTime(input);
    }
    return queueForBatch(input);
  }

  return { send, sendRealTime, queueForBatch, queueManyForBatch };
}
