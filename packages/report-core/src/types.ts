// ============================================
// REPORT TYPES
// ============================================

export interface Report {
  reportId: string;
  reporterUserId: string;
  reporterUsername: string;
  reportedItemType: string;
  reportedItemId: string;
  parentItemId?: string;
  reportedUserId?: string;
  reportedUsername?: string;
  reason: string;
  comment: string;
  createdAt: number;
  status: ReportStatus;
  resolvedAt?: number;
  resolvedBy?: string;
  adminNotes?: string;
}

export type ReportStatus =
  | 'pending_review'
  | 'resolved_no_action'
  | 'resolved_action_taken';

export interface ReportGroup {
  groupKey: string;
  reportedItemId: string;
  reportedItemType: string;
  reportedUsername: string | null;
  reportedUserId: string | null;
  lastReportAt: number;
  totalReports: number;
  highestReasonScore: number;
  status: ReportGroupStatus;
}

export type ReportGroupStatus = 'pending' | 'reviewing' | 'resolved';

// ============================================
// ADMIN TASK TYPES
// ============================================

export interface AdminTask {
  id: string;
  taskType: string;
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

export type AdminTaskStatus =
  | 'pending'
  | 'checkedOut'
  | 'workLater'
  | 'completed';

export interface CheckoutDetails {
  userId: string;
  userDisplayName: string;
  userPhotoURL: string | null;
  checkedOutAt: number;
  expiresAt: number;
  workLaterUntil: number | null;
}

/** AdminTask with non-null checkoutDetails (for display in checked-out list) */
export interface CheckedOutTask extends AdminTask {
  checkoutDetails: NonNullable<AdminTask['checkoutDetails']>;
}

// ============================================
// ACTIVITY LOG
// ============================================

export type ActivityAction =
  | 'checkout'
  | 'checkout_next_important'
  | 'checkin_resolved'
  | 'checkin_unresolved'
  | 'release'
  | 'mark_work_later'
  | 'auto_released'
  | 'auto_released_scheduled';

export interface ActivityLogEntry {
  id: string;
  adminUserId: string;
  adminDisplayName: string;
  action: ActivityAction;
  taskType: string;
  taskId: string;
  timestamp: number;
  resolution?: string;
  timeSpentMinutes?: number;
  extendHours?: number;
  priority?: number;
}

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
  reportedUsername?: string;
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
