'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { CheckoutTaskRequest } from '../schemas/index.js';
import type { CheckoutTaskResult } from '../types-admin-task.js';

interface UseCheckoutTaskOptions {
  /** The app's call to its callable, typed and bound once by the app. */
  checkoutTaskFn: (input: CheckoutTaskRequest) => Promise<CheckoutTaskResult>;
  /** Current admin user ID — used to invalidate the checked-out tasks query. */
  userId?: string;
}

/**
 * Mutation to check out a task from a queue.
 */
export function useCheckoutTask({ checkoutTaskFn, userId }: UseCheckoutTaskOptions) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: CheckoutTaskRequest): Promise<CheckoutTaskResult> => checkoutTaskFn(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['report-core', 'checkedOutTasks', userId] });
    },
  });
}
