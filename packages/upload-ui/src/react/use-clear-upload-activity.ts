'use client';

/**
 * Generic mutation hook to clear a terminal pendingMedia item from the tray.
 *
 * Pure adapter: the consumer supplies `clearFn` (typically a wrapped Firebase
 * callable in the consuming app, or a fetch call elsewhere). The package owns the
 * useMutation wiring and the optional `onError` toast hook; the consumer owns
 * the network call.
 *
 * The provider's Firestore listener observes the `uploadTrayClearedAt` write
 * and removes the item from the tray selector automatically — no optimistic
 * update is needed in this hook.
 */

import { useMutation } from '@tanstack/react-query';

export interface ClearUploadActivityOptions {
  /** Network call performing the clear. Receives the pendingMediaId. */
  clearFn: (pendingMediaId: string) => Promise<void>;
  /** Optional error callback. Receives the error and the pendingMediaId that failed. */
  onError?: (error: Error, pendingMediaId: string) => void;
}

export function useClearUploadActivity(options: ClearUploadActivityOptions) {
  const { clearFn, onError } = options;
  return useMutation<void, Error, string>({
    mutationFn: clearFn,
    onError: (error, pendingMediaId) => {
      onError?.(error, pendingMediaId);
    },
  });
}
