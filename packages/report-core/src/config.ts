import type {
  ReportableItemConfig,
  PriorityConfig,
  TaskQueueConfig,
} from './types.js';

// ============================================
// REPORT CORE CONFIG
// ============================================

export interface ReportCoreCollections {
  /** Collection for individual reports. Default: "contentReports" */
  reports: string;
  /** Collection for grouped reports. Default: "activeReportGroups" */
  reportGroups: string;
  /** Collection for admin tasks. Default: "adminTasks" */
  adminTasks: string;
  /** Collection for admin activity log. Default: "adminActivityLog" */
  activityLog: string;
}

export interface ReportCoreConfig {
  /** Firestore collection paths */
  collections: ReportCoreCollections;

  /** Map of item types that can be reported */
  reportableItems: Record<string, ReportableItemConfig>;

  /** List of reasons a user can select when reporting */
  reportReasons: string[];

  /** Priority scoring configuration */
  priorityConfig: PriorityConfig;

  /** Task queue definitions keyed by task type string */
  taskQueues: Record<string, TaskQueueConfig>;

  /** Max characters for the user's report comment */
  maxReportCommentLength: number;

  /** Priority thresholds for PriorityBadge display (score → label/color) */
  priorityThresholds?: PriorityThreshold[];
}

export interface PriorityThreshold {
  /** Minimum score to match this threshold (inclusive) */
  minScore: number;
  /** Label displayed in the badge */
  label: string;
  /** CSS class applied to the badge */
  className: string;
}

/**
 * Default priority thresholds.
 * Apps can override via config.priorityThresholds.
 */
export const DEFAULT_PRIORITY_THRESHOLDS: PriorityThreshold[] = [
  { minScore: 800, label: 'CRITICAL', className: 'rc-priority-critical' },
  { minScore: 300, label: 'HIGH', className: 'rc-priority-high' },
  { minScore: 100, label: 'NORMAL', className: 'rc-priority-normal' },
  { minScore: 0, label: 'LOW', className: 'rc-priority-low' },
];

/**
 * Admin task status constants.
 * Shared between client and server.
 */
export const ADMIN_TASK_STATUS = {
  PENDING: 'pending',
  CHECKED_OUT: 'checkedOut',
  WORK_LATER: 'workLater',
  COMPLETED: 'completed',
} as const;
