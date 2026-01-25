'use client';

import { useFirestoreCollection } from '@ttt-productions/query-core';
import { orderBy, limit, where, type QueryConstraint } from 'firebase/firestore';
import type { Notification } from '../types.js';

export interface UseNotificationsOptions {
  /** User ID to fetch notifications for */
  userId: string;
  /** Enable/disable the query */
  enabled?: boolean;
  /** Enable realtime updates (default: true) */
  subscribe?: boolean;
  /** Maximum number of notifications to fetch (default: 50) */
  limit?: number;
  /** Only fetch unread notifications */
  unreadOnly?: boolean;
}

/**
 * Fetch user notifications with optional realtime updates.
 *
 * @example
 * ```tsx
 * const { data: notifications, isLoading } = useNotifications({
 *   userId: currentUser.uid,
 *   subscribe: true,
 * });
 * ```
 */
export function useNotifications({
  userId,
  enabled = true,
  subscribe = true,
  limit: maxResults = 50,
  unreadOnly = false,
}: UseNotificationsOptions) {
  const constraints: QueryConstraint[] = [
    orderBy('createdAt', 'desc'),
    limit(maxResults),
  ];

  if (unreadOnly) {
    constraints.unshift(where('isRead', '==', false));
  }

  return useFirestoreCollection<Notification>({
    collectionPath: `userData/${userId}/metadata/notifications`,
    queryKey: ['notifications', userId, { unreadOnly, limit: maxResults }],
    constraints,
    enabled: enabled && !!userId,
    subscribe,
  });
}
