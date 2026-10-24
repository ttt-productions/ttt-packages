import type { ServerTransaction } from '@ttt-productions/firebase-helpers/server';

export interface ServerFieldValue {
  increment(n: number): unknown;
}

export type ReportCoreAuditEvent =
  | {
      action: 'checkout';
      adminUserId: string;
      taskType: string;
      taskId: string;
      timestamp: number;
    }
  | {
      action: 'auto_released';
      adminUserId: string;
      priorAdminUserId: string;
      taskType: string;
      taskId: string;
      timestamp: number;
    }
  | {
      action: 'checkin_resolved' | 'checkin_unresolved';
      adminUserId: string;
      taskType: string;
      taskId: string;
      timestamp: number;
      resolution: string | null;
      timeSpentMinutes: number;
    }
  | {
      action: 'release';
      adminUserId: string;
      taskType: string;
      taskId: string;
      timestamp: number;
    }
  | {
      action: 'checkout_next_important';
      adminUserId: string;
      taskType: string;
      taskId: string;
      priority: number;
      timestamp: number;
    };

/** Runs after the handler's transactional reads; a read on `transaction` here would come after a write. */
export type OnAuditEvent = (
  event: ReportCoreAuditEvent,
  transaction: ServerTransaction,
) => void | Promise<void>;

export type TaskClaimVerdict = { claimable: true } | { claimable: false; message: string };

export type TaskClaimGuard = (args: {
  taskDocId: string;
  taskData: Record<string, unknown>;
  originalData: Record<string, unknown> | null;
  transaction: ServerTransaction;
}) => Promise<TaskClaimVerdict>;

export interface AdminAuthConfig {
  requireAdmin?: (uid: string, authToken: unknown) => Promise<void>;
  adminUserIds?: string[];
}

export interface UserReportTaskSummaryInput {
  totalReports: number;
  reportedItemType: string;
}

export interface ServerReportCoreConfig {
  describeUserReportTask: (task: UserReportTaskSummaryInput) => string;
  collections: {
    reports: string;
    reportGroups: string;
    adminTasks: string;
  };
  taskQueues: Record<
    string,
    {
      defaultCheckoutMinutes: number;
      workLaterMinutes: number;
      maxWorkLaterMinutes: number;
    }
  >;
  priorityConfig: {
    reasonScores: Record<string, number>;
    itemTypeMultipliers: Record<string, number>;
    additionalReportBonus: number;
    defaultReasonScore: number;
    defaultItemTypeMultiplier: number;
  };
}
