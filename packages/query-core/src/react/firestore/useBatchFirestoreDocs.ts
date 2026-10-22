'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useQueries, useQueryClient } from '@tanstack/react-query';
import type { Firestore } from 'firebase/firestore';
import { isListenerOwned, listenerErrorOf, subscribeDoc } from './doc-subscription-registry.js';
import { getDocLoader } from './batch-doc-loader.js';
import { ABSENT_RETRY_DELAYS_MS, trackAbsentDoc } from './absence-scheduler.js';
import type { BatchFirestoreDocOutcome } from '../../firestore/types.js';
import { useReadRetryStates, type ReadRetrySource } from '../use-read-retry-state.js';

export type BatchFirestoreDocsTransport = 'batch' | 'get';

export type BatchFirestoreDocsOptions = {
  db: Firestore;

  collectionPath: string;

  ids: string[];

  queryKeyPrefix: string;

  staleTime?: number;

  gcTime?: number;

  enabled?: boolean;

  subscribe?: boolean;

  /** `'get'` is required where rules gate reads on `resource.data`: there an id-list query is denied wholesale. */
  transport?: BatchFirestoreDocsTransport;

  absentStaleTime?: number;

  absentRetryDelaysMs?: readonly number[];
};

export type BatchFirestoreDocsResult<T> = {
  data: Record<string, T>;

  isLoading: boolean;

  isError: boolean;

  error: Error | null;

  outcomes: Record<string, BatchFirestoreDocOutcome<T>>;

  failedReadsRunning: boolean;

  refetch: () => Promise<void>;
};

const LOADING_OUTCOME = { status: 'loading' } as const;
const IDLE_SOURCE: ReadRetrySource<Error> = { error: null, isFetching: false, isLoading: false };
const ABSENT_OUTCOME = { status: 'absent' } as const;

function sameOutcome<T>(a: BatchFirestoreDocOutcome<T>, b: BatchFirestoreDocOutcome<T>): boolean {
  if (a.status !== b.status) return false;
  if (a.status === 'present') return a.data === (b as { data: T }).data;
  if (a.status === 'failed') {
    const other = b as { error: Error; retrying: boolean };
    return a.error === other.error && a.retrying === other.retrying;
  }
  return true;
}

function shallowRecordEqual<T>(a: Record<string, T>, b: Record<string, T>): boolean {
  const aKeys = Object.keys(a);
  if (aKeys.length !== Object.keys(b).length) return false;
  for (const key of aKeys) {
    if (!Object.prototype.hasOwnProperty.call(b, key) || a[key] !== b[key]) return false;
  }
  return true;
}

export function useBatchFirestoreDocs<T extends Record<string, any>>({
  db,
  collectionPath,
  ids,
  queryKeyPrefix,
  staleTime = 30 * 60 * 1000,
  gcTime = 60 * 60 * 1000,
  enabled = true,
  subscribe = false,
  transport = 'batch',
  absentStaleTime = 30 * 1000,
  absentRetryDelaysMs = ABSENT_RETRY_DELAYS_MS,
}: BatchFirestoreDocsOptions): BatchFirestoreDocsResult<T> {
  const queryClient = useQueryClient();

  const idsKey = JSON.stringify(ids);

  const uniqueIds = useMemo(() => {
    const parsed: string[] = JSON.parse(idsKey);
    return Array.from(new Set(parsed.filter(Boolean)));
  }, [idsKey]);

  const [subscribeErrors, setSubscribeErrors] = useState<Record<string, Error>>({});
  // Query observers notify on React Query's batched microtask; bumping state here shows a snapshot in the tick it lands.
  const [, setSnapshotVersion] = useState(0);

  const results = useQueries({
    queries: uniqueIds.map((id) => ({
      queryKey: [queryKeyPrefix, id],
      queryFn: async ({ signal }: { signal: AbortSignal }): Promise<T | null> => {
        const loader = getDocLoader(queryClient, db, collectionPath);
        const loaded =
          transport === 'get'
            ? await loader.loadOne(id, signal)
            : await loader.loadBatched(id, signal);
        // `onSnapshot` does not re-emit until the document changes, so a read that lands after a listener took the key yields to it.
        if (isListenerOwned(queryClient, queryKeyPrefix, id)) {
          const listenerError = listenerErrorOf(queryClient, queryKeyPrefix, id);
          if (listenerError) throw listenerError;
          const owned = queryClient.getQueryData([queryKeyPrefix, id]);
          if (owned !== undefined) return owned as T | null;
        }
        return loaded as T | null;
      },
      enabled: enabled && !subscribe,
      // Opts back into refetch-on-mount (the package default is off) so a remount re-reads a stale id.
      refetchOnMount: !subscribe,
      staleTime: subscribe
        ? Infinity
        : (query: { state: { data: unknown } }) =>
            query.state.data === null ? absentStaleTime : staleTime,
      gcTime,
    })),
  });

  useEffect(() => {
    if (!subscribe || !enabled || uniqueIds.length === 0) return;
    setSubscribeErrors({});
    const unsubscribers = uniqueIds.map((id) =>
      subscribeDoc({
        queryClient,
        db,
        collectionPath,
        queryKeyPrefix,
        id,
        onUpdate: () => {
          setSubscribeErrors((errors) => {
            if (!(id in errors)) return errors;
            const { [id]: _cleared, ...rest } = errors;
            return rest;
          });
          setSnapshotVersion((version) => version + 1);
        },
        onError: (error) =>
          setSubscribeErrors((errors) =>
            errors[id] === error ? errors : { ...errors, [id]: error },
          ),
      }),
    );
    return () => {
      for (const unsubscribe of unsubscribers) unsubscribe();
    };
  }, [uniqueIds, subscribe, enabled, collectionPath, queryKeyPrefix, queryClient, db]);

  const absentDelaysKey = absentRetryDelaysMs.join(',');
  const absentDelays = useMemo(
    () => absentDelaysKey.split(',').filter(Boolean).map(Number),
    [absentDelaysKey],
  );

  useEffect(() => {
    if (uniqueIds.length === 0) return;
    const releases = uniqueIds.map((id) =>
      trackAbsentDoc({ queryClient, queryKey: [queryKeyPrefix, id], delays: absentDelays }),
    );
    return () => {
      for (const release of releases) release();
    };
  }, [uniqueIds, queryKeyPrefix, queryClient, absentDelays]);

  // Only the effect writes these refs, so a concurrent render React discards never leaves them on an uncommitted map.
  const committedDataRef = useRef<Record<string, T>>({});
  const committedOutcomesRef = useRef<Record<string, BatchFirestoreDocOutcome<T>>>({});

  // TanStack clears a never-answered read's error as its refetch starts, so the failure is held through the retry.
  const retryStates = useReadRetryStates(
    uniqueIds.map((id, index) => ({
      source: (results[index] ?? IDLE_SOURCE) as ReadRetrySource<Error>,
      queryKey: [queryKeyPrefix, id],
    })),
  );

  const nextData: Record<string, T> = {};
  const nextOutcomes: Record<string, BatchFirestoreDocOutcome<T>> = {};
  let anyError: Error | null = null;
  let anyListenerError: Error | null = null;
  let oneShotLoading = false;
  let anyUnresolved = false;
  let failedReadsRunning = false;

  for (let index = 0; index < uniqueIds.length; index += 1) {
    const id = uniqueIds[index];
    const result = results[index];
    let outcome: BatchFirestoreDocOutcome<T> = LOADING_OUTCOME;
    const listenerError =
      (subscribe ? subscribeErrors[id] : undefined) ??
      listenerErrorOf(queryClient, queryKeyPrefix, id) ??
      undefined;
    if (
      result &&
      (result.isFetching || result.isPaused) &&
      result.errorUpdatedAt > result.dataUpdatedAt
    ) {
      failedReadsRunning = true;
    }
    const retryState = retryStates[index];
    if (result?.isError) anyError ??= result.error as Error;
    if (retryState && retryState.error !== null) {
      outcome = { status: 'failed', error: retryState.error, retrying: retryState.isRetrying };
    } else if (result) {
      if (result.isLoading) oneShotLoading = true;
      const value = result.data as T | null | undefined;
      if (value === undefined) anyUnresolved = true;
      if (listenerError) {
        anyListenerError ??= listenerError;
        outcome = { status: 'failed', error: listenerError, retrying: false };
      } else if (value === null) {
        outcome = ABSENT_OUTCOME;
      } else if (value !== undefined) {
        nextData[id] = value;
        outcome = { status: 'present', data: value };
      }
    }
    const committed = committedOutcomesRef.current[id];
    nextOutcomes[id] = committed && sameOutcome(committed, outcome) ? committed : outcome;
  }

  const data = shallowRecordEqual(committedDataRef.current, nextData)
    ? committedDataRef.current
    : nextData;
  const outcomes = shallowRecordEqual(committedOutcomesRef.current, nextOutcomes)
    ? committedOutcomesRef.current
    : nextOutcomes;

  useEffect(() => {
    committedDataRef.current = data;
    committedOutcomesRef.current = outcomes;
  }, [data, outcomes]);

  const refetch = useCallback(async () => {
    if (subscribe || !enabled) return;
    await Promise.all(
      uniqueIds.map((id) =>
        queryClient.refetchQueries({ queryKey: [queryKeyPrefix, id], exact: true }),
      ),
    );
  }, [uniqueIds, subscribe, enabled, queryClient, queryKeyPrefix]);

  const isLoading = subscribe ? enabled && anyUnresolved : oneShotLoading;

  return {
    data,
    isLoading,
    isError: anyError !== null || anyListenerError !== null,
    error: anyError ?? anyListenerError,
    outcomes,
    failedReadsRunning,
    refetch,
  };
}
