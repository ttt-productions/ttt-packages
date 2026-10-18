'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { CheckinTaskRequest } from '../schemas/index.js';
import type { TaskLifecycleResult } from '../types-admin-task.js';

interface UseCheckinTaskOptions {
  /** The app's call to its callable, typed and bound once by the app. */
  checkinTaskFn: (input: CheckinTaskRequest) => Promise<TaskLifecycleResult>;
  /** Current admin user ID — used to invalidate the checked-out tasks query. */
  userId?: string;
}

/**
 * Mutation to check in (complete or unresolved-return) a task.
 */
export function useCheckinTask({ checkinTaskFn, userId }: UseCheckinTaskOptions) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: CheckinTaskRequest): Promise<TaskLifecycleResult> => checkinTaskFn(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['report-core', 'checkedOutTasks', userId] });
    },
  });
}
