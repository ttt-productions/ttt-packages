// Prop and contract types for the report-core UI surface. Type-only (no React runtime import),
// so the pure root can export them without pulling React into pure consumers.

import type * as React from 'react';
import type { SubmitReportResult } from './schemas/index.js';

/** The item a report is about. */
export interface ReportTargetRef {
  itemType: string;
  itemId: string;
  parentItemId?: string;
  /** Hint only — the report callable re-derives the owner. */
  reportedUserId?: string;
}

/**
 * A consumer-supplied extra option in the report-reason picker, already filtered for who may see
 * it. report-core knows nothing about what it does; it runs the handler instead of the
 * report-intake callable.
 *
 * - `submit` — a submission of its own (e.g. an admin marking evidence). It receives the comment,
 *   and a resolved handler is reported to the app as a completed submission.
 * - `handOff` — sends the reporter to another surface (e.g. a removal-request form). It never takes
 *   a comment: the dialog hides the comment field, so nothing the reporter typed can ride along. Its
 *   handler resolves once the destination has rendered, and the dialog closes without reporting a
 *   submission.
 */
export type AdditionalReportAction =
  | {
      id: string;
      label: string;
      kind: 'submit';
      handler: (target: ReportTargetRef, comment: string) => Promise<void>;
    }
  | {
      id: string;
      label: string;
      kind: 'handOff';
      handler: (target: ReportTargetRef) => Promise<void>;
    };

/** Every string the report dialog renders. The app supplies all of it; the package has none. */
export interface ReportDialogCopy {
  formTitle: string;
  /** `itemTypeLabel` is the reportable item's display name (its type id when it has none). */
  formDescription: (itemTypeLabel: string) => React.ReactNode;
  reasonLabel: string;
  reasonPlaceholder: string;
  commentLabel: string;
  commentPlaceholder: string;
  cancelLabel: string;
  /** The submit button's label for a report reason; an additional action shows its own label. */
  submitLabel: string;
  /** The reporter already reported this item and picked a protected reason: offer the upgrade. */
  upgradeTitle: string;
  upgradeDescription: (details: { itemTypeLabel: string; reason: string }) => React.ReactNode;
  upgradeBackLabel: string;
  upgradeConfirmLabel: string;
  /** The reporter already reported this item. */
  alreadyReportedTitle: string;
  alreadyReportedDescription: string;
  alreadyReportedCloseLabel: string;
  /** Closing with a typed comment not yet sent asks first (FRONTEND-207). */
  discardTitle: string;
  discardDescription: React.ReactNode;
  /** Drops the comment and closes. */
  discardConfirmLabel: string;
  /** Keeps the dialog open with the comment. */
  discardKeepLabel: string;
}

/**
 * What the dialog reports to the app as done: a report the callable filed, an existing report it
 * escalated, or an additional `submit` action that completed. A refusal (`alreadyReported`) or an
 * offered upgrade (`upgradeAvailable`) is shown in the dialog, never reported as success.
 */
export type ReportDialogSuccess =
  | Extract<SubmitReportResult, { outcome: 'filed' }>
  | Extract<SubmitReportResult, { outcome: 'upgraded' }>
  | { outcome: 'actionCompleted'; actionId: string };

export interface ReportDialogProps extends ReportTargetRef {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** The signed-in reporter. Nothing is submitted without it; the dialog's draft is bound to it. */
  reporterUserId?: string;
  copy: ReportDialogCopy;
  /** Whether a report reason or a `submit` action needs a comment. Default true. A `handOff` action never takes one. */
  requireComment?: boolean;
  onSubmitSuccess: (success: ReportDialogSuccess) => void;
  /** Every failure, a cancelled hand-off (`AbortError`) included; the dialog stays open. */
  onSubmitError: (error: unknown) => void;
}

export interface ReportButtonProps
  extends ReportTargetRef,
    Omit<ReportDialogProps, 'open' | 'onOpenChange' | keyof ReportTargetRef> {
  /** The trigger's accessible name, and its visible text unless it is icon-only. */
  triggerLabel: string;
  /** Called instead of opening the dialog when no reporter is signed in. */
  onSignInRequired?: () => void;
  /** ui-core Button variant. Default "ghost" (neutral — FRONTEND-006). */
  triggerButtonVariant?: string;
  /** ui-core Button size. Default "icon". */
  triggerButtonSize?: string;
  triggerButtonClassName?: string;
}

export interface UseReportButtonOptions {
  /** The signed-in reporter; the open state is bound to it. */
  reporterUserId?: string;
  /** Called instead of opening when no reporter is signed in. */
  onSignInRequired?: () => void;
}

export interface UseReportButtonResult {
  /** True only while opened by the current `reporterUserId`. */
  open: boolean;
  /** The item last opened for the current reporter, or null. */
  target: ReportTargetRef | null;
  /** Opens the report for `target`; false (and `onSignInRequired`) when no reporter is signed in. */
  openReport: (target: ReportTargetRef) => boolean;
  onOpenChange: (open: boolean) => void;
}

export interface CountdownTimerProps {
  expiresAtMillis: number;
  checkedOutAtMillis: number;
}

export interface PriorityBadgeProps {
  priority: number;
}
