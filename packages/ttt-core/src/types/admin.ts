// Admin system types: Task queue, Checkout, Activity log

export type AdminTaskType =
  | 'systemMessage'
  | 'libraryReview'
  | 'userReport'
  | 'content-appeal';

export type TaskPriority = 'critical' | 'high' | 'normal' | 'low';

export interface CheckoutDetails {
  status: 'available' | 'checkedOut' | 'workLater';
  userId: string;
  userDisplayName: string;
  userPhotoURL: string | null;
  checkedOutAt: number;
  expiresAt: number;
  workLaterUntil: number | null;
}

export interface CheckoutableDocument {
  checkoutDetails?: CheckoutDetails | null;
}

export interface AdminTask {
  id: string;
  taskType: AdminTaskType;
  taskId: string;
  originalPath: string;
  status: 'pending' | 'checkedOut' | 'workLater' | 'completed';
  checkoutDetails: {
    userId: string;
    userDisplayName: string;
    userPhotoURL: string | null;
    checkedOutAt: number;
    expiresAt: number;
    workLaterUntil: number | null;
  } | null;
  summary: string;
  priority: number;
  createdAt: number;
  lastUpdatedAt: number;
  completedAt?: number;
  itemData?: any;
}

export interface CheckedOutTask extends AdminTask {
  checkoutDetails: NonNullable<AdminTask['checkoutDetails']>;
}

export type ActivityAction =
  | 'checkout'
  | 'checkin_resolved'
  | 'checkin_unresolved'
  | 'work_later'
  | 'auto_released'
  | 'manual_release';

export interface AdminActivityLog {
  id: string;
  adminUserId: string;
  adminDisplayName: string;
  action: ActivityAction;
  taskType: AdminTaskType;
  itemId: string;
  itemPath: string;
  itemSummary: string;
  timestamp: number;
  resolution?: string;
  timeSpentMinutes?: number;
  previousAdminId?: string;
}
