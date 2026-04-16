'use client';

import { useState } from 'react';
import { Button } from '@ttt-productions/ui-core';
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
  reportedUsername,
  reporterUserId,
  reporterUsername,
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
        reportedUsername={reportedUsername}
        reporterUserId={reporterUserId}
        reporterUsername={reporterUsername}
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
 * Use when you need custom trigger UI. Duplicate detection is handled
 * by the submit handler (ALREADY_REPORTED error) rather than a pre-check.
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
