'use client';

import { useQueryClient } from '@tanstack/react-query';
import { useSessionMutation } from '@ttt-productions/query-core/react';
import type {
  NotificationArchiveResult,
  NotificationDoc,
  UseArchiveNotificationOptions,
} from '../../types.js';

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

  return useSessionMutation<NotificationArchiveResult, Error, NotificationDoc>({
    mutationFn: (notification: NotificationDoc) => archiveFn(notification),
    onSuccess: () => {
      const keysToInvalidate = invalidateKeys ?? defaultInvalidateKeys;
      keysToInvalidate.forEach((key) => {
        queryClient.invalidateQueries({ queryKey: [...key], exact: false });
      });
    },
  });
}
