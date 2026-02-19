'use client';

import { useMutation } from '@tanstack/react-query';
import { doc, setDoc } from 'firebase/firestore';
import { useReportCoreContext } from '../context/ReportCoreProvider.js';
import type { Report } from '../types.js';

interface SubmitReportInput {
  reportId: string;
  reporterUserId: string;
  reporterUsername: string;
  itemType: string;
  itemId: string;
  parentItemId?: string;
  reportedUserId?: string;
  reportedUsername?: string;
  reason: string;
  comment: string;
}

/**
 * Mutation hook to submit a new report to Firestore.
 */
export function useReportSubmit() {
  const { config, db } = useReportCoreContext();

  return useMutation({
    mutationFn: async (input: SubmitReportInput) => {
      const reportData: Report = {
        reportId: input.reportId,
        reporterUserId: input.reporterUserId,
        reporterUsername: input.reporterUsername,
        reportedItemType: input.itemType,
        reportedItemId: input.itemId,
        ...(input.parentItemId && { parentItemId: input.parentItemId }),
        ...(input.reportedUserId && { reportedUserId: input.reportedUserId }),
        ...(input.reportedUsername && { reportedUsername: input.reportedUsername }),
        reason: input.reason,
        comment: input.comment.trim(),
        createdAt: Date.now(),
        status: 'pending_review',
      };

      const reportRef = doc(db, config.collections.reports, input.reportId);
      await setDoc(reportRef, reportData);

      return reportData;
    },
  });
}
