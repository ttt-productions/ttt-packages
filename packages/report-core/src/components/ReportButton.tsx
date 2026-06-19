'use client';

import { useState } from 'react';
import { Button } from '@ttt-productions/ui-core/react';
import { Flag } from 'lucide-react';
import { useReportCoreContext } from '../context/ReportCoreProvider.js';
import { ReportDialog } from './ReportDialog.js';
import type { ReportButtonProps } from '../types.js';

/**
 * Flag icon button that opens the ReportDialog.
 *
 * Reads report reasons and item type display names from ReportCoreProvider context.
 */
export function ReportButton({
  itemType,
  itemId,
  parentItemId,
  reportedUserId,
  reporterUserId,
  onSubmitSuccess,
  onSubmitError,
  triggerButtonVariant = 'destructive',
  triggerButtonSize = 'icon',
  triggerButtonClassName,
}: ReportButtonProps) {
  const { config } = useReportCoreContext();
  const [isOpen, setIsOpen] = useState(false);

  const displayItemType =
    config.reportableItems[itemType]?.displayName ?? itemType;

  return (
    <>
      <Button
        variant={triggerButtonVariant as 'destructive'}
        size={triggerButtonSize as 'icon'}
        className={triggerButtonClassName}
        title={`Report ${displayItemType}`}
        onClick={() => setIsOpen(true)}
      >
        <Flag className="icon-xs" />
        {triggerButtonSize !== 'icon' && <span className="ml-2">Report</span>}
      </Button>

      <ReportDialog
        open={isOpen}
        onOpenChange={setIsOpen}
        itemType={itemType}
        itemId={itemId}
        parentItemId={parentItemId}
        reportedUserId={reportedUserId}
        reporterUserId={reporterUserId}
        onSubmitSuccess={onSubmitSuccess}
        onSubmitError={onSubmitError}
      />
    </>
  );
}

// ============================================
// HEADLESS VERSION — for apps that need full control
// ============================================

export interface UseReportButtonOptions {
  itemType: string;
  itemId: string;
  currentUserId?: string;
}

/**
 * Headless hook for report button logic.
 * Use when you need custom trigger UI. The submit callable is idempotent, so a
 * duplicate report is a benign no-op success — no client-side duplicate pre-check.
 */
export function useReportButton({ currentUserId }: UseReportButtonOptions) {
  const [isOpen, setIsOpen] = useState(false);

  const handleOpenReport = (): boolean => {
    if (!currentUserId) return false;
    setIsOpen(true);
    return true;
  };

  return {
    isOpen,
    setIsOpen,
    handleOpenReport,
  };
}
