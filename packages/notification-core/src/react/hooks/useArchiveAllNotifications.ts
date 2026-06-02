'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { UseArchiveAllNotificationsOptions } from '../../types.js';

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
    mutationFn: async () => archiveAllFn(),
    onSuccess: () => {
      const keysToInvalidate = invalidateKeys ?? defaultInvalidateKeys;
      keysToInvalidate.forEach((key) => {
        queryClient.invalidateQueries({ queryKey: [...key], exact: false });
      });
    },
  });
}
