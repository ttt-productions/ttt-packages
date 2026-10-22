'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { ReleaseTaskRequest } from '../../schemas/requests.js';
import type { TaskLifecycleResult } from '../../contracts/types-admin-task.js';

interface UseReleaseTaskOptions {
  releaseTaskFn: (input: ReleaseTaskRequest) => Promise<TaskLifecycleResult>;
  userId?: string;
}

export function useReleaseTask({ releaseTaskFn, userId }: UseReleaseTaskOptions) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: ReleaseTaskRequest): Promise<TaskLifecycleResult> => releaseTaskFn(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['report-core', 'checkedOutTasks', userId] });
    },
  });
}
