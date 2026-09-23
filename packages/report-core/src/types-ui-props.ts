// React component prop types for the report-core UI surface. These are pure
// type declarations (no React runtime import), so re-exporting them from the
// contracts barrel would not pull React into pure consumers.

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

export interface CountdownTimerProps {
  expiresAtMillis: number;
  checkedOutAtMillis: number;
}

export interface PriorityBadgeProps {
  priority: number;
}
