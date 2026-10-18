import type { DeclaredInputFormat } from '@ttt-productions/input-format-core';
import type {
  ReportableItemConfig,
  PriorityConfig,
  TaskQueueConfig,
} from './types.js';

export interface ReportCoreCollections {
  reports: string;
  reportGroups: string;
  adminTasks: string;
}

export interface ReportCoreConfig {
  collections: ReportCoreCollections;

  reportableItems: Record<string, ReportableItemConfig>;

  reportReasons: string[];

  priorityConfig: PriorityConfig;

  taskQueues: Record<string, TaskQueueConfig>;

  /**
   * The report comment's field declaration — its format, min, and max. `min: 0` lets a report
   * reason or a `submit` action go without a comment; a `handOff` action never takes one.
   */
  reportCommentInput: DeclaredInputFormat;

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

/** Used when the app sets no `config.priorityThresholds`. */
export const DEFAULT_PRIORITY_THRESHOLDS: PriorityThreshold[] = [
  { minScore: 800, label: 'CRITICAL', className: 'rc-priority-critical' },
  { minScore: 300, label: 'HIGH', className: 'rc-priority-high' },
  { minScore: 100, label: 'NORMAL', className: 'rc-priority-normal' },
  { minScore: 0, label: 'LOW', className: 'rc-priority-low' },
];

/**
 * The task type string used for admin tasks that report-core itself
 * creates from report groups. Apps that bind their own task-type union
 * should include this literal value in their union.
 */
export const USER_REPORT_TASK_TYPE = 'userReport' as const;

export const ADMIN_TASK_STATUS = {
  PENDING: 'pending',
  CHECKED_OUT: 'checkedOut',
  WORK_LATER: 'workLater',
  COMPLETED: 'completed',
} as const;
