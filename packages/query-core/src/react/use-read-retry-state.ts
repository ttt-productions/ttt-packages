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
  error: TError;
}

/**
 * One failure is its name, message, and `code`, not its object: a composite source that builds its
 * error in render hands back a new object for the same failure every render, and holding each one
 * as new would set state on every render without end.
 */
function sameFailure(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (typeof a !== 'object' || a === null || typeof b !== 'object' || b === null) return false;
  const x = a as { name?: unknown; message?: unknown; code?: unknown };
  const y = b as { name?: unknown; message?: unknown; code?: unknown };
  return x.name === y.name && x.message === y.message && x.code === y.code;
}

/** One read a keyed retry state follows: its result and its identity. */
export interface ReadRetryEntry<TError = Error> {
  source: ReadRetrySource<TError>;
  queryKey: QueryKey;
}

/** The failure a read holds next, given what it held: its live failure, or the held one while it runs. */
function nextHeldFailure<TError>(
  held: HeldFailure<TError> | undefined,
  source: ReadRetrySource<TError>,
): HeldFailure<TError> | undefined {
  const live = source.error ?? null;
  if (live !== null) return held !== undefined && sameFailure(held.error, live) ? held : { error: live };
  const running = source.isFetching || source.isPaused === true;
  return running ? held : undefined;
}

function toRetryState<TError>(source: ReadRetrySource<TError>, held: HeldFailure<TError> | undefined): ReadRetryState<TError> {
  const error = source.error ?? held?.error ?? null;
  return {
    error,
    isRetrying: error !== null && (source.isFetching || source.isPaused === true),
    isLoading: error === null && source.isLoading,
  };
}

/**
 * The failure and retry state of each of several reads, in entry order — the keyed form of
 * `useReadRetryState` for a set whose size changes between renders (a `useQueries` list, a batch
 * of per-id reads). Each read's failure is held under its own `queryKey`, so one read's retry
 * never shows another's failure, and a read that leaves the set drops what it held.
 */
export function useReadRetryStates<TError = Error>(
  entries: readonly ReadRetryEntry<TError>[],
): ReadRetryState<TError>[] {
  const [held, setHeld] = useState<Readonly<Record<string, HeldFailure<TError>>>>({});

  const next: Record<string, HeldFailure<TError>> = {};
  const states = entries.map(({ source, queryKey }) => {
    const identity = hashKey(queryKey);
    const failure = nextHeldFailure(held[identity], source);
    if (failure !== undefined) next[identity] = failure;
    return toRetryState(source, failure);
  });
  // Render-phase adjustment: the held failures follow the reads without an effect's extra render.
  if (!sameHeld(held, next)) setHeld(next);
  return states;
}

function sameHeld<TError>(
  a: Readonly<Record<string, HeldFailure<TError>>>,
  b: Readonly<Record<string, HeldFailure<TError>>>,
): boolean {
  const keys = Object.keys(a);
  return keys.length === Object.keys(b).length && keys.every((key) => a[key] === b[key]);
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
  return useReadRetryStates([{ source, queryKey }])[0]!;
}
