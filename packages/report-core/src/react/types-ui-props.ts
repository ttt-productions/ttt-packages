import type * as React from 'react';
import type { SubmitReportResult } from '../schemas/requests.js';

export interface ReportTargetRef {
  itemType: string;
  itemId: string;
  parentItemId?: string;
  reportedUserId?: string;
}

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

export interface ReportDialogCopy {
  formTitle: string;
  formDescription: (itemTypeLabel: string) => React.ReactNode;
  reasonLabel: string;
  reasonPlaceholder: string;
  commentLabel: string;
  commentPlaceholder: string;
  cancelLabel: string;
  submitLabel: string;
  upgradeTitle: string;
  upgradeDescription: (details: { itemTypeLabel: string; reason: string }) => React.ReactNode;
  upgradeBackLabel: string;
  upgradeConfirmLabel: string;
  alreadyReportedTitle: string;
  alreadyReportedDescription: string;
  alreadyReportedCloseLabel: string;
  discardTitle: string;
  discardDescription: React.ReactNode;
  discardConfirmLabel: string;
  discardKeepLabel: string;
}

export type ReportDialogSuccess =
  | Extract<SubmitReportResult, { outcome: 'filed' }>
  | Extract<SubmitReportResult, { outcome: 'upgraded' }>
  | { outcome: 'actionCompleted'; actionId: string };

export interface ReportDialogProps extends ReportTargetRef {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  reporterUserId?: string;
  copy: ReportDialogCopy;
  onSubmitSuccess: (success: ReportDialogSuccess) => void;
  onSubmitError: (error: unknown) => void;
}

export interface ReportButtonProps
  extends
    ReportTargetRef,
    Omit<ReportDialogProps, 'open' | 'onOpenChange' | keyof ReportTargetRef> {
  triggerLabel: string;
  onSignInRequired?: () => void;
  triggerButtonVariant?: string;
  triggerButtonSize?: string;
  triggerButtonClassName?: string;
}

export interface UseReportButtonOptions {
  reporterUserId?: string;
  onSignInRequired?: () => void;
}

export interface UseReportButtonResult {
  open: boolean;
  target: ReportTargetRef | null;
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
