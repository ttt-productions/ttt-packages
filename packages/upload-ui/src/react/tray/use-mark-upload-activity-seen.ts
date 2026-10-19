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
 * The mutation takes every id to mark (typically every currently-unseen terminal
 * item when the File-status tab opens) and sends them to `markFn` in sequential
 * calls of at most `maxIdsPerCall` — the app's own per-call cap, so no call is
 * refused for its size. A failed call does not stop the rest: its ids simply stay
 * unseen. When any call failed, the mutation fails, and `onError` receives the first
 * failure and every id left unmarked. An empty array makes no call.
 */

import { useMutation } from '@tanstack/react-query';

export interface MarkUploadActivitySeenOptions {
  /** Network call performing the mark-seen for at most `maxIdsPerCall` pendingMediaIds. */
  markFn: (pendingMediaIds: string[]) => Promise<void>;
  /** The most ids one `markFn` call accepts — the app's own per-call cap. */
  maxIdsPerCall: number;
  /** Optional error callback. Receives the first failure and every id that was not marked. */
  onError?: (error: Error, pendingMediaIds: string[]) => void;
}

/** The mutation's failure when one or more calls failed: the first failure, and the ids left unmarked. */
export class MarkUploadActivitySeenError extends Error {
  readonly failure: Error;
  readonly unmarkedIds: string[];

  constructor(failure: Error, unmarkedIds: string[]) {
    super(failure.message);
    this.name = 'MarkUploadActivitySeenError';
    this.failure = failure;
    this.unmarkedIds = unmarkedIds;
  }
}

async function markInBatches(
  markFn: (pendingMediaIds: string[]) => Promise<void>,
  maxIdsPerCall: number,
  pendingMediaIds: string[],
): Promise<void> {
  if (!Number.isInteger(maxIdsPerCall) || maxIdsPerCall < 1) {
    throw new Error(`maxIdsPerCall must be a positive whole number, got ${maxIdsPerCall}.`);
  }
  let firstFailure: Error | null = null;
  const unmarkedIds: string[] = [];
  for (let start = 0; start < pendingMediaIds.length; start += maxIdsPerCall) {
    const batch = pendingMediaIds.slice(start, start + maxIdsPerCall);
    try {
      await markFn(batch);
    } catch (err) {
      firstFailure ??= err instanceof Error ? err : new Error(String(err));
      unmarkedIds.push(...batch);
    }
  }
  if (firstFailure) throw new MarkUploadActivitySeenError(firstFailure, unmarkedIds);
}

export function useMarkUploadActivitySeen(options: MarkUploadActivitySeenOptions) {
  const { markFn, maxIdsPerCall, onError } = options;
  return useMutation<void, Error, string[]>({
    mutationFn: (pendingMediaIds) => markInBatches(markFn, maxIdsPerCall, pendingMediaIds),
    onError: (error, pendingMediaIds) => {
      if (error instanceof MarkUploadActivitySeenError) onError?.(error.failure, error.unmarkedIds);
      else onError?.(error, pendingMediaIds);
    },
  });
}
