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
      actorIds: string[];
      count: number;
      docs: typeof snapshot.docs;
    }>();

    for (const docSnap of snapshot.docs) {
      const data = docSnap.data() as Omit<PendingNotification, 'id'>;
      const typeConfig = config.types[data.type];
      if (!typeConfig) continue;
      const categoryConfig = config.categories[data.category];
      if (!categoryConfig) continue;

      const dedupKey = typeConfig.dedupKeyPattern(data.metadata);
      // Personal notifications dedup per-recipient: a multi-recipient fan-out
      // (same type/metadata, different targetUserId) must never collapse into
      // one recipient's active doc. Shared notifications are intentionally a
      // single doc for all admins (targetUserId is null).
      const groupKey = categoryConfig.audienceType === 'personal'
        ? `${data.category}::${data.targetUserId}::${dedupKey}`
        : `${data.category}::${dedupKey}`;

      const existing = groups.get(groupKey);
      if (existing) {
        existing.count++;
        // Add actor id if not already present
        if (!existing.actorIds.includes(data.actorId)) {
          existing.actorIds.push(data.actorId);
        }
        existing.docs.push(docSnap);
      } else {
        groups.set(groupKey, {
          type: data.type,
          category: data.category,
          targetUserId: data.targetUserId,
          metadata: data.metadata,
          actorIds: [data.actorId],
          count: 1,
          docs: [docSnap],
        });
      }
    }

    // Process each group: dedup check against active, create or increment.
    // Groups are processed in parallel. Each group's groupKey uniquely determines
    // a single active doc — the active lookup filters on exactly the same
    // dedupKey + category (+ targetUserId for personal) that compose the groupKey —
    // so two distinct groups can never resolve to the same active doc and there is
    // no cross-group contention to guard with a transaction. The work per group is
    // independent I/O, so Promise.all turns N sequential round-trips into one
    // parallel wave, removing the timeout risk under high dedup-group counts.
    const groupResults = await Promise.all(
      Array.from(groups.values()).map(
        async (group): Promise<'created' | 'updated' | 'skipped'> => {
          const typeConfig = config.types[group.type];
          if (!typeConfig) return 'skipped';

          const categoryConfig = config.categories[group.category];
          if (!categoryConfig) return 'skipped';

          const activePath = categoryConfig.activePath;
          const dedupKey = typeConfig.dedupKeyPattern(group.metadata);
          const countCap = typeConfig.countCap ?? DEFAULT_COUNT_CAP;
          const actorCap = typeConfig.actorCap ?? DEFAULT_ACTOR_CAP;

          // Check for existing active notification. Personal notifications are
          // scoped to the recipient so different recipients never share an active
          // doc; shared notifications omit targetUserId by design.
          let existingQuery = db.collection(activePath)
            .where('dedupKey', '==', dedupKey)
            .where('category', '==', group.category);
          if (categoryConfig.audienceType === 'personal') {
            existingQuery = existingQuery.where('targetUserId', '==', group.targetUserId);
          }

          const existingSnap = await existingQuery.limit(1).get();

          if (!existingSnap.empty) {
            // Increment existing
            const existingDoc = existingSnap.docs[0];
            const existingData = existingDoc.data() as Record<string, unknown>;
            const currentCount = (existingData.count as number) || 1;
            const currentActorIds = (existingData.latestActorIds as string[]) || [];

            // Merge actor ids (new first, deduped, capped)
            const newActorIds = group.actorIds.filter(
              (id) => !currentActorIds.includes(id)
            );
            const mergedActorIds = [
              ...newActorIds,
              ...currentActorIds,
            ].slice(0, actorCap);

            const newCount = Math.min(currentCount + group.count, countCap);

            await existingDoc.ref.update({
              count: newCount,
              latestActorIds: mergedActorIds,
              message: typeConfig.messagePattern(group.metadata, newCount),
              // New activity on an existing notification re-lights the unread badge.
              seenAt: 0,
              updatedAt: Date.now(),
            });

            return 'updated';
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
              latestActorIds: group.actorIds.slice(0, actorCap),
              targetPath,
              metadata: group.metadata,
              // Active docs are created unseen so the unread count() predicate matches.
              seenAt: 0,
              createdAt: now,
              updatedAt: now,
            };

            await db.collection(activePath).add(newDoc);
            return 'created';
          }
        }
      )
    );

    for (const r of groupResults) {
      if (r === 'created') notificationsCreated++;
      else if (r === 'updated') notificationsUpdated++;
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
