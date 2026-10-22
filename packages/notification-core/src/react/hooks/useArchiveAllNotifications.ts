'use client';

import { useQueryClient } from '@tanstack/react-query';
import { useSessionMutation } from '@ttt-productions/query-core/react';
import type { ArchiveAllPollResult, UseArchiveAllNotificationsOptions } from '../../types.js';

const DEFAULT_POLL_INTERVAL_MS = 1500;
const DEFAULT_MAX_POLLS = 120;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function useArchiveAllNotifications({
  userId,
  category,
  enqueueArchiveAllFn,
  getArchiveAllStatusFn,
  pollIntervalMs = DEFAULT_POLL_INTERVAL_MS,
  maxPolls = DEFAULT_MAX_POLLS,
  invalidateKeys,
}: UseArchiveAllNotificationsOptions) {
  const queryClient = useQueryClient();

  const defaultInvalidateKeys = [
    ['notifications', 'active', category, userId],
    ['notifications', 'unread-count', category, userId],
    ['notifications', 'history', category, userId],
  ];

  return useSessionMutation({
    mutationFn: async (_: void, { session }): Promise<ArchiveAllPollResult> => {
      const { jobId } = await enqueueArchiveAllFn(category);

      let lastArchived = 0;
      for (let poll = 0; poll < maxPolls; poll += 1) {
        session.assertCurrent();
        const snap = await getArchiveAllStatusFn(jobId);
        lastArchived = snap.archived ?? 0;

        if (snap.state === 'complete') {
          return {
            status: 'complete',
            category,
            archived: lastArchived,
            notArchived: snap.notArchived ?? 0,
            complete: true,
          };
        }
        if (snap.state === 'incomplete') {
          return {
            status: 'incomplete',
            category,
            archived: lastArchived,
            notArchived: 0,
            complete: false,
          };
        }
        if (snap.state === 'failed') {
          return {
            status: 'failed',
            category,
            archived: lastArchived,
            notArchived: 0,
            complete: false,
            error: snap.error,
          };
        }

        if (poll < maxPolls - 1) await sleep(pollIntervalMs);
      }

      return {
        status: 'incomplete',
        category,
        archived: lastArchived,
        notArchived: 0,
        complete: false,
      };
    },
    onSuccess: (result) => {
      const keysToInvalidate = invalidateKeys ?? defaultInvalidateKeys;
      keysToInvalidate.forEach((key) => {
        queryClient.invalidateQueries({ queryKey: [...key], exact: false });
      });
      void result;
    },
  });
}
