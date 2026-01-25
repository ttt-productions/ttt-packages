'use client';

import { useFirestoreUpdate } from '@ttt-productions/query-core';
import type { Notification } from '../types.js';

export interface UseMarkAsReadOptions {
  /** User ID */
  userId: string;
  /** Query keys to invalidate after marking as read */
  invalidateKeys?: readonly unknown[][];
}

/**
 * Mark a single notification as read.
 *
 * @example
 * ```tsx
 * const markAsRead = useMarkAsRead({ userId: currentUser.uid });
 * 
 * const handleNotificationClick = (notificationId: string) => {
 *   markAsRead.mutate({ notificationId });
 * };
 * ```
 */
export function useMarkAsRead({
  userId,
  invalidateKeys,
}: UseMarkAsReadOptions) {
  const updateMutation = useFirestoreUpdate<Notification>({
    invalidateKeys: invalidateKeys ?? [
      ['notifications', userId],
      ['notifications-unread-count', userId],
    ],
  });

  return {
    mutate: ({ notificationId }: { notificationId: string }) => {
      updateMutation.mutate({
        docPath: `userData/${userId}/metadata/notifications/${notificationId}`,
        data: { isRead: true },
      });
    },
    mutateAsync: async ({ notificationId }: { notificationId: string }) => {
      return updateMutation.mutateAsync({
        docPath: `userData/${userId}/metadata/notifications/${notificationId}`,
        data: { isRead: true },
      });
    },
    isPending: updateMutation.isPending,
    isError: updateMutation.isError,
    error: updateMutation.error,
  };
}
