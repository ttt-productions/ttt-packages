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
    select: (data): CheckedOutTask => {
      // Firestore types every document field as any; a checked-out task document has this shape.
      const task = data as CheckedOutTask;
      return {
        id: task.id,
        taskType: task.taskType,
        taskId: task.taskId,
        originalPath: task.originalPath,
        status: task.status,
        checkoutDetails: {
          userId: task.checkoutDetails.userId,
          checkedOutAt: task.checkoutDetails.checkedOutAt,
          expiresAt: task.checkoutDetails.expiresAt,
          workLaterUntil: task.checkoutDetails.workLaterUntil ?? null,
        },
        summary: task.summary,
        priority: task.priority,
        createdAt: task.createdAt,
        lastUpdatedAt: task.lastUpdatedAt,
      };
    },
  });
  return { ...live, retryState: useReadRetryState(live, queryKey) };
}
