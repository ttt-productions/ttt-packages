'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { CheckoutTaskRequest } from '../../schemas/requests.js';
import type { CheckoutTaskResult } from '../../contracts/types-admin-task.js';

interface UseCheckoutTaskOptions {
  checkoutTaskFn: (input: CheckoutTaskRequest) => Promise<CheckoutTaskResult>;
  userId?: string;
}

export function useCheckoutTask({ checkoutTaskFn, userId }: UseCheckoutTaskOptions) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: CheckoutTaskRequest): Promise<CheckoutTaskResult> => checkoutTaskFn(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['report-core', 'checkedOutTasks', userId] });
    },
  });
}
