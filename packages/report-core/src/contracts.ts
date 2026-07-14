// Pure, dependency-light contract surface for report-core.
//
// No React, no server, no Admin SDK is reachable from here — only the data
// shapes, constants, and pure Zod wire schemas. Pure consumers (the app's core
// package, Cloud Functions) should import from "@ttt-productions/report-core/contracts"
// rather than the broad root barrel, so they don't pull the UI/server surface
// into scope.

// --- Data shapes ---
export type {
  TaskPriority,
  AdminTask,
  AdminTaskStatus,
  CheckoutDetails,
  CheckedOutTask,
  ActivityAction,
  ActivityLogEntry,
  TaskQueueConfig,
  ReportableItemConfig,
  PriorityConfig,
} from './types.js';

// --- Config shapes + constants ---
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

// --- Pure wire schemas (zod) ---
export {
  CheckoutTaskRequestSchema,
  CheckinTaskRequestSchema,
  ReleaseTaskRequestSchema,
  SubmitReportRequestSchema,
} from './schemas/index.js';
export type {
  CheckoutTaskRequest,
  CheckinTaskRequest,
  ReleaseTaskRequest,
  SubmitReportRequest,
  SubmitReportResult,
} from './schemas/index.js';
