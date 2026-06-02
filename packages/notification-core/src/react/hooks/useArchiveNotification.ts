'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { UseArchiveNotificationOptions } from '../../types.js';

/**
 * Archive a single notification through an app-supplied callable adapter.
 *
 * The notification system is Cloud-Functions-only: clients never write
 * notification docs. This hook performs no Firestore writes — it delegates to
 * `archiveFn` (wired by the app to `httpsCallable(functions, 'archiveNotification')`)
 * and invalidates the read keys on success.
 *
 * @example
 * ```tsx
 * const archiveNotification = httpsCallable(functions, 'archiveNotification');
 * const archive = useArchiveNotification({
 *   userId: user.uid,
 *   category: 'user',
 *   archiveFn: (notificationId) =>
 *     archiveNotification({ category: 'user', scope: { kind: 'single', notificationId } }),
 * });
 *
 * archive.mutate('abc123');
 * ```
 */
export function useArchiveNotification({
  userId,
  category,
  archiveFn,
  invalidateKeys,
}: UseArchiveNotificationOptions) {
  const queryClient = useQueryClient();

  const defaultInvalidateKeys = [
    ['notifications', 'active', category, userId],
    ['notifications', 'unread-count', category, userId],
    ['notifications', 'history', category, userId],
  ];

  return useMutation({
    mutationFn: async (notificationId: string) => archiveFn(notificationId),
    onSuccess: () => {
      const keysToInvalidate = invalidateKeys ?? defaultInvalidateKeys;
      keysToInvalidate.forEach((key) => {
        queryClient.invalidateQueries({ queryKey: [...key], exact: false });
      });
    },
  });
}
