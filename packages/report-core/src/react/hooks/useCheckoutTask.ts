'use client';

import { useQueryClient } from '@tanstack/react-query';
import { useSessionMutation } from '@ttt-productions/query-core/react';
import type { CheckoutTaskRequest } from '../../schemas/requests.js';
import type { CheckoutTaskResult } from '../../contracts/types-admin-task.js';

interface UseCheckoutTaskOptions {
  checkoutTaskFn: (input: CheckoutTaskRequest) => Promise<CheckoutTaskResult>;
  userId?: string;
}

export function useCheckoutTask({ checkoutTaskFn, userId }: UseCheckoutTaskOptions) {
  const queryClient = useQueryClient();

  return useSessionMutation({
    mutationFn: (input: CheckoutTaskRequest): Promise<CheckoutTaskResult> => checkoutTaskFn(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['report-core', 'checkedOutTasks', userId] });
    },
  });
}
