// ============================================
// TYPES
// ============================================
export type {
  Report,
  ReportStatus,
  ReportGroup,
  ReportGroupStatus,
  AdminTask,
  AdminTaskStatus,
  CheckoutDetails,
  CheckedOutTask,
  ActivityAction,
  ActivityLogEntry,
  TaskQueueConfig,
  ReportableItemConfig,
  PriorityConfig,
  ReportButtonProps,
  CheckedOutTaskListProps,
  TaskQueueBrowserProps,
  TaskActionBarProps,
  CountdownTimerProps,
  PriorityBadgeProps,
} from './types.js';

// ============================================
// CONFIG
// ============================================
export type {
  ReportCoreConfig,
  ReportCoreCollections,
  PriorityThreshold,
} from './config.js';

export {
  DEFAULT_PRIORITY_THRESHOLDS,
  ADMIN_TASK_STATUS,
} from './config.js';

// ============================================
// CONTEXT
// ============================================
export {
  ReportCoreProvider,
  useReportCoreContext,
} from './context/ReportCoreProvider.js';

export type {
  ReportCoreProviderProps,
  ReportCoreContextValue,
} from './context/ReportCoreProvider.js';

// ============================================
// HOOKS
// ============================================
export { useReportSubmit } from './hooks/useReportSubmit.js';
export { useCheckExistingReport } from './hooks/useCheckExistingReport.js';
export { useCheckedOutTasks } from './hooks/useCheckedOutTasks.js';
export { useCheckoutTask } from './hooks/useCheckoutTask.js';
export { useCheckinTask } from './hooks/useCheckinTask.js';
export { useReleaseTask } from './hooks/useReleaseTask.js';
export { useWorkLater } from './hooks/useWorkLater.js';
export { useTaskQueue } from './hooks/useTaskQueue.js';
export { useIndividualReports } from './hooks/useIndividualReports.js';

// ============================================
// COMPONENTS
// ============================================
export { ReportButton, useReportButton } from './components/ReportButton.js';
export { ReportDialog } from './components/ReportDialog.js';
export { CheckedOutTaskList } from './components/CheckedOutTaskList.js';
export { TaskQueueBrowser } from './components/TaskQueueBrowser.js';
export { CountdownTimer } from './components/CountdownTimer.js';
export { PriorityBadge } from './components/PriorityBadge.js';
export { TaskActionBar } from './components/TaskActionBar.js';
