'use client';

import { useCallback, useState } from 'react';
import { Button } from '@ttt-productions/ui-core/react';
import { Flag } from 'lucide-react';
import { ReportDialog } from './ReportDialog.js';
import type {
  ReportButtonProps,
  ReportTargetRef,
  UseReportButtonOptions,
  UseReportButtonResult,
} from '../types-ui-props.js';

/**
 * Open state for a report dialog, for a custom trigger or a target chosen at click time (a
 * message in a list). The open state is bound to the reporter who opened it, so a different
 * signed-in reporter reads it closed (FRONTEND-108); with no reporter, `openReport` calls
 * `onSignInRequired` and opens nothing.
 */
export function useReportButton({ reporterUserId, onSignInRequired }: UseReportButtonOptions): UseReportButtonResult {
  const [state, setState] = useState<{
    reporterUserId: string | undefined;
    open: boolean;
    target: ReportTargetRef | null;
  }>({ reporterUserId: undefined, open: false, target: null });

  const isCurrentReporter = !!reporterUserId && state.reporterUserId === reporterUserId;

  const openReport = useCallback(
    (target: ReportTargetRef): boolean => {
      if (!reporterUserId) {
        onSignInRequired?.();
        return false;
      }
      setState({ reporterUserId, open: true, target });
      return true;
    },
    [reporterUserId, onSignInRequired],
  );

  const onOpenChange = useCallback(
    (open: boolean) => {
      setState((prev) => ({ ...prev, open: open && !!reporterUserId && prev.reporterUserId === reporterUserId }));
    },
    [reporterUserId],
  );

  return {
    open: isCurrentReporter && state.open,
    target: isCurrentReporter ? state.target : null,
    openReport,
    onOpenChange,
  };
}

/** A flag trigger that opens the report dialog for one item. */
export function ReportButton({
  itemType,
  itemId,
  parentItemId,
  reportedUserId,
  triggerLabel,
  onSignInRequired,
  triggerButtonVariant = 'ghost',
  triggerButtonSize = 'icon',
  triggerButtonClassName,
  ...dialogProps
}: ReportButtonProps) {
  const report = useReportButton({ reporterUserId: dialogProps.reporterUserId, onSignInRequired });
  const iconOnly = triggerButtonSize === 'icon';

  return (
    <>
      <Button
        type="button"
        variant={triggerButtonVariant as 'ghost'}
        size={triggerButtonSize as 'icon'}
        className={triggerButtonClassName}
        aria-label={iconOnly ? triggerLabel : undefined}
        onClick={() => report.openReport({ itemType, itemId, parentItemId, reportedUserId })}
      >
        <Flag className="icon-xs" aria-hidden="true" />
        {!iconOnly && <span>{triggerLabel}</span>}
      </Button>

      <ReportDialog
        {...dialogProps}
        itemType={itemType}
        itemId={itemId}
        parentItemId={parentItemId}
        reportedUserId={reportedUserId}
        open={report.open}
        onOpenChange={report.onOpenChange}
      />
    </>
  );
}
