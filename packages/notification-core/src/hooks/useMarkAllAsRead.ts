'use client';

import { useFirestoreBatch } from '@ttt-productions/query-core';
import type { MutationOperation } from '@ttt-productions/query-core';

export interface UseMarkAllAsReadOptions {
  /** User ID */
  userId: string;
  /** Query keys to invalidate after marking all as read */
  invalidateKeys?: readonly unknown[][];
}

/**
 * Mark all unread notifications as read in a batch operation.
 *
 * @example
 * ```tsx
 * const markAllAsRead = useMarkAllAsRead({ userId: currentUser.uid });
 * 
 * const handleMarkAllRead = (unreadNotifications: Notification[]) => {
 *   markAllAsRead.mutate({ notifications: unreadNotifications });
 * };
 * ```
 */
export function useMarkAllAsRead({
  userId,
  invalidateKeys,
}: UseMarkAllAsReadOptions) {
  const batchMutation = useFirestoreBatch({
    invalidateKeys: invalidateKeys ?? [
      ['notifications', userId],
      ['notifications-unread-count', userId],
    ],
  });

  return {
    mutate: ({ notificationIds }: { notificationIds: string[] }) => {
      const operations: MutationOperation[] = notificationIds.map((id) => ({
        type: 'update' as const,
        docPath: `userData/${userId}/metadata/notifications/${id}`,
        data: { isRead: true },
      }));

      batchMutation.mutate({ operations });
    },
    mutateAsync: async ({ notificationIds }: { notificationIds: string[] }) => {
      const operations: MutationOperation[] = notificationIds.map((id) => ({
        type: 'update' as const,
        docPath: `userData/${userId}/metadata/notifications/${id}`,
        data: { isRead: true },
      }));

      return batchMutation.mutateAsync({ operations });
    },
    isPending: batchMutation.isPending,
    isError: batchMutation.isError,
    error: batchMutation.error,
  };
}
