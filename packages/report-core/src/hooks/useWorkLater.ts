'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { TaskLifecycleResult } from '../types-admin-task.js';

interface WorkLaterInput {
  taskId: string;
  extendHours: 24 | 48;
}

interface UseWorkLaterOptions {
  /** The app's call to its callable, typed and bound once by the app. */
  markWorkLaterFn: (input: WorkLaterInput) => Promise<TaskLifecycleResult>;
  /** Current admin user ID — used to invalidate the checked-out tasks query. */
  userId?: string;
}

/**
 * Mutation to mark a task as "work later" — extends the checkout expiration so the admin can come back to it.
 */
export function useWorkLater({ markWorkLaterFn, userId }: UseWorkLaterOptions) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: WorkLaterInput): Promise<TaskLifecycleResult> => markWorkLaterFn(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['report-core', 'checkedOutTasks', userId] });
    },
  });
}
