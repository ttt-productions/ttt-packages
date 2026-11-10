'use client';

import { useCallback, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useFirestoreCollection, useReadRetryState } from '@ttt-productions/query-core/react';
import { limit, orderBy, where, type QueryConstraint } from 'firebase/firestore';
import type { NotificationDoc, UseActiveNotificationsOptions } from '../../types.js';

export function useActiveNotifications({
  config,
  userId,
  category,
  enabled = true,
  step,
  ceiling,
}: UseActiveNotificationsOptions) {
  const categoryConfig = config.categories[category];
  if (!categoryConfig) {
    throw new Error(`[notification-core] Unknown category: ${category}`);
  }

  const queryClient = useQueryClient();
  const windowKey = useMemo(
    () => ['notifications', 'active-window', category, userId],
    [category, userId],
  );
  const { data: requestedSize } = useQuery<number>({
    queryKey: windowKey,
    initialData: step,
    enabled: false,
    staleTime: Infinity,
  });
  const windowSize = Math.min(requestedSize, ceiling);

  const isPersonal = categoryConfig.audienceType === 'personal';
  const constraints: QueryConstraint[] = [
    ...(isPersonal ? [where('targetUserId', '==', userId)] : []),
    orderBy('updatedAt', 'desc'),
    limit(windowSize + 1),
  ];

  const listening = enabled && !!userId;
  const queryKey = ['notifications', 'active', category, userId];
  const read = useFirestoreCollection<NotificationDoc>({
    collectionPath: categoryConfig.activePath,
    queryKey,
    constraints,
    enabled: listening,
    subscribe: true,
  });

  // Firestore can answer a new listener from its cache before the server does. That copy stands
  // only where it continues an answer this listener already had: a restart, or a growing window.
  const unconfirmed = listening && read.sourceState === 'connecting' && !read.isRefetching;
  const retryState = useReadRetryState(
    { error: read.error, isFetching: read.isFetching, isLoading: read.isLoading || unconfirmed },
    queryKey,
  );

  const answered = unconfirmed ? undefined : read.data;
  const isShowingMore = read.isPlaceholderData;
  const hasOlder = !isShowingMore && answered !== undefined && answered.length > windowSize;

  const rows = useMemo(() => answered?.slice(0, windowSize), [answered, windowSize]);

  const showMore = useCallback(() => {
    queryClient.setQueryData<number>(windowKey, (size) => Math.min((size ?? step) + step, ceiling));
  }, [queryClient, windowKey, step, ceiling]);

  return {
    data: rows,
    sourceState: read.sourceState,
    retryState,
    refetch: read.refetch,
    showMore,
    isShowingMore,
    canShowMore: retryState.error === null && hasOlder && windowSize < ceiling,
    hasOlderBeyondCeiling: hasOlder && windowSize >= ceiling,
  };
}
