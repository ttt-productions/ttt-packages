export type TaskPriority = 'critical' | 'high' | 'normal' | 'low';

export type AdminTaskStatus = 'pending' | 'checkedOut' | 'workLater' | 'completed';

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

export interface CheckedOutTask<TTaskType extends string = string> extends AdminTask<TTaskType> {
  checkoutDetails: NonNullable<AdminTask<TTaskType>['checkoutDetails']>;
}

export interface ClaimedTask<TTaskType extends string = string> extends CheckedOutTask<TTaskType> {
  checkedOutAt: number;
  expiresAt: number;
  itemData: unknown;
}

export interface CheckoutTaskResult<TTaskType extends string = string> {
  success: true;
  alreadyHeld?: true;
  task: ClaimedTask<TTaskType>;
}

export interface CheckoutNextImportantTaskResult<TTaskType extends string = string> {
  success: true;
  task: ClaimedTask<TTaskType>;
}

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
