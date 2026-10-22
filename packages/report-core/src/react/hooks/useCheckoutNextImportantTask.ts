'use client';

import { useQueryClient } from '@tanstack/react-query';
import { useSessionMutation } from '@ttt-productions/query-core/react';
import type { CheckoutNextImportantTaskResult } from '../../contracts/types-admin-task.js';

interface UseCheckoutNextImportantTaskOptions {
  checkoutNextImportantTaskFn: () => Promise<CheckoutNextImportantTaskResult>;
  userId?: string;
}

export function useCheckoutNextImportantTask({
  checkoutNextImportantTaskFn,
  userId,
}: UseCheckoutNextImportantTaskOptions) {
  const queryClient = useQueryClient();

  return useSessionMutation({
    mutationFn: (): Promise<CheckoutNextImportantTaskResult> => checkoutNextImportantTaskFn(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['report-core', 'checkedOutTasks', userId] });
    },
  });
}
