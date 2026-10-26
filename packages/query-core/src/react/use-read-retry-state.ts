'use client';

import { useState } from 'react';
import { hashKey, type QueryKey } from '@tanstack/react-query';
import {
  nextHeldFailure,
  toRetryState,
  type HeldFailure,
  type ReadRetrySource,
  type ReadRetryState,
} from './read-retry-derivation.js';

export interface ReadRetryEntry<TError = Error> {
  source: ReadRetrySource<TError>;
  queryKey: QueryKey;
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
