'use client';

import { useCallback, useEffect, useMemo, useRef, useSyncExternalStore } from 'react';
import type {
  QueryClient,
  QueryKey,
  QueryObserverResult,
  RefetchOptions,
  UseQueryResult,
} from '@tanstack/react-query';
import type { DocumentData } from 'firebase/firestore';
import type { FirestoreSourceState, WithSourceState } from '../../firestore/types.js';
import { isPermissionDeniedError } from './resubscribe.js';
import { queryHashOf } from './query-hash.js';
import {
  acquireLiveRead,
  liveReadStatusFor,
  restartLiveRead,
  retargetLiveRead,
  sharedLiveReadStatus,
  watchLiveRead,
  type LiveReadTarget,
  type PendingRestart,
} from './live-read-registry.js';

const noWatch = () => () => {};

export interface LiveReadParams {
  queryClient: QueryClient;
  queryKey: QueryKey;
  target: LiveReadTarget;
  select: { readonly current: ((data: DocumentData & { id: string }) => unknown) | undefined };
  active: boolean;
}

export function useLiveReadStatus({
  queryClient,
  queryKey,
  target,
  select,
  active,
}: LiveReadParams): SubscriptionStatusView {
  const key = useMemo(() => queryHashOf(queryClient, queryKey), [queryClient, queryKey]);
  const targetRef = useRef(target);
  targetRef.current = target;

  const watch = useCallback(
    (onChange: () => void) => watchLiveRead(queryClient, key, onChange),
    [queryClient, key],
  );
  const readShared = () => (active ? sharedLiveReadStatus(queryClient, key) : null);
  const shared = useSyncExternalStore(active ? watch : noWatch, readShared, readShared);
  const status = liveReadStatusFor(shared, target);

  useEffect(() => {
    if (!active) return;
    return acquireLiveRead({ queryClient, key, queryKey, target: targetRef.current, select });
  }, [active, queryClient, key, queryKey, select]);

  const { db, signature } = target;
  useEffect(() => {
    if (active) retargetLiveRead(queryClient, key, targetRef.current);
  }, [active, queryClient, key, db, signature]);

  const rendered = useRef({ key, signature, db });
  useEffect(() => {
    rendered.current = { key, signature, db };
  }, [key, signature, db]);

  const restart = useCallback((): boolean => {
    const current = rendered.current;
    if (current.key !== key || current.signature !== signature || current.db !== db) return false;
    return restartLiveRead(queryClient, key, { db, path: target.path, signature });
  }, [queryClient, key, signature, db, target.path]);

  return {
    carried: status.carried,
    error: status.error,
    sourceState: status.sourceState,
    pendingRestart: status.restart,
    restart,
  };
}

export interface SubscriptionStatusView {
  carried: boolean;
  error: Error | null;
  sourceState: FirestoreSourceState;
  pendingRestart: PendingRestart | null;
  restart: () => boolean;
}

interface RefetchWaiter<TData> {
  resolve: (result: QueryObserverResult<TData, Error>) => void;
  reject: (error: Error) => void;
  throwOnError: boolean;
}

export function useSubscribedResult<TData>(
  query: UseQueryResult<TData, Error>,
  subscribe: boolean,
  enabled: boolean,
  status: SubscriptionStatusView,
): WithSourceState<UseQueryResult<TData, Error>> {
  const { carried, error, sourceState, pendingRestart, restart } = status;
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
  } else if (active && carried && sourceState === 'connecting' && query.data !== undefined) {
    result = {
      ...query,
      isPlaceholderData: true,
      isFetching: true,
      isRefetching: true,
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
