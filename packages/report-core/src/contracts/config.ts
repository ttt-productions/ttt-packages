import type { DeclaredInputFormat } from '@ttt-productions/input-format-core';
import type { ReportableItemConfig, PriorityConfig, TaskQueueConfig } from './types-config.js';

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

  reportCommentInput: DeclaredInputFormat;

  priorityThresholds?: PriorityThreshold[];
}

export interface PriorityThreshold {
  minScore: number;
  label: string;
  className: string;
}

export const DEFAULT_PRIORITY_THRESHOLDS: PriorityThreshold[] = [
  { minScore: 800, label: 'CRITICAL', className: 'rc-priority-critical' },
  { minScore: 300, label: 'HIGH', className: 'rc-priority-high' },
  { minScore: 100, label: 'NORMAL', className: 'rc-priority-normal' },
  { minScore: 0, label: 'LOW', className: 'rc-priority-low' },
];

export const USER_REPORT_TASK_TYPE = 'userReport' as const;

export const ADMIN_TASK_STATUS = {
  PENDING: 'pending',
  CHECKED_OUT: 'checkedOut',
  WORK_LATER: 'workLater',
  COMPLETED: 'completed',
} as const;
