// Canonical admin task and report types.
// Generic-at-type-level over TTaskType so consumer apps can bind their
// own task-type union literal (e.g. an `AdminTaskType` union).
//
// The consuming app's composition package depends on report-core
// (one-way edge — generic packages must not depend on app-specific packages).

export type TaskPriority = 'critical' | 'high' | 'normal' | 'low';

export type AdminTaskStatus =
  | 'pending'
  | 'checkedOut'
  | 'workLater'
  | 'completed';

export type ActivityAction =
  | 'checkout'
  | 'checkout_next_important'
  | 'checkin_resolved'
  | 'checkin_unresolved'
  | 'release'
  | 'mark_work_later'
  | 'auto_released'
  | 'auto_released_scheduled';

export interface CheckoutDetails {
  userId: string;
  checkedOutAt: number;
  expiresAt: number;
  workLaterUntil: number | null;
}

export interface AdminTask<TTaskType extends string = string> {
  id: string;
  taskType: TTaskType;
  taskId: string;
  originalPath: string;
  status: AdminTaskStatus;
  checkoutDetails: CheckoutDetails | null;
  summary: string;
  priority: number;
  createdAt: number;
  lastUpdatedAt: number;
  completedAt?: number;
  itemData?: unknown;
}

/** AdminTask with non-null checkoutDetails. */
export interface CheckedOutTask<TTaskType extends string = string> extends AdminTask<TTaskType> {
  checkoutDetails: NonNullable<AdminTask<TTaskType>['checkoutDetails']>;
}

export interface ActivityLogEntry {
  id: string;
  adminUserId: string;
  action: ActivityAction;
  taskType: string;
  taskId: string;
  timestamp: number;
  resolution?: string;
  timeSpentMinutes?: number;
  extendHours?: number;
  priority?: number;
}

// --- Reporting ---

export type ReportStatus =
  | 'pending_review'
  | 'resolved_no_action'
  | 'resolved_action_taken';

export type ReportGroupStatus = 'pending' | 'reviewing' | 'resolved';

export type Report = {
  reportId: string;
  reporterUserId: string;
  reportedItemType: string;
  reportedItemId: string;
  parentItemId?: string;
  reportedUserId?: string;
  reason: string;
  comment: string;
  createdAt: number;
  status: ReportStatus;
  resolvedAt?: number;
  resolvedBy?: string;
  adminNotes?: string;
};

export type ReportGroup = {
  groupKey: string;
  reportedItemId: string;
  reportedItemType: string;
  reportedUserId: string | null;
  lastReportAt: number;
  totalReports: number;
  status: ReportGroupStatus;
  reports?: Report[];
};

// ============================================
// TASK QUEUE CONFIG
// ============================================

export interface TaskQueueConfig {
  displayName: string;
  description: string;
  defaultCheckoutMinutes: number;
  workLaterMinutes: number;
  maxWorkLaterMinutes: number;
}

// ============================================
// REPORTABLE ITEM CONFIG
// ============================================

export interface ReportableItemConfig {
  displayName: string;
}

// ============================================
// PRIORITY CONFIG
// ============================================

export interface PriorityConfig {
  /** Base score per reason. Higher = reviewed sooner. */
  reasonScores: Record<string, number>;
  /** Multiplier per item type. More visible content = higher multiplier. */
  itemTypeMultipliers: Record<string, number>;
  /** Bonus points per additional report on the same item. */
  additionalReportBonus: number;
  /** Default score if reason not found in reasonScores. */
  defaultReasonScore: number;
  /** Default multiplier if item type not found in itemTypeMultipliers. */
  defaultItemTypeMultiplier: number;
}

// ============================================
// REPORT BUTTON PROPS
// ============================================

export interface ReportButtonProps {
  itemType: string;
  itemId: string;
  parentItemId?: string;
  reportedUserId?: string;
  /** Current user ID. Required for dialog submission. */
  reporterUserId?: string;
  /** Called after successful submission. */
  onSubmitSuccess?: () => void;
  /** Called on submission error. */
  onSubmitError?: (error: Error) => void;
  /** Button variant passed to ui-core Button. Default: "destructive" */
  triggerButtonVariant?: string;
  /** Button size passed to ui-core Button. Default: "icon" */
  triggerButtonSize?: string;
  /** Additional className for the trigger button */
  triggerButtonClassName?: string;
}

// ============================================
// ADMIN COMPONENT PROPS
// ============================================

export interface CheckedOutTaskListProps {
  /** Called when user clicks a checked-out task to resume working on it */
  onItemSelect: (task: CheckedOutTask) => void;
}

export interface TaskQueueBrowserProps {
  /** The task type key to browse (must exist in config.taskQueues) */
  taskType: string;
  /** Called when a task is checked out from the queue */
  onTaskCheckedOut: (task: CheckedOutTask) => void;
  /** Custom label for the checkout button. Default: "Checkout Next" */
  checkoutButtonLabel?: string;
}

export interface TaskActionBarProps {
  taskId: string;
  taskType: string;
  /** Called after any action completes (checkin, release, work-later) */
  onActionComplete: () => void;
}

export interface CountdownTimerProps {
  expiresAtMillis: number;
  checkedOutAtMillis: number;
}

export interface PriorityBadgeProps {
  priority: number;
}
