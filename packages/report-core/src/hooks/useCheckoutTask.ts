'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';

interface CheckoutTaskInput {
  taskType: string;
  specificTaskId?: string;
}

interface CheckoutTaskResult {
  success: boolean;
  task: Record<string, unknown>;
}

interface UseCheckoutTaskOptions {
  /** The callable function invoker. App provides this (e.g. useFunctions().callFunction). */
  callFunction: <TReq, TRes>(name: string, data?: TReq) => Promise<TRes>;
  /** Current admin user ID — used to invalidate checked-out tasks query. */
  userId?: string;
}

/**
 * Mutation to checkout a task from a queue.
 * The app provides the `callFunction` wrapper so report-core
 * doesn't depend on a specific Firebase Functions setup.
 */
export function useCheckoutTask({ callFunction, userId }: UseCheckoutTaskOptions) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: CheckoutTaskInput): Promise<CheckoutTaskResult> => {
      return callFunction<CheckoutTaskInput, CheckoutTaskResult>('checkoutTask', input);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['report-core', 'checkedOutTasks', userId] });
    },
  });
}
