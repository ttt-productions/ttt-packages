'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import type {
  ArchiveAllPollResult,
  UseArchiveAllNotificationsOptions,
} from '../../types.js';

const DEFAULT_POLL_INTERVAL_MS = 1500;
const DEFAULT_MAX_POLLS = 120; // ~3 min at the default interval

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Trigger + poll a SERVER-OWNED archive-all job for one notification category.
 *
 * This is a THIN STATUS POLLER, not a client loop. It:
 *   1. enqueues ONE server job via `enqueueArchiveAllFn(category)` (the category — the tab the tray
 *      was invoked on — flows into the job, preserving per-tab scoping: the worker archives ONLY
 *      that category's active cards, never all tabs);
 *   2. polls `getArchiveAllStatusFn(jobId)` until the job reaches a terminal state
 *      (`complete` | `incomplete` | `failed`);
 *   3. resolves an {@link ArchiveAllPollResult} the caller gates side effects on, and invalidates
 *      the read keys on a completed drain.
 *
 * All paging + ownership-checked per-card deletion happen server-side. The hook performs no client
 * Firestore writes and never chains archive calls. The generic package hardcodes no callable name —
 * the app injects both adapters.
 *
 * @example
 * ```tsx
 * const enqueue = httpsCallable(functions, 'enqueueArchiveAll');
 * const getStatus = httpsCallable(functions, 'getArchiveAllStatus');
 * const archiveAll = useArchiveAllNotifications({
 *   userId: user.uid,
 *   category: 'user',
 *   enqueueArchiveAllFn: (category) => enqueue({ category }).then((r) => r.data),
 *   getArchiveAllStatusFn: (jobId) => getStatus({ jobId }).then((r) => r.data),
 * });
 *
 * archiveAll.mutate();
 * ```
 */
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

  return useMutation({
    // Server-owned archive-all: enqueue ONE job scoped to `category`, then poll its status until it
    // reaches a terminal state. No browser loop, no chain of archive transactions. The mutation
    // resolves with an explicit terminal result (never throws for an incomplete drain) — `complete`
    // is the load-bearing flag callers gate post-clear side effects on.
    mutationFn: async (): Promise<ArchiveAllPollResult> => {
      const { jobId } = await enqueueArchiveAllFn(category);

      // Poll until terminal or until the guard bound is hit. A job that never terminates resolves
      // `incomplete` (mirrors the old loop's honest "some remain" result) rather than hanging. The
      // first poll happens immediately so a fast/already-complete job resolves without a delay.
      let lastArchived = 0;
      for (let poll = 0; poll < maxPolls; poll += 1) {
        const snap = await getArchiveAllStatusFn(jobId);
        lastArchived = snap.archived ?? 0;

        if (snap.state === 'complete') {
          return { status: 'complete', category, archived: lastArchived, complete: true };
        }
        if (snap.state === 'incomplete') {
          return { status: 'incomplete', category, archived: lastArchived, complete: false };
        }
        if (snap.state === 'failed') {
          return { status: 'failed', category, archived: lastArchived, complete: false, error: snap.error };
        }

        // Still in-progress — wait before the next poll unless this was the last allowed poll.
        if (poll < maxPolls - 1) await sleep(pollIntervalMs);
      }

      // Guard: the job never reached a terminal state within the poll budget — report incomplete.
      return { status: 'incomplete', category, archived: lastArchived, complete: false };
    },
    onSuccess: (result) => {
      // Only a completed drain changed the active set; still invalidate on an incomplete drain since
      // SOME cards were archived. A hard enqueue/poll failure rejects the mutation (onError), so this
      // never runs for `failed`.
      const keysToInvalidate = invalidateKeys ?? defaultInvalidateKeys;
      keysToInvalidate.forEach((key) => {
        queryClient.invalidateQueries({ queryKey: [...key], exact: false });
      });
      void result;
    },
  });
}
