import type { ServerFirestore, ServerReportCoreConfig } from './types.js';
import { USER_REPORT_TASK_TYPE } from '../config.js';

export interface AdminTaskHandlerConfig {
  config: ServerReportCoreConfig;
  db: ServerFirestore;
  logger?: { info: (...args: unknown[]) => void; error: (...args: unknown[]) => void };
}

/**
 * Factory that returns the handler logic for when a report group is created.
 * Creates an adminTasks entry with a calculated priority score.
 *
 * The app registers this as an onDocumentCreated trigger on the reportGroups collection.
 *
 * @returns An async handler: (groupData, groupId) => Promise<void>
 */
export function createAdminTaskHandler({
  config,
  db,
  logger = console,
}: AdminTaskHandlerConfig) {
  return async (groupData: Record<string, unknown>, groupId: string): Promise<void> => {
    if (!groupData) return;

    const now = Date.now();
    const itemType = groupData.reportedItemType as string;
    const totalReports = (groupData.totalReports as number) ?? 1;
    const highestReasonScore = (groupData.highestReasonScore as number) ?? config.priorityConfig.defaultReasonScore;

    // Find the reason that matches this score (for the formula)
    // Since we store highestReasonScore, we reverse-lookup or just use the score directly
    const reasonScore = highestReasonScore;
    const itemMultiplier =
      config.priorityConfig.itemTypeMultipliers[itemType] ??
      config.priorityConfig.defaultItemTypeMultiplier;
    const bonus = Math.max(0, totalReports - 1) * config.priorityConfig.additionalReportBonus;
    const priority = reasonScore * itemMultiplier + bonus;

    const count = totalReports;
    const itemDesc = itemType;

    const adminTaskId = `userReport-${groupId}`;
    const adminTaskRef = db.collection(config.collections.adminTasks).doc(adminTaskId);

    await adminTaskRef.set({
      taskType: USER_REPORT_TASK_TYPE,
      taskId: groupId,
      originalPath: `${config.collections.reportGroups}/${groupId}`,
      status: 'pending',
      checkoutDetails: null,
      summary: `${count} report${count > 1 ? 's' : ''} for ${itemDesc}`,
      priority,
      // Report identity — persisted on the task so admin task surfaces can filter/scope by
      // the reported user and item WITHOUT re-reading the group (a reported-user filter on an
      // admin report queue queries `reportedUserId` on the task doc). The caller passes these
      // in groupData; coalesce to null since the Admin SDK rejects `undefined` and an
      // unresolved owner (e.g. a chat report whose sender isn't resolved yet) legitimately has
      // no reportedUserId.
      reportedUserId: (groupData.reportedUserId as string | undefined) ?? null,
      reportedItemType: itemType ?? null,
      reportedItemId: (groupData.reportedItemId as string | undefined) ?? null,
      parentItemId: (groupData.parentItemId as string | undefined) ?? null,
      createdAt: now,
      lastUpdatedAt: now,
    });

    logger.info(`Created adminTask ${adminTaskId} for report group ${groupId} with priority ${priority}`);
  };
}
