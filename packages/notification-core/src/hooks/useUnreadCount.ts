'use client';

import { useFirestoreCollection } from '@ttt-productions/query-core';
import { where, type QueryConstraint } from 'firebase/firestore';
import type { Notification } from '../types.js';

export interface UseUnreadCountOptions {
  /** User ID to fetch unread count for */
  userId: string;
  /** Enable/disable the query */
  enabled?: boolean;
  /** Enable realtime updates (default: true) */
  subscribe?: boolean;
}

/**
 * Get the count of unread notifications for a user.
 *
 * @example
 * ```tsx
 * const { data: unreadCount } = useUnreadCount({
 *   userId: currentUser.uid,
 *   subscribe: true,
 * });
 * ```
 */
export function useUnreadCount({
  userId,
  enabled = true,
  subscribe = true,
}: UseUnreadCountOptions) {
  const constraints: QueryConstraint[] = [
    where('isRead', '==', false),
  ];

  const { data: notifications } = useFirestoreCollection<Notification>({
    collectionPath: `userData/${userId}/metadata/notifications`,
    queryKey: ['notifications-unread-count', userId],
    constraints,
    enabled: enabled && !!userId,
    subscribe,
  });

  return {
    data: notifications?.length ?? 0,
    notifications,
  };
}
