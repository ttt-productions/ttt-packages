'use client';

import { useFirestoreCollection } from '@ttt-productions/query-core';
import { where, orderBy, limit, type QueryConstraint } from 'firebase/firestore';
import type { NotificationDoc, UseUnreadCountOptions } from '../types.js';

const DEFAULT_REFETCH_INTERVAL = 30_000;
const DEFAULT_COUNT_LIMIT = 99;

/**
 * Lightweight unread count query. Fetches up to `countLimit` docs to determine count.
 * Uses polling for cost control.
 *
 * @example
 * ```tsx
 * const { count, isLoading } = useUnreadCount({
 *   config: TTT_NOTIFICATION_CONFIG,
 *   userId: user.uid,
 *   category: 'user',
 * });
 * ```
 */
export function useUnreadCount({
  config,
  userId,
  category,
  enabled = true,
  refetchInterval = DEFAULT_REFETCH_INTERVAL,
  countLimit = DEFAULT_COUNT_LIMIT,
}: UseUnreadCountOptions) {
  const categoryConfig = config.categories[category];
  if (!categoryConfig) {
    throw new Error(`[notification-core] Unknown category: ${category}`);
  }

  const collectionPath = categoryConfig.activePath;
  const isPersonal = categoryConfig.audienceType === 'personal';

  const constraints: QueryConstraint[] = [
    ...(isPersonal ? [where('targetUserId', '==', userId)] : []),
    orderBy('updatedAt', 'desc'),
    limit(countLimit),
  ];

  const { data: notifications, ...rest } = useFirestoreCollection<NotificationDoc>({
    collectionPath,
    queryKey: ['notifications', 'unread-count', category, userId],
    constraints,
    enabled: enabled && !!userId,
    subscribe: false,
    staleTime: refetchInterval,
  });

  return {
    count: notifications?.length ?? 0,
    hasMore: (notifications?.length ?? 0) >= countLimit,
    ...rest,
  };
}
