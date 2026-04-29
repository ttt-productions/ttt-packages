// report-core specific config and component prop types.
// Canonical admin task and report types live in @ttt-productions/ttt-core.

export type {
  Report,
  ReportStatus,
  ReportGroup,
  ReportGroupStatus,
} from '@ttt-productions/ttt-core';

export type {
  AdminTask,
  AdminTaskStatus,
  CheckoutDetails,
  CheckedOutTask,
  ActivityAction,
  ActivityLogEntry,
} from '@ttt-productions/ttt-core';

import type { CheckedOutTask } from '@ttt-productions/ttt-core';

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
