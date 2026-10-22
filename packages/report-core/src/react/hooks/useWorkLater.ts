'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { TaskLifecycleResult } from '../../contracts/types-admin-task.js';

interface WorkLaterInput {
  taskId: string;
  extendHours: 24 | 48;
}

interface UseWorkLaterOptions {
  markWorkLaterFn: (input: WorkLaterInput) => Promise<TaskLifecycleResult>;
  userId?: string;
}

export function useWorkLater({ markWorkLaterFn, userId }: UseWorkLaterOptions) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: WorkLaterInput): Promise<TaskLifecycleResult> => markWorkLaterFn(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['report-core', 'checkedOutTasks', userId] });
    },
  });
}
