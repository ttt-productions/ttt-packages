import type { ServerFirestore, ServerReportCoreConfig } from './types.js';

export interface RecalculateConfig {
  config: ServerReportCoreConfig;
  db: ServerFirestore;
  /** Batch size for Firestore writes. Default: 500 */
  batchSize?: number;
  logger?: { info: (...args: unknown[]) => void; error: (...args: unknown[]) => void };
}

/**
 * One-time migration helper to recalculate priority scores on all
 * pending admin tasks based on current config.
 *
 * Use this when you change priority config (reason scores, multipliers, etc.)
 * and want to retroactively update existing tasks.
 *
 * This reads each task's associated report group to get reason + item type,
 * then recalculates and updates the priority field.
 */
export async function recalculateAllPriorities({
  config,
  db,
  batchSize = 500,
  logger = console,
}: RecalculateConfig): Promise<{ updated: number; errors: number }> {
  const tasksRef = db.collection(config.collections.adminTasks);
  const pendingQuery = tasksRef.where('status', '==', 'pending');
  const snapshot = await pendingQuery.get();

  let updated = 0;
  let errors = 0;
  let batch = db.batch();
  let batchCount = 0;

  for (const taskDoc of snapshot.docs) {
    try {
      const taskData = taskDoc.data()!;
      const originalPath = taskData.originalPath as string;

      // Read the report group to get item type + reason info
      const groupDoc = await db.doc(originalPath).get();
      if (!groupDoc.exists) {
        logger.error(`Report group not found at ${originalPath} for task ${taskDoc.id}`);
        errors++;
        continue;
      }

      const groupData = groupDoc.data()!;
      const itemType = groupData.reportedItemType as string;
      const totalReports = (groupData.totalReports as number) ?? 1;
      const highestReasonScore = (groupData.highestReasonScore as number) ?? config.priorityConfig.defaultReasonScore;

      // Recalculate using the score directly (since we store highestReasonScore)
      const itemMultiplier =
        config.priorityConfig.itemTypeMultipliers[itemType] ??
        config.priorityConfig.defaultItemTypeMultiplier;
      const bonus = Math.max(0, totalReports - 1) * config.priorityConfig.additionalReportBonus;
      const newPriority = highestReasonScore * itemMultiplier + bonus;

      batch.update(taskDoc.ref, { priority: newPriority, lastUpdatedAt: Date.now() });
      batchCount++;
      updated++;

      if (batchCount >= batchSize) {
        await batch.commit();
        batch = db.batch();
        batchCount = 0;
        logger.info(`Committed batch of ${batchSize} priority updates`);
      }
    } catch (error) {
      logger.error(`Error recalculating priority for task ${taskDoc.id}:`, error);
      errors++;
    }
  }

  // Commit remaining
  if (batchCount > 0) {
    await batch.commit();
  }

  logger.info(`Priority recalculation complete. Updated: ${updated}, Errors: ${errors}`);
  return { updated, errors };
}
