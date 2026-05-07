'use client';

import { useMutation } from '@tanstack/react-query';
import { useReportCoreContext } from '../context/ReportCoreProvider.js';
import type { Report } from '../types.js';
import type { CreateContentReportRequest } from '../schemas/index.js';

interface SubmitReportInput {
  reporterUserId: string;
  itemType: string;
  itemId: string;
  parentItemId?: string;
  reportedUserId?: string;
  reason: string;
  comment: string;
}

interface CreateContentReportResult {
  success: boolean;
  reportId: string;
}

/**
 * Mutation hook to submit a new content report via callable.
 *
 * Migrated from direct setDoc to a callable-only flow per Phase 3F lockdown.
 * The callable computes reportId server-side as `${uid}_${itemId}` and throws
 * ALREADY_REPORTED if the same user has an open report on the same item.
 */
export function useReportSubmit() {
  const { callFunction } = useReportCoreContext();

  return useMutation({
    mutationFn: async (input: SubmitReportInput): Promise<Report> => {
      const request: CreateContentReportRequest = {
        reportedItemType: input.itemType,
        reportedItemId: input.itemId,
        ...(input.parentItemId ? { parentItemId: input.parentItemId } : {}),
        ...(input.reportedUserId ? { reportedUserId: input.reportedUserId } : {}),
        reason: input.reason,
        comment: input.comment,
      };

      try {
        const result = await callFunction<CreateContentReportRequest, CreateContentReportResult>(
          'createContentReport',
          request,
        );

        return {
          reportId: result.reportId,
          reporterUserId: input.reporterUserId,
          reportedItemType: input.itemType,
          reportedItemId: input.itemId,
          ...(input.parentItemId && { parentItemId: input.parentItemId }),
          ...(input.reportedUserId && { reportedUserId: input.reportedUserId }),
          reason: input.reason,
          comment: input.comment.trim(),
          createdAt: Date.now(),
          status: 'pending_review',
        };
      } catch (err) {
        // Surface the existing ALREADY_REPORTED contract.
        // ttt-prod's onCall wrapper rethrows handler errors with the original
        // message, so `err.message === 'ALREADY_REPORTED'` propagates.
        // Firebase Functions errors arrive as { code, message } — handle both.
        const message = err instanceof Error ? err.message : String(err);
        if (message.includes('ALREADY_REPORTED')) {
          throw new Error('ALREADY_REPORTED');
        }
        throw err;
      }
    },
  });
}
