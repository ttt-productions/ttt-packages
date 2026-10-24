import type { ServerReportCoreConfig } from './types.js';
import { USER_REPORT_TASK_TYPE } from '../contracts/config.js';

export interface BuildUserReportAdminTaskDocArgs {
  config: ServerReportCoreConfig;
  groupData: Record<string, unknown>;
  groupId: string;
  now: number;
}

export interface BuiltUserReportAdminTask {
  adminTaskId: string;
  doc: {
    taskType: string;
    taskId: string;
    originalPath: string;
    status: 'pending';
    checkoutDetails: null;
    summary: string;
    priority: number;
    reportedUserId: string | null;
    reportedItemType: string | null;
    reportedItemId: string | null;
    parentItemId: string | null;
    createdAt: number;
    lastUpdatedAt: number;
  };
}

export function buildUserReportAdminTaskDoc({
  config,
  groupData,
  groupId,
  now,
}: BuildUserReportAdminTaskDocArgs): BuiltUserReportAdminTask {
  const itemType = groupData.reportedItemType as string;
  const totalReports = (groupData.totalReports as number) ?? 1;
  const highestReasonScore =
    (groupData.highestReasonScore as number) ?? config.priorityConfig.defaultReasonScore;

  const reasonScore = highestReasonScore;
  const itemMultiplier =
    config.priorityConfig.itemTypeMultipliers[itemType] ??
    config.priorityConfig.defaultItemTypeMultiplier;
  const bonus = Math.max(0, totalReports - 1) * config.priorityConfig.additionalReportBonus;
  const priority = reasonScore * itemMultiplier + bonus;

  return {
    adminTaskId: `userReport-${groupId}`,
    doc: {
      taskType: USER_REPORT_TASK_TYPE,
      taskId: groupId,
      originalPath: `${config.collections.reportGroups}/${groupId}`,
      status: 'pending',
      checkoutDetails: null,
      summary: config.describeUserReportTask({ totalReports, reportedItemType: itemType }),
      priority,
      // The Admin SDK rejects `undefined`, so an absent field is stored as null.
      reportedUserId: (groupData.reportedUserId as string | undefined) ?? null,
      reportedItemType: itemType ?? null,
      reportedItemId: (groupData.reportedItemId as string | undefined) ?? null,
      parentItemId: (groupData.parentItemId as string | undefined) ?? null,
      createdAt: now,
      lastUpdatedAt: now,
    },
  };
}
