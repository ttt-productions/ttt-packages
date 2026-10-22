'use client';

import { useQueryClient } from '@tanstack/react-query';
import { useSessionMutation } from '@ttt-productions/query-core/react';
import type { CheckinTaskRequest } from '../../schemas/requests.js';
import type { TaskLifecycleResult } from '../../contracts/types-admin-task.js';

interface UseCheckinTaskOptions {
  checkinTaskFn: (input: CheckinTaskRequest) => Promise<TaskLifecycleResult>;
  userId?: string;
}

export function useCheckinTask({ checkinTaskFn, userId }: UseCheckinTaskOptions) {
  const queryClient = useQueryClient();

  return useSessionMutation({
    mutationFn: (input: CheckinTaskRequest): Promise<TaskLifecycleResult> => checkinTaskFn(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['report-core', 'checkedOutTasks', userId] });
    },
  });
}
