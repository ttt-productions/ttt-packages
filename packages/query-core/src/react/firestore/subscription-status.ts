'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { QueryObserverResult, RefetchOptions, UseQueryResult } from '@tanstack/react-query';
import type { FirestoreSourceState, WithSourceState } from '../../firestore/types.js';
import { isPermissionDeniedError } from './resubscribe.js';

interface PendingRestart {
  fromError: boolean;
  failure: Error | null;
}

interface SubscriptionStatus {
  identity: string;
  error: Error | null;
  sourceState: FirestoreSourceState;
  restart: PendingRestart | null;
  restarts: number;
}

type StatusPatch = Partial<Omit<SubscriptionStatus, 'identity' | 'restarts'>>;

function freshStatus(identity: string): SubscriptionStatus {
  return { identity, error: null, sourceState: 'connecting', restart: null, restarts: 0 };
}

export function useSubscriptionStatus(identity: string) {
  const [status, setStatus] = useState<SubscriptionStatus>(() => freshStatus(identity));

  const current: SubscriptionStatus = status.identity === identity ? status : freshStatus(identity);

  const reset = useCallback(() => {
    setStatus((prev) =>
      prev.identity === identity
        ? { ...prev, error: null, sourceState: 'connecting' }
        : freshStatus(identity),
    );
  }, [identity]);

  const update = useCallback(
    (patch: StatusPatch | ((prev: SubscriptionStatus) => StatusPatch)) => {
      setStatus((prev) => {
        if (prev.identity !== identity) return prev;
        const next = typeof patch === 'function' ? patch(prev) : patch;
        return { ...prev, ...next };
      });
    },
    [identity],
  );

  const renderedIdentity = useRef(identity);
  useEffect(() => {
    renderedIdentity.current = identity;
  }, [identity]);

  const restart = useCallback((): boolean => {
    if (renderedIdentity.current !== identity) return false;
    setStatus((prev) => {
      const base = prev.identity === identity ? prev : freshStatus(identity);
      return {
        ...base,
        error: null,
        sourceState: 'connecting',
        restart: {
          fromError: base.error !== null || base.restart?.fromError === true,
          failure: base.error ?? base.restart?.failure ?? null,
        },
        restarts: base.restarts + 1,
      };
    });
    return true;
  }, [identity]);

  return {
    error: current.error,
    sourceState: current.sourceState,
    pendingRestart: current.restart,
    restarts: current.restarts,
    reset,
    update,
    restart,
  };
}

type SubscriptionStatusApi = ReturnType<typeof useSubscriptionStatus>;

interface RefetchWaiter<TData> {
  resolve: (result: QueryObserverResult<TData, Error>) => void;
  reject: (error: Error) => void;
  throwOnError: boolean;
}

export function useSubscribedResult<TData>(
  query: UseQueryResult<TData, Error>,
  subscribe: boolean,
  enabled: boolean,
  status: SubscriptionStatusApi,
): WithSourceState<UseQueryResult<TData, Error>> {
  const { error, sourceState, pendingRestart, restart } = status;
  const waiters = useRef<RefetchWaiter<TData>[]>([]);
  const latest = useRef(query as QueryObserverResult<TData, Error>);
  const mounted = useRef(true);
  const active = subscribe && enabled;

  const refetch = useCallback(
    (options?: RefetchOptions): Promise<QueryObserverResult<TData, Error>> => {
      if (!active || !mounted.current) return Promise.resolve(latest.current);
      return new Promise((resolve, reject) => {
        if (!restart()) {
          resolve(latest.current);
          return;
        }
        waiters.current.push({ resolve, reject, throwOnError: options?.throwOnError === true });
      });
    },
    [active, restart],
  );

  const denied = isPermissionDeniedError(error ?? pendingRestart?.failure);
  const holdable = query.data !== undefined && !denied;

  let result: UseQueryResult<TData, Error>;
  if (!subscribe) {
    result = query;
  } else if (error) {
    const held = holdable;
    result = {
      ...query,
      data: held ? query.data : undefined,
      error,
      isError: true,
      isLoadingError: !held,
      isRefetchError: held,
      isSuccess: false,
      isPending: false,
      isLoading: false,
      status: 'error',
      refetch,
    } as UseQueryResult<TData, Error>;
  } else if (pendingRestart?.fromError && holdable) {
    result = {
      ...query,
      error: pendingRestart.failure,
      isError: pendingRestart.failure !== null,
      isLoadingError: false,
      isRefetchError: pendingRestart.failure !== null,
      isSuccess: false,
      isPending: false,
      isLoading: false,
      isFetching: true,
      isRefetching: true,
      status: pendingRestart.failure !== null ? 'error' : query.status,
      fetchStatus: 'fetching',
      refetch,
    } as UseQueryResult<TData, Error>;
  } else if (pendingRestart?.fromError) {
    result = {
      ...query,
      data: undefined,
      error: null,
      isError: false,
      isLoadingError: false,
      isRefetchError: false,
      isSuccess: false,
      isPending: true,
      isLoading: true,
      isFetching: true,
      isRefetching: false,
      status: 'pending',
      fetchStatus: 'fetching',
      refetch,
    } as UseQueryResult<TData, Error>;
  } else if (pendingRestart) {
    result = {
      ...query,
      isFetching: true,
      isLoading: query.isPending,
      isRefetching: !query.isPending,
      fetchStatus: 'fetching',
      refetch,
    } as UseQueryResult<TData, Error>;
  } else if (active && query.isPending) {
    // The query underneath is disabled in subscribe mode, so it reports pending but not loading.
    result = {
      ...query,
      isLoading: true,
      isFetching: true,
      fetchStatus: 'fetching',
      refetch,
    } as UseQueryResult<TData, Error>;
  } else {
    result = { ...query, refetch } as UseQueryResult<TData, Error>;
  }

  const restartOpen = pendingRestart !== null;
  useEffect(() => {
    latest.current = result as QueryObserverResult<TData, Error>;
    if (restartOpen || waiters.current.length === 0) return;
    const settled = waiters.current;
    waiters.current = [];
    for (const waiter of settled) {
      if (waiter.throwOnError && result.error) waiter.reject(result.error);
      else waiter.resolve(result as QueryObserverResult<TData, Error>);
    }
  });

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      const settled = waiters.current;
      waiters.current = [];
      for (const waiter of settled) waiter.resolve(latest.current);
    };
  }, []);

  return { ...result, sourceState } as WithSourceState<UseQueryResult<TData, Error>>;
}
