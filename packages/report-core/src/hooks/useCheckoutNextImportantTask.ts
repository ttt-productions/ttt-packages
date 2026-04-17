'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { CheckedOutTask } from '../types.js';

interface CheckoutNextImportantTaskResult {
  success: boolean;
  task: CheckedOutTask;
}

interface UseCheckoutNextImportantTaskOptions {
  /** The callable function invoker. App provides this (e.g. useFunctions().callFunction). */
  callFunction: <TReq, TRes>(name: string, data?: TReq) => Promise<TRes>;
  /** Current admin user ID — used to invalidate checked-out tasks query. */
  userId?: string;
}

/**
 * Mutation to checkout the highest-priority pending task across all queues.
 * The server handler picks the task automatically — no input needed.
 * The app provides the `callFunction` wrapper so report-core
 * doesn't depend on a specific Firebase Functions setup.
 */
export function useCheckoutNextImportantTask({
  callFunction,
  userId,
}: UseCheckoutNextImportantTaskOptions) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (): Promise<CheckoutNextImportantTaskResult> => {
      return callFunction<void, CheckoutNextImportantTaskResult>(
        'checkoutNextImportantTask',
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ['report-core', 'checkedOutTasks', userId],
      });
    },
  });
}
