"use client";

import { useState } from 'react';
import { hashKey, type QueryKey } from '@tanstack/react-query';

/** The parts of a read's result the retry state is decided from. */
export interface ReadRetrySource<TError = Error> {
  error: TError | null | undefined;
  isFetching: boolean;
  isLoading: boolean;
  /** A fetch waiting for the network counts as still running. */
  isPaused?: boolean;
}

/** A read's failure as its surface shows it, held on screen while a retry of it runs. */
export interface ReadRetryState<TError = Error> {
  /** The read's failure: its current one, or the last one while a retry of it is running. */
  error: TError | null;
  /** A retry of the failed read is running. */
  isRetrying: boolean;
  /** The read has not answered yet and is not a retry of a failure. */
  isLoading: boolean;
}

interface HeldFailure<TError> {
  identity: string;
  error: TError;
}

/**
 * The failure and retry state of one read. TanStack Query clears the `error` of a query that never
 * succeeded and puts it back to `pending` the moment a refetch of it starts, so a retry state built
 * from `isFetching && error` is never true for a failed first read, and its failure panel turns into
 * a loading state under the retry the person pressed. This holds the read's last failure until the
 * retry settles — an answer clears it, a new failure replaces it — and reports the retry as running
 * meanwhile. The failure belongs to `queryKey`: a read under another key never shows it.
 */
export function useReadRetryState<TError = Error>(
  source: ReadRetrySource<TError>,
  queryKey: QueryKey,
): ReadRetryState<TError> {
  const identity = hashKey(queryKey);
  const live = source.error ?? null;
  const running = source.isFetching || source.isPaused === true;
  const [held, setHeld] = useState<HeldFailure<TError> | null>(null);

  let next = held !== null && held.identity === identity ? held : null;
  if (live !== null) {
    if (next === null || next.error !== live) next = { identity, error: live };
  } else if (!running) {
    next = null;
  }
  // Render-phase adjustment: the held failure follows the read without an effect's extra render.
  if (next !== held) setHeld(next);

  const error = live ?? next?.error ?? null;
  return {
    error,
    isRetrying: error !== null && running,
    isLoading: error === null && source.isLoading,
  };
}
