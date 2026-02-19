'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';

interface CheckinTaskInput {
  taskId: string;
  resolved: boolean;
  resolution?: string;
}

interface UseCheckinTaskOptions {
  callFunction: <TReq, TRes>(name: string, data?: TReq) => Promise<TRes>;
  userId?: string;
}

/**
 * Mutation to checkin (complete or unresolved-return) a task.
 */
export function useCheckinTask({ callFunction, userId }: UseCheckinTaskOptions) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: CheckinTaskInput): Promise<{ success: boolean }> => {
      return callFunction<CheckinTaskInput, { success: boolean }>('checkinTask', input);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['report-core', 'checkedOutTasks', userId] });
    },
  });
}
