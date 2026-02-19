'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';

interface WorkLaterInput {
  taskId: string;
  taskType: string;
  extendHours: 24 | 48;
}

interface UseWorkLaterOptions {
  callFunction: <TReq, TRes>(name: string, data?: TReq) => Promise<TRes>;
  userId?: string;
}

/**
 * Mutation to mark a task as "work later" — extends the checkout
 * expiration so the admin can come back to it.
 */
export function useWorkLater({ callFunction, userId }: UseWorkLaterOptions) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: WorkLaterInput): Promise<{ success: boolean }> => {
      return callFunction<WorkLaterInput, { success: boolean }>('markWorkLater', input);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['report-core', 'checkedOutTasks', userId] });
    },
  });
}
