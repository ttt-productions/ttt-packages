'use client';

import {
  paginatedPageKey,
  useFirestorePaginated,
  useReadRetryState,
} from '@ttt-productions/query-core/react';
import { orderBy, where, type QueryConstraint } from 'firebase/firestore';
import type { NotificationDoc, UseActiveNotificationsOptions } from '../../types.js';

const DEFAULT_PAGE_SIZE = 20;
const DEFAULT_REFETCH_INTERVAL = 30_000;
const DEFAULT_STALE_TIME = 30_000;

export function useActiveNotifications({
  config,
  userId,
  category,
  enabled = true,
  pageSize = DEFAULT_PAGE_SIZE,
  refetchInterval = DEFAULT_REFETCH_INTERVAL,
  staleTime = DEFAULT_STALE_TIME,
}: UseActiveNotificationsOptions) {
  const categoryConfig = config.categories[category];
  if (!categoryConfig) {
    throw new Error(`[notification-core] Unknown category: ${category}`);
  }

  const collectionPath = categoryConfig.activePath;
  const isPersonal = categoryConfig.audienceType === 'personal';

  const constraints: QueryConstraint[] = [
    ...(isPersonal ? [where('targetUserId', '==', userId)] : []),
    orderBy('updatedAt', 'desc'),
  ];

  const queryKey = ['notifications', 'active', category, userId, { pageSize }];
  const read = useFirestorePaginated<NotificationDoc>({
    collectionPath,
    queryKey,
    constraints,
    pageSize,
    enabled: enabled && !!userId,
    refetchInterval,
    staleTime,
  });
  // A refetch of a never-succeeded page clears `error` while it runs, so the failure is held
  // through the retry.
  return { ...read, retryState: useReadRetryState(read, paginatedPageKey(queryKey, read.page)) };
}
