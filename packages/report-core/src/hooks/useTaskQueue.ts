'use client';

import { useQuery } from '@tanstack/react-query';
import {
  collection,
  query,
  where,
  orderBy,
  getDocs,
  limit,
  startAfter,
  type QueryConstraint,
} from 'firebase/firestore';
import { useReportCoreContext } from '../context/ReportCoreProvider.js';
import type { AdminTask } from '../types.js';

const DEFAULT_PAGE_SIZE = 10;

interface UseTaskQueueOptions {
  taskType: string;
  page?: number;
  pageSize?: number;
  /** Additional where filters (e.g. status filter). */
  statusFilter?: string;
}

/**
 * Browse a task queue with pagination.
 * Returns tasks of the given type, ordered by priority (desc) then createdAt (asc).
 */
export function useTaskQueue({
  taskType,
  page = 1,
  pageSize = DEFAULT_PAGE_SIZE,
  statusFilter = 'pending',
}: UseTaskQueueOptions) {
  const { config, db } = useReportCoreContext();

  return useQuery<{ tasks: AdminTask[]; hasMore: boolean }, Error>({
    queryKey: ['report-core', 'taskQueue', taskType, statusFilter, page, pageSize],
    queryFn: async () => {
      const tasksRef = collection(db, config.collections.adminTasks);
      const queryLimit = pageSize + 1; // fetch one extra to detect "hasMore"

      const baseConstraints: QueryConstraint[] = [
        where('taskType', '==', taskType),
        where('status', '==', statusFilter),
        orderBy('priority', 'desc'),
        orderBy('createdAt', 'asc'),
      ];

      let q;
      if (page > 1) {
        // Skip to the right offset by fetching previous pages
        const prevQuery = query(tasksRef, ...baseConstraints, limit((page - 1) * pageSize));
        const prevSnapshot = await getDocs(prevQuery);
        const lastVisible = prevSnapshot.docs[prevSnapshot.docs.length - 1];
        if (lastVisible) {
          q = query(tasksRef, ...baseConstraints, startAfter(lastVisible), limit(queryLimit));
        } else {
          q = query(tasksRef, ...baseConstraints, limit(queryLimit));
        }
      } else {
        q = query(tasksRef, ...baseConstraints, limit(queryLimit));
      }

      const snapshot = await getDocs(q);
      const tasks: AdminTask[] = snapshot.docs.map((docSnap) => {
        const data = docSnap.data();
        return {
          id: docSnap.id,
          taskType: data.taskType,
          taskId: data.taskId,
          originalPath: data.originalPath,
          status: data.status,
          checkoutDetails: data.checkoutDetails ?? null,
          summary: data.summary,
          priority: data.priority,
          createdAt: data.createdAt,
          lastUpdatedAt: data.lastUpdatedAt,
          completedAt: data.completedAt,
        } as AdminTask;
      });

      const hasMore = tasks.length > pageSize;
      if (hasMore) tasks.pop();

      return { tasks, hasMore };
    },
    staleTime: 2 * 60 * 1000, // 2 minutes
  });
}
