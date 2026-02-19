'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';

interface ReleaseTaskInput {
  taskId: string;
}

interface UseReleaseTaskOptions {
  callFunction: <TReq, TRes>(name: string, data?: TReq) => Promise<TRes>;
  userId?: string;
}

/**
 * Mutation to release a checked-out task back to the pending queue.
 */
export function useReleaseTask({ callFunction, userId }: UseReleaseTaskOptions) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: ReleaseTaskInput): Promise<{ success: boolean }> => {
      return callFunction<ReleaseTaskInput, { success: boolean }>('releaseTask', input);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['report-core', 'checkedOutTasks', userId] });
    },
  });
}
