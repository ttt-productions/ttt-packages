/**
 * Batch processor helper — called by the app's scheduled Cloud Function.
 * Reads pending notifications, groups by dedupKey, creates/increments active docs.
 */

import type { NotificationSystemConfig, PendingNotification } from '../types.js';
import type { ServerFirestore } from './types.js';

const DEFAULT_COUNT_CAP = 5000;
const DEFAULT_ACTOR_CAP = 5;
const PROCESSING_BATCH_SIZE = 500;
const MAX_ITERATIONS = 20;

interface BatchProcessResult {
  totalProcessed: number;
  notificationsCreated: number;
  notificationsUpdated: number;
}

/**
 * Process the pending notifications queue.
 *
 * @example
 * ```ts
 * // In your scheduled Cloud Function:
 * export const processNotificationBatch = onSchedule(
 *   { schedule: 'every 10 minutes' },
 *   async () => {
 *     const result = await processBatchHelper(db as any, TTT_NOTIFICATION_CONFIG);
 *     logger.info('Batch processed', result);
 *   }
 * );
 * ```
 */
export async function processBatchHelper(
  db: ServerFirestore,
  config: NotificationSystemConfig,
): Promise<BatchProcessResult> {
  const pendingPath = config.pendingCollectionPath ?? 'pendingNotifications';
  const cutoff = Date.now() - 30_000; // Process items older than 30 seconds

  let totalProcessed = 0;
  let notificationsCreated = 0;
  let notificationsUpdated = 0;
  let iterations = 0;
  let hasMore = true;

  while (hasMore && iterations < MAX_ITERATIONS) {
    iterations++;

    const pendingQuery = db.collection(pendingPath)
      .where('createdAt', '<=', cutoff)
      .orderBy('createdAt', 'asc')
      .limit(PROCESSING_BATCH_SIZE);

    const snapshot = await pendingQuery.get();

    if (snapshot.empty) {
      hasMore = false;
      break;
    }

    // Group by dedupKey
    const groups = new Map<string, {
      type: string;
      category: string;
      targetUserId: string | null;
      metadata: Record<string, unknown>;
      actors: { id: string; name: string }[];
      count: number;
      docs: typeof snapshot.docs;
    }>();

    for (const docSnap of snapshot.docs) {
      const data = docSnap.data() as Omit<PendingNotification, 'id'>;
      const typeConfig = config.types[data.type];
      if (!typeConfig) continue;

      const dedupKey = typeConfig.dedupKeyPattern(data.metadata);
      const groupKey = `${data.category}::${dedupKey}`;

      const existing = groups.get(groupKey);
      if (existing) {
        existing.count++;
        // Add actor if not already present
        if (!existing.actors.some((a) => a.id === data.actorId)) {
          existing.actors.push({ id: data.actorId, name: data.actorName });
        }
        existing.docs.push(docSnap);
      } else {
        groups.set(groupKey, {
          type: data.type,
          category: data.category,
          targetUserId: data.targetUserId,
          metadata: data.metadata,
          actors: [{ id: data.actorId, name: data.actorName }],
          count: 1,
          docs: [docSnap],
        });
      }
    }

    // Process each group: dedup check against active, create or increment
    for (const [, group] of groups) {
      const typeConfig = config.types[group.type];
      if (!typeConfig) continue;

      const categoryConfig = config.categories[group.category];
      if (!categoryConfig) continue;

      const activePath = categoryConfig.activePath;
      const dedupKey = typeConfig.dedupKeyPattern(group.metadata);
      const countCap = typeConfig.countCap ?? DEFAULT_COUNT_CAP;
      const actorCap = typeConfig.actorCap ?? DEFAULT_ACTOR_CAP;

      // Check for existing active notification
      const existingQuery = db.collection(activePath)
        .where('dedupKey', '==', dedupKey)
        .where('category', '==', group.category)
        .limit(1);

      const existingSnap = await existingQuery.get();

      if (!existingSnap.empty) {
        // Increment existing
        const existingDoc = existingSnap.docs[0];
        const existingData = existingDoc.data() as Record<string, unknown>;
        const currentCount = (existingData.count as number) || 1;
        const currentActorIds = (existingData.latestActorIds as string[]) || [];
        const currentActorNames = (existingData.latestActorNames as string[]) || [];

        // Merge actors (new first, deduped, capped)
        const newActors = group.actors.filter(
          (a) => !currentActorIds.includes(a.id)
        );
        const mergedActorIds = [
          ...newActors.map((a) => a.id),
          ...currentActorIds,
        ].slice(0, actorCap);
        const mergedActorNames = [
          ...newActors.map((a) => a.name),
          ...currentActorNames,
        ].slice(0, actorCap);

        const newCount = Math.min(currentCount + group.count, countCap);

        await existingDoc.ref.update({
          count: newCount,
          latestActorIds: mergedActorIds,
          latestActorNames: mergedActorNames,
          message: typeConfig.messagePattern(group.metadata, newCount),
          updatedAt: Date.now(),
        });

        notificationsUpdated++;
      } else {
        // Create new notification
        const targetPath = typeof typeConfig.defaultTargetPath === 'function'
          ? typeConfig.defaultTargetPath(group.metadata)
          : typeConfig.defaultTargetPath;
        const now = Date.now();

        const newDoc = {
          type: group.type,
          dedupKey,
          category: group.category,
          targetUserId: group.targetUserId,
          title: typeConfig.titlePattern(group.metadata),
          message: typeConfig.messagePattern(group.metadata, group.count),
          count: group.count,
          latestActorIds: group.actors.map((a) => a.id).slice(0, actorCap),
          latestActorNames: group.actors.map((a) => a.name).slice(0, actorCap),
          targetPath,
          metadata: group.metadata,
          createdAt: now,
          updatedAt: now,
        };

        await db.collection(activePath).add(newDoc);
        notificationsCreated++;
      }
    }

    // Delete processed pending docs in batches of 500
    const allDocs = snapshot.docs;
    for (let i = 0; i < allDocs.length; i += 500) {
      const chunk = allDocs.slice(i, i + 500);
      const batch = db.batch();
      chunk.forEach((docSnap) => batch.delete(docSnap.ref));
      await batch.commit();
    }

    totalProcessed += snapshot.size;

    if (snapshot.size < PROCESSING_BATCH_SIZE) {
      hasMore = false;
    }
  }

  return { totalProcessed, notificationsCreated, notificationsUpdated };
}
