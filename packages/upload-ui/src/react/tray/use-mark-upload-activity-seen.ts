'use client';

import { useSessionMutation, type MutationSession } from '@ttt-productions/query-core/react';

export interface MarkUploadActivitySeenOptions {
  markFn: (pendingMediaIds: string[]) => Promise<void>;
  maxIdsPerCall: number;
  onError?: (error: Error, pendingMediaIds: string[]) => void;
}

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
  session: MutationSession,
): Promise<void> {
  if (!Number.isInteger(maxIdsPerCall) || maxIdsPerCall < 1) {
    throw new Error(`maxIdsPerCall must be a positive whole number, got ${maxIdsPerCall}.`);
  }
  let firstFailure: Error | null = null;
  const unmarkedIds: string[] = [];
  for (let start = 0; start < pendingMediaIds.length; start += maxIdsPerCall) {
    const batch = pendingMediaIds.slice(start, start + maxIdsPerCall);
    session.assertCurrent();
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
  return useSessionMutation<void, Error, string[]>({
    mutationFn: (pendingMediaIds, { session }) =>
      markInBatches(markFn, maxIdsPerCall, pendingMediaIds, session),
    onError: (error, pendingMediaIds) => {
      if (error instanceof MarkUploadActivitySeenError) onError?.(error.failure, error.unmarkedIds);
      else onError?.(error, pendingMediaIds);
    },
  });
}
