'use client';

import { useMutation, type MutationKey } from '@tanstack/react-query';

export interface ClearUploadActivityOptions {
  clearFn: (pendingMediaId: string) => Promise<void>;
  onError?: (error: Error, pendingMediaId: string) => void;
  mutationKey?: MutationKey;
}

export function useClearUploadActivity(options: ClearUploadActivityOptions) {
  const { clearFn, onError, mutationKey } = options;
  return useMutation<void, Error, string>({
    mutationKey,
    mutationFn: clearFn,
    onError: (error, pendingMediaId) => {
      onError?.(error, pendingMediaId);
    },
  });
}
