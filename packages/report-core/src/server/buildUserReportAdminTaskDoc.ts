import type { ServerReportCoreConfig } from './types.js';
import { USER_REPORT_TASK_TYPE } from '../config.js';

export interface BuildUserReportAdminTaskDocArgs {
  config: ServerReportCoreConfig;
  /** The report-group state the task derives from (reportedItemType / totalReports /
   *  highestReasonScore + the report-identity locator fields). */
  groupData: Record<string, unknown>;
  groupId: string;
  /** Creation timestamp (epoch ms). Passed in, never read from the clock here, so a
   *  transaction-scoped caller stamps one consistent `now` across its writes. */
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

/**
 * PURE builder of the userReport admin-task document — the ONE owner of the task's id
 * convention (`userReport-{groupId}`), its stored shape, the priority formula
 * (reasonScore × itemTypeMultiplier + additional-report bonus), and the summary copy.
 *
 * Two writers consume it: `createAdminTaskHandler` below (the original standalone `.set()`
 * path) and any app writer that must create the task INSIDE its own transaction (the
 * report-group trigger commits group + counted-marker + safety hold + task atomically).
 * Extracted pure precisely so the transactional caller never re-declares the shape or the
 * formula (ENG-002/ARCH-102).
 */
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
      summary: `${totalReports} report${totalReports > 1 ? 's' : ''} for ${itemType}`,
      priority,
      // Report identity — persisted on the task so admin task surfaces can filter/scope by
      // the reported user and item WITHOUT re-reading the group. Coalesced to null since the
      // Admin SDK rejects `undefined` and an unresolved owner (e.g. a chat report whose
      // sender isn't resolved yet) legitimately has no reportedUserId.
      reportedUserId: (groupData.reportedUserId as string | undefined) ?? null,
      reportedItemType: itemType ?? null,
      reportedItemId: (groupData.reportedItemId as string | undefined) ?? null,
      parentItemId: (groupData.parentItemId as string | undefined) ?? null,
      createdAt: now,
      lastUpdatedAt: now,
    },
  };
}
