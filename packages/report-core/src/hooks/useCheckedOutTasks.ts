'use client';

import { where, orderBy } from 'firebase/firestore';
import { useFirestoreCollection, useReadRetryState } from '@ttt-productions/query-core/react';
import { useReportCoreContext } from '../context/ReportCoreProvider.js';
import type { CheckedOutTask } from '../types.js';

/**
 * Fetches the tasks checked out by the given admin user, live.
 *
 * Realtime via query-core's `useFirestoreCollection({ subscribe: true })` — the
 * list updates instantly on any change (including a backend lease-expiry status
 * flip) with no polling. The countdown UI ticks client-side over the cached
 * `expiresAt`, so it does not need the data layer to refetch.
 *
 * `retryState` holds the listener's failure through its `refetch` (which restarts the listener):
 * the restart clears `error` while it reconnects, so a failure seat built from it would vanish under
 * the Try again that started it. A subscribed collection never turns its own `isLoading` on, so
 * loading is "no snapshot and no failure".
 */
export function useCheckedOutTasks(userId: string | undefined) {
  const { config } = useReportCoreContext();

  const queryKey = ['report-core', 'checkedOutTasks', userId];
  const live = useFirestoreCollection<CheckedOutTask>({
    collectionPath: config.collections.adminTasks,
    queryKey,
    constraints: userId
      ? [
          where('checkoutDetails.userId', '==', userId),
          where('status', 'in', ['checkedOut', 'workLater']),
          orderBy('priority', 'desc'),
          orderBy('createdAt', 'asc'),
        ]
      : [],
    enabled: !!userId,
    subscribe: true,
    select: (data) =>
      ({
        id: data.id,
        taskType: data.taskType,
        taskId: data.taskId,
        originalPath: data.originalPath,
        status: data.status,
        checkoutDetails: {
          userId: data.checkoutDetails.userId,
          checkedOutAt: data.checkoutDetails.checkedOutAt,
          expiresAt: data.checkoutDetails.expiresAt,
          workLaterUntil: data.checkoutDetails.workLaterUntil ?? null,
        },
        summary: data.summary,
        priority: data.priority,
        createdAt: data.createdAt,
        lastUpdatedAt: data.lastUpdatedAt,
      }) as CheckedOutTask,
  });
  const error = live.error ?? null;
  const isLoading = !!userId && live.data === undefined && error === null;
  const retryState = useReadRetryState({ error, isFetching: live.isFetching, isLoading }, queryKey);
  return { ...live, retryState };
}
