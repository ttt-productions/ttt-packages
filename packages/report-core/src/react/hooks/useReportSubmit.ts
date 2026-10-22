'use client';

import { useSessionMutation } from '@ttt-productions/query-core/react';
import { useReportCoreContext } from '../context/ReportCoreProvider.js';
import type { SubmitReportRequest, SubmitReportResult } from '../../schemas/requests.js';

interface SubmitReportInput {
  itemType: string;
  itemId: string;
  parentItemId?: string;
  reportedUserId?: string;
  reason: string;
  comment: string;
  confirmUpgrade?: boolean;
}

export function useReportSubmit() {
  const { submitReportFn } = useReportCoreContext();

  return useSessionMutation({
    mutationFn: async (input: SubmitReportInput): Promise<SubmitReportResult> => {
      const request: SubmitReportRequest = {
        itemType: input.itemType,
        reportedItemId: input.itemId,
        ...(input.parentItemId ? { parentItemId: input.parentItemId } : {}),
        ...(input.reportedUserId ? { reportedUserId: input.reportedUserId } : {}),
        reason: input.reason,
        ...(input.comment ? { comment: input.comment } : {}),
        ...(input.confirmUpgrade ? { confirmUpgrade: true } : {}),
      };

      return submitReportFn(request);
    },
  });
}
