'use client';

/**
 * Generic mutation hook to mark terminal pendingMedia items as seen in the tray.
 *
 * Pure adapter: the consumer supplies `markFn` (typically a wrapped Firebase
 * callable in the consuming app that writes `uploadTraySeenAt`/`uploadTraySeenBy` on the
 * caller's own terminal pendingMedia docs). The package owns the useMutation
 * wiring and the optional `onError` hook; the consumer owns the network call.
 *
 * The provider's Firestore listener observes the `uploadTraySeenAt` write and
 * updates the in-flight upload records automatically — no optimistic update is
 * needed in this hook. Marking seen is tray UX state, not a sensitive action,
 * so it mirrors `useClearUploadActivity` exactly (no audit event).
 *
 * `markFn` receives the full batch of pendingMediaIds to mark seen at once
 * (typically every currently-unseen terminal item when the File-status tab
 * opens). An empty array is a no-op the consumer's callable can short-circuit.
 */

import { useMutation } from '@tanstack/react-query';

export interface MarkUploadActivitySeenOptions {
  /** Network call performing the mark-seen. Receives the pendingMediaIds. */
  markFn: (pendingMediaIds: string[]) => Promise<void>;
  /** Optional error callback. Receives the error and the ids that failed. */
  onError?: (error: Error, pendingMediaIds: string[]) => void;
}

export function useMarkUploadActivitySeen(options: MarkUploadActivitySeenOptions) {
  const { markFn, onError } = options;
  return useMutation<void, Error, string[]>({
    mutationFn: markFn,
    onError: (error, pendingMediaIds) => {
      onError?.(error, pendingMediaIds);
    },
  });
}
