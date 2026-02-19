'use client';

import { useQuery } from '@tanstack/react-query';
import { collection, query, where, orderBy, getDocs } from 'firebase/firestore';
import { useReportCoreContext } from '../context/ReportCoreProvider.js';
import type { CheckedOutTask } from '../types.js';

/**
 * Fetches tasks checked out by the given admin user.
 * Polls every 30 seconds to keep countdown timers roughly accurate.
 */
export function useCheckedOutTasks(userId: string | undefined) {
  const { config, db } = useReportCoreContext();

  return useQuery<CheckedOutTask[], Error>({
    queryKey: ['report-core', 'checkedOutTasks', userId],
    queryFn: async () => {
      if (!userId) return [];

      const tasksRef = collection(db, config.collections.adminTasks);
      const q = query(
        tasksRef,
        where('checkoutDetails.userId', '==', userId),
        where('status', 'in', ['checkedOut', 'workLater']),
        orderBy('priority', 'desc'),
        orderBy('createdAt', 'asc'),
      );

      const snapshot = await getDocs(q);

      return snapshot.docs.map((docSnap) => {
        const data = docSnap.data();
        return {
          id: docSnap.id,
          taskType: data.taskType,
          taskId: data.taskId,
          originalPath: data.originalPath,
          status: data.status,
          checkoutDetails: {
            userId: data.checkoutDetails.userId,
            userDisplayName: data.checkoutDetails.userDisplayName,
            userPhotoURL: data.checkoutDetails.userPhotoURL,
            checkedOutAt: data.checkoutDetails.checkedOutAt,
            expiresAt: data.checkoutDetails.expiresAt,
            workLaterUntil: data.checkoutDetails.workLaterUntil ?? null,
          },
          summary: data.summary,
          priority: data.priority,
          createdAt: data.createdAt,
          lastUpdatedAt: data.lastUpdatedAt,
        } as CheckedOutTask;
      });
    },
    enabled: !!userId,
    refetchInterval: 30_000,
    staleTime: 0,
  });
}
