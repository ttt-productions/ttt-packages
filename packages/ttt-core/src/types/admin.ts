// Admin system types: Task queue, Checkout, Activity log
// Canonical home for admin task lifecycle types. report-core re-exports these.

export type AdminTaskType =
  | 'systemMessage'
  | 'libraryReview'
  | 'userReport'
  | 'content-appeal';

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

export interface AdminTask {
  id: string;
  taskType: AdminTaskType;
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
export interface CheckedOutTask extends AdminTask {
  checkoutDetails: NonNullable<AdminTask['checkoutDetails']>;
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
