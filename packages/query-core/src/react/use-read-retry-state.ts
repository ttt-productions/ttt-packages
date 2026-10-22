'use client';

import { useState } from 'react';
import { hashKey, type QueryKey } from '@tanstack/react-query';

export interface ReadRetrySource<TError = Error> {
  error: TError | null | undefined;
  isFetching: boolean;
  isLoading: boolean;
  isPaused?: boolean;
}

export interface ReadRetryState<TError = Error> {
  error: TError | null;
  isRetrying: boolean;
  isLoading: boolean;
}

interface HeldFailure<TError> {
  error: TError;
}

/** A composite source builds a new error object every render, so a failure is compared by name, message, and `code`. */
function sameFailure(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (typeof a !== 'object' || a === null || typeof b !== 'object' || b === null) return false;
  const x = a as { name?: unknown; message?: unknown; code?: unknown };
  const y = b as { name?: unknown; message?: unknown; code?: unknown };
  return x.name === y.name && x.message === y.message && x.code === y.code;
}

export interface ReadRetryEntry<TError = Error> {
  source: ReadRetrySource<TError>;
  queryKey: QueryKey;
}

function nextHeldFailure<TError>(
  held: HeldFailure<TError> | undefined,
  source: ReadRetrySource<TError>,
): HeldFailure<TError> | undefined {
  const live = source.error ?? null;
  if (live !== null)
    return held !== undefined && sameFailure(held.error, live) ? held : { error: live };
  const running = source.isFetching || source.isPaused === true;
  return running ? held : undefined;
}

function toRetryState<TError>(
  source: ReadRetrySource<TError>,
  held: HeldFailure<TError> | undefined,
): ReadRetryState<TError> {
  const error = source.error ?? held?.error ?? null;
  return {
    error,
    isRetrying: error !== null && (source.isFetching || source.isPaused === true),
    isLoading: error === null && source.isLoading,
  };
}

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

/** TanStack clears a never-succeeded query's `error` as its refetch starts, so the failure is held until the retry settles. */
export function useReadRetryState<TError = Error>(
  source: ReadRetrySource<TError>,
  queryKey: QueryKey,
): ReadRetryState<TError> {
  return useReadRetryStates([{ source, queryKey }])[0]!;
}
