'use client';

import type { MutationKey } from '@tanstack/react-query';
import { useSessionMutation } from '@ttt-productions/query-core/react';

export interface ClearUploadActivityOptions {
  clearFn: (pendingMediaId: string) => Promise<void>;
  onError?: (error: Error, pendingMediaId: string) => void;
  mutationKey?: MutationKey;
}

export function useClearUploadActivity(options: ClearUploadActivityOptions) {
  const { clearFn, onError, mutationKey } = options;
  return useSessionMutation<void, Error, string>({
    mutationKey,
    mutationFn: clearFn,
    onError: (error, pendingMediaId) => {
      onError?.(error, pendingMediaId);
    },
  });
}
