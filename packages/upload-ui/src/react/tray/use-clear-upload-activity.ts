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
 *
 * The returned object is the standard `useMutation` result (`mutate`,
 * `mutateAsync`, `isPending`, …). Pass `mutationKey` to register the clear in
 * React Query's shared `MutationCache` under a stable key, so a consumer can
 * read per-item pending with `useMutationState` (the pendingMediaId is the
 * mutation variables) — pending that survives the clearing row unmounting.
 */

import { useMutation, type MutationKey } from '@tanstack/react-query';

export interface ClearUploadActivityOptions {
  /** Network call performing the clear. Receives the pendingMediaId. */
  clearFn: (pendingMediaId: string) => Promise<void>;
  /** Optional error callback. Receives the error and the pendingMediaId that failed. */
  onError?: (error: Error, pendingMediaId: string) => void;
  /**
   * Optional stable key for the underlying mutation, registering it in the
   * shared `MutationCache` so pending can be read with `useMutationState`.
   * Omitted ⇒ an unkeyed mutation (the prior behavior).
   */
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
