'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { ArchiveAllResult, UseArchiveAllNotificationsOptions } from '../../types.js';

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
    // I3: "Clear All" must actually clear ALL. The server bounds each call to a small page and
    // returns `hasMore`; loop the adapter until it's drained (bounded so a pathological tray can't
    // run forever), so the mutation resolves — and `onClearAll`/invalidation fire — only when the
    // active set is fully archived.
    mutationFn: async (): Promise<ArchiveAllResult> => {
      const MAX_PASSES = 50; // bound: 50 × the server page cap — far beyond any real tray
      let archived = 0;
      let hasMore = true;
      let pass = 0;
      while (hasMore && pass < MAX_PASSES) {
        const r = await archiveAllFn();
        archived += r.archived;
        hasMore = r.hasMore;
        pass += 1;
      }
      return { archived, hasMore };
    },
    onSuccess: () => {
      const keysToInvalidate = invalidateKeys ?? defaultInvalidateKeys;
      keysToInvalidate.forEach((key) => {
        queryClient.invalidateQueries({ queryKey: [...key], exact: false });
      });
    },
  });
}
