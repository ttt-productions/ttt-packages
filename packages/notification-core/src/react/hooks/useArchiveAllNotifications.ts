'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { ArchiveAllLoopResult, UseArchiveAllNotificationsOptions } from '../../types.js';

/**
 * Archive the caller's whole category through an app-supplied callable adapter.
 *
 * Like {@link useArchiveNotification}, this performs no client Firestore writes
 * — paging + ownership-checked deletion happen server-side via the callable the
 * app wires into `archiveAllFn`. On success it invalidates the read keys.
 *
 * @example
 * ```tsx
 * const archiveNotification = httpsCallable(functions, 'archiveNotification');
 * const archiveAll = useArchiveAllNotifications({
 *   userId: user.uid,
 *   category: 'user',
 *   archiveAllFn: () => archiveNotification({ category: 'user', scope: { kind: 'all' } }),
 * });
 *
 * archiveAll.mutate();
 * ```
 */
export function useArchiveAllNotifications({
  userId,
  category,
  archiveAllFn,
  invalidateKeys,
}: UseArchiveAllNotificationsOptions) {
  const queryClient = useQueryClient();

  const defaultInvalidateKeys = [
    ['notifications', 'active', category, userId],
    ['notifications', 'unread-count', category, userId],
    ['notifications', 'history', category, userId],
  ];

  return useMutation({
    // I3: "Clear All" must actually clear ALL — but it must also report HONESTLY when it could not.
    // The server bounds each call to a small page and returns `hasMore`; loop the adapter until the
    // active set is drained (bounded so a pathological tray can't run forever). The loop resolves on
    // an incomplete drain rather than throwing, so it returns an explicit `complete` flag the caller
    // gates side effects on (it is NOT a plain success — see ArchiveAllLoopResult).
    mutationFn: async (): Promise<ArchiveAllLoopResult> => {
      const MAX_PASSES = 25; // bound: 25 × the server page cap — far beyond any real tray
      let archived = 0;
      let hasMore = true;
      let pass = 0;
      while (hasMore && pass < MAX_PASSES) {
        const r = await archiveAllFn();
        archived += r.archived;
        hasMore = r.hasMore;
        pass += 1;
        // No-progress guard: a pass that archived nothing yet still reports `hasMore` cannot make
        // progress on the next pass either (e.g. a generation-less head card the server can never
        // advance past) — looping would livelock to the pass bound. Stop now and report incomplete.
        if (r.archived === 0 && hasMore) break;
      }
      // `complete` is true ONLY when the active set was fully drained (`hasMore` is false). Hitting
      // the pass bound or the no-progress guard with `hasMore` still true returns an EXPLICIT
      // incomplete result, never a plain success.
      return { archived, hasMore, complete: !hasMore };
    },
    onSuccess: () => {
      const keysToInvalidate = invalidateKeys ?? defaultInvalidateKeys;
      keysToInvalidate.forEach((key) => {
        queryClient.invalidateQueries({ queryKey: [...key], exact: false });
      });
    },
  });
}
