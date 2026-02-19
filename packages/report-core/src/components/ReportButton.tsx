'use client';

import { useState } from 'react';
import { Button } from '@ttt-productions/ui-core';
import { Flag, Loader2 } from 'lucide-react';
import { useReportCoreContext } from '../context/ReportCoreProvider.js';
import { useCheckExistingReport } from '../hooks/useCheckExistingReport.js';
import { ReportDialog } from './ReportDialog.js';
import type { ReportButtonProps } from '../types.js';

/**
 * Flag icon button that opens the ReportDialog.
 * Performs a duplicate check before opening.
 *
 * Reads report reasons and item type display names from ReportCoreProvider context.
 */
export function ReportButton({
  itemType,
  itemId,
  parentItemId,
  reportedUserId,
  reportedUsername,
  triggerButtonVariant = 'destructive',
  triggerButtonSize = 'icon',
  triggerButtonClassName,
}: ReportButtonProps) {
  const { config } = useReportCoreContext();
  const [isOpen, setIsOpen] = useState(false);
  const [isChecking] = useState(false);

  const displayItemType =
    config.reportableItems[itemType]?.displayName ?? itemType;

  return (
    <>
      <Button
        variant={triggerButtonVariant as 'destructive'}
        size={triggerButtonSize as 'icon'}
        className={triggerButtonClassName}
        title={`Report ${displayItemType}`}
        disabled={isChecking}
      // The onClick is deliberately NOT here — the consuming app
      // calls handleOpenReport() and passes the current user ID.
      // This prevents report-core from needing to know the auth system.
      >
        {isChecking ? (
          <Loader2 className="spinner-xs" />
        ) : (
          <Flag className="icon-xs" />
        )}
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
 * Use when you need custom trigger UI but want the duplicate-check logic.
 */
export function useReportButton({ itemId, currentUserId }: UseReportButtonOptions) {
  const { checkExisting } = useCheckExistingReport();
  const [isOpen, setIsOpen] = useState(false);
  const [isChecking, setIsChecking] = useState(false);

  const handleOpenReport = async (): Promise<boolean> => {
    if (!currentUserId) return false;

    setIsChecking(true);
    try {
      const exists = await checkExisting(currentUserId, itemId);
      if (exists) return false;
      setIsOpen(true);
      return true;
    } finally {
      setIsChecking(false);
    }
  };

  return {
    isOpen,
    setIsOpen,
    isChecking,
    handleOpenReport,
  };
}
