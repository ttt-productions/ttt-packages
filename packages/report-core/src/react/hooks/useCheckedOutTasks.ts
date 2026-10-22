'use client';

import { where, orderBy } from 'firebase/firestore';
import { useFirestoreCollection, useReadRetryState } from '@ttt-productions/query-core/react';
import { useReportCoreContext } from '../context/ReportCoreProvider.js';
import type { CheckedOutTask } from '../../contracts/types-admin-task.js';

/** `refetch` restarts the listener and clears `error` while it reconnects; `retryState` keeps the failure through it. */
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
  return { ...live, retryState: useReadRetryState(live, queryKey) };
}
