'use client';

import { useFirestorePaginated } from '@ttt-productions/query-core';
import { orderBy, type QueryConstraint } from 'firebase/firestore';
import type { NotificationHistoryDoc, UseNotificationHistoryOptions } from '../types.js';

const DEFAULT_PAGE_SIZE = 20;

/**
 * Paginated fetch of notification history (archived notifications).
 * No polling — history is a static archive.
 *
 * @example
 * ```tsx
 * const { data, page, nextPage, hasNextPage } = useNotificationHistory({
 *   config: TTT_NOTIFICATION_CONFIG,
 *   userId: user.uid,
 *   category: 'user',
 * });
 * ```
 */
export function useNotificationHistory({
  config,
  userId,
  category,
  enabled = true,
  pageSize = DEFAULT_PAGE_SIZE,
}: UseNotificationHistoryOptions) {
  const categoryConfig = config.categories[category];
  if (!categoryConfig) {
    throw new Error(`[notification-core] Unknown category: ${category}`);
  }

  const collectionPath = categoryConfig.historyPath(userId);

  const constraints: QueryConstraint[] = [
    orderBy('archival.archivedAt', 'desc'),
  ];

  return useFirestorePaginated<NotificationHistoryDoc>({
    collectionPath,
    queryKey: ['notifications', 'history', category, userId, { pageSize }],
    constraints,
    pageSize,
    enabled: enabled && !!userId,
  });
}
