'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import type {
  NotificationArchiveResult,
  NotificationDoc,
  UseArchiveNotificationOptions,
} from '../../types.js';
import { archiveRefreshKeys } from '../query-keys.js';

/**
 * Archive a single rendered notification through an app-supplied callable adapter.
 *
 * The notification system is Cloud-Functions-only: clients never write notification
 * docs. This hook performs no Firestore writes — it delegates to `archiveFn` with the
 * row as rendered, resolves the adapter's `{ archived }` answer, and invalidates the
 * read keys on success.
 */
export function useArchiveNotification({
  userId,
  category,
  archiveFn,
  queryKeys,
  invalidateKeys,
}: UseArchiveNotificationOptions) {
  const queryClient = useQueryClient();

  return useMutation<NotificationArchiveResult, Error, NotificationDoc>({
    mutationFn: (notification: NotificationDoc) => archiveFn(notification),
    onSuccess: () => {
      const keysToInvalidate = invalidateKeys ?? archiveRefreshKeys(queryKeys, category, userId);
      keysToInvalidate.forEach((key) => {
        queryClient.invalidateQueries({ queryKey: [...key], exact: false });
      });
    },
  });
}
