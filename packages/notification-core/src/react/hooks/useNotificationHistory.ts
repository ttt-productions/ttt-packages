'use client';

import {
  paginatedPageKey,
  useFirestorePaginated,
  useReadRetryState,
} from '@ttt-productions/query-core/react';
import { orderBy, type QueryConstraint } from 'firebase/firestore';
import type {
  NotificationDoc,
  NotificationHistoryItem,
  UseNotificationHistoryOptions,
} from '../../types.js';

const DEFAULT_PAGE_SIZE = 20;
const DEFAULT_STALE_TIME = 60_000;

export function useNotificationHistory({
  config,
  userId,
  category,
  enabled = true,
  pageSize = DEFAULT_PAGE_SIZE,
  staleTime = DEFAULT_STALE_TIME,
}: UseNotificationHistoryOptions) {
  const categoryConfig = config.categories[category];
  if (!categoryConfig) {
    throw new Error(`[notification-core] Unknown category: ${category}`);
  }

  const collectionPath = categoryConfig.historyPath(userId);

  const constraints: QueryConstraint[] = [orderBy('archivedAt', 'desc')];

  const queryKey = ['notifications', 'history', category, userId, { pageSize }];
  const read = useFirestorePaginated<NotificationHistoryItem>({
    collectionPath,
    queryKey,
    constraints,
    pageSize,
    enabled: enabled && !!userId,
    staleTime,
    select: (data) => {
      const snapshot = (data.archivedSnapshot ?? {}) as NotificationDoc;
      return {
        ...snapshot,
        archiveOccurrenceId: data.id,
        archivedAt: (data.archivedAt as number | undefined) ?? snapshot.updatedAt ?? 0,
      };
    },
  });
  // A refetch of a never-succeeded page clears `error` while it runs, so the failure is held
  // through the retry.
  return { ...read, retryState: useReadRetryState(read, paginatedPageKey(queryKey, read.page)) };
}
