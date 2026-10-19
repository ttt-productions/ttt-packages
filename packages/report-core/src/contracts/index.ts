// The pure, dependency-light contract surface: the admin-task and config shapes and the report
// constants. No React, server, or Admin SDK is reachable from here, so the app's core package and
// Cloud Functions import them without the UI or server surface. The wire schemas are `./schemas`.

export type {
  TaskPriority,
  AdminTask,
  AdminTaskStatus,
  CheckoutDetails,
  CheckedOutTask,
  ClaimedTask,
  CheckoutTaskResult,
  CheckoutNextImportantTaskResult,
  TaskLifecycleResult,
  ActivityAction,
  ActivityLogEntry,
} from './types-admin-task.js';
export type {
  TaskQueueConfig,
  ReportableItemConfig,
  PriorityConfig,
} from './types-config.js';

export type {
  ReportCoreConfig,
  ReportCoreCollections,
  PriorityThreshold,
} from './config.js';
export {
  DEFAULT_PRIORITY_THRESHOLDS,
  ADMIN_TASK_STATUS,
  USER_REPORT_TASK_TYPE,
} from './config.js';
