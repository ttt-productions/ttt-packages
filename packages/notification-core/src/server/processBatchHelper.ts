import type { NotificationSystemConfig, PendingNotification } from '../types.js';
import type { ServerFirestore } from './types.js';
import { buildActiveNotificationDocId } from './activeNotificationId.js';

const DEFAULT_COUNT_CAP = 5000;
const DEFAULT_ACTOR_CAP = 5;
const PROCESSING_BATCH_SIZE = 500;
const MAX_ITERATIONS = 20;

interface BatchProcessResult {
  totalProcessed: number;
  notificationsCreated: number;
  notificationsUpdated: number;
}

export async function processBatchHelper(
  db: ServerFirestore,
  config: NotificationSystemConfig,
): Promise<BatchProcessResult> {
  const pendingPath = config.pendingCollectionPath ?? 'pendingNotifications';
  const cutoff = Date.now() - 30_000;

  let totalProcessed = 0;
  let notificationsCreated = 0;
  let notificationsUpdated = 0;
  let iterations = 0;
  let hasMore = true;

  while (hasMore && iterations < MAX_ITERATIONS) {
    iterations++;

    const pendingQuery = db
      .collection(pendingPath)
      .where('createdAt', '<=', cutoff)
      .orderBy('createdAt', 'asc')
      .limit(PROCESSING_BATCH_SIZE);

    const snapshot = await pendingQuery.get();

    if (snapshot.empty) {
      break;
    }

    const groups = new Map<
      string,
      {
        type: string;
        category: string;
        targetUserId: string | null;
        metadata: Record<string, unknown>;
        actorIds: string[];
        count: number;
        docs: typeof snapshot.docs;
      }
    >();

    for (const docSnap of snapshot.docs) {
      const data = docSnap.data() as Omit<PendingNotification, 'id'>;
      const typeConfig = config.types[data.type];
      if (!typeConfig) continue;
      const categoryConfig = config.categories[data.category];
      if (!categoryConfig) continue;

      const dedupKey = typeConfig.dedupKeyPattern(data.metadata);
      const groupKey =
        categoryConfig.audienceType === 'personal'
          ? `${data.category}::${data.targetUserId}::${dedupKey}`
          : `${data.category}::${dedupKey}`;

      const existing = groups.get(groupKey);
      if (existing) {
        existing.count++;
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

    const groupResults = await Promise.all(
      Array.from(groups.values()).map(async (group): Promise<'created' | 'updated' | 'skipped'> => {
        const typeConfig = config.types[group.type];
        if (!typeConfig) return 'skipped';

        const categoryConfig = config.categories[group.category];
        if (!categoryConfig) return 'skipped';

        const activePath = categoryConfig.activePath;
        const dedupKey = typeConfig.dedupKeyPattern(group.metadata);
        const countCap = typeConfig.countCap ?? DEFAULT_COUNT_CAP;
        const actorCap = typeConfig.actorCap ?? DEFAULT_ACTOR_CAP;

        const activeDocRef = db.collection(activePath).doc(
          buildActiveNotificationDocId({
            category: group.category,
            audienceType: categoryConfig.audienceType,
            targetUserId: group.targetUserId,
            dedupKey,
          }),
        );

        return db.runTransaction(async (tx): Promise<'created' | 'updated'> => {
          const existingSnap = await tx.get(activeDocRef);

          if (existingSnap.exists) {
            const existingData = (existingSnap.data() ?? {}) as Record<string, unknown>;
            const currentCount = (existingData.count as number) || 1;
            const currentActorIds = (existingData.latestActorIds as string[]) || [];

            const newActorIds = group.actorIds.filter((id) => !currentActorIds.includes(id));
            const mergedActorIds = [...newActorIds, ...currentActorIds].slice(0, actorCap);

            const newCount = Math.min(currentCount + group.count, countCap);

            tx.update(activeDocRef, {
              count: newCount,
              latestActorIds: mergedActorIds,
              message: typeConfig.messagePattern(group.metadata, newCount),
              seenAt: 0,
              updatedAt: Date.now(),
            });

            return 'updated';
          } else {
            // Firestore rejects `undefined` values, so a linkless type omits the field.
            const targetPath =
              typeConfig.defaultTargetPath === undefined
                ? undefined
                : typeof typeConfig.defaultTargetPath === 'function'
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
              ...(targetPath === undefined ? {} : { targetPath }),
              metadata: group.metadata,
              seenAt: 0,
              createdAt: now,
              updatedAt: now,
            };

            tx.set(activeDocRef, newDoc);
            return 'created';
          }
        });
      }),
    );

    for (const r of groupResults) {
      if (r === 'created') notificationsCreated++;
      else if (r === 'updated') notificationsUpdated++;
    }

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
