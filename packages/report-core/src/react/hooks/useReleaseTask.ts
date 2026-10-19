'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { ReleaseTaskRequest } from '../../schemas/requests.js';
import type { TaskLifecycleResult } from '../../contracts/types-admin-task.js';

interface UseReleaseTaskOptions {
  /** The app's call to its callable, typed and bound once by the app. */
  releaseTaskFn: (input: ReleaseTaskRequest) => Promise<TaskLifecycleResult>;
  /** Current admin user ID — used to invalidate the checked-out tasks query. */
  userId?: string;
}

/**
 * Mutation to release a checked-out task back to the pending queue.
 */
export function useReleaseTask({ releaseTaskFn, userId }: UseReleaseTaskOptions) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: ReleaseTaskRequest): Promise<TaskLifecycleResult> => releaseTaskFn(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['report-core', 'checkedOutTasks', userId] });
    },
  });
}
