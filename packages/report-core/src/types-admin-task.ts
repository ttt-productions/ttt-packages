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

/** The task a checkout answers with: the claim it holds, without the task's own timestamps. */
export interface ClaimedTask<TTaskType extends string = string> {
  id: string;
  taskType: TTaskType;
  taskId: string;
  originalPath: string;
  summary: string;
  priority: number;
  checkedOutAt: number;
  expiresAt: number;
  status: AdminTaskStatus;
  checkoutDetails: CheckoutDetails;
  /** The task's original document, or null when it no longer exists. */
  itemData: unknown;
}

export interface CheckoutTaskResult<TTaskType extends string = string> {
  success: true;
  /** The caller already held this task under a live lock; nothing was written. */
  alreadyHeld?: true;
  task: ClaimedTask<TTaskType>;
}

export interface CheckoutNextImportantTaskResult<TTaskType extends string = string> {
  success: true;
  task: ClaimedTask<TTaskType>;
}

/** The check-in and release answer. `alreadyResolved`: the task was already gone, so nothing was written. */
export interface TaskLifecycleResult {
  success: true;
  alreadyResolved?: true;
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
