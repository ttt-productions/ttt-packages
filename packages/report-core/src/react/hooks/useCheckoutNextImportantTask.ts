'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { CheckoutNextImportantTaskResult } from '../../contracts/types-admin-task.js';

interface UseCheckoutNextImportantTaskOptions {
  /** The app's call to its callable, typed and bound once by the app. */
  checkoutNextImportantTaskFn: () => Promise<CheckoutNextImportantTaskResult>;
  /** Current admin user ID — used to invalidate the checked-out tasks query. */
  userId?: string;
}

/**
 * Mutation to check out the highest-priority pending task across all queues; the server picks it.
 */
export function useCheckoutNextImportantTask({
  checkoutNextImportantTaskFn,
  userId,
}: UseCheckoutNextImportantTaskOptions) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (): Promise<CheckoutNextImportantTaskResult> => checkoutNextImportantTaskFn(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['report-core', 'checkedOutTasks', userId] });
    },
  });
}
