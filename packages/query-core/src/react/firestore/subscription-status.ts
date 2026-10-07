'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { QueryObserverResult, RefetchOptions, UseQueryResult } from '@tanstack/react-query';
import type { FirestoreSourceState, WithSourceState } from '../../firestore/types.js';

/** A restart a subscribed result's `refetch()` asked for, open until the listener's first snapshot or its next error. */
interface PendingRestart {
  /** The listener had failed: its last data is not shown as current while the restart is open. */
  fromError: boolean;
}

interface SubscriptionStatus {
  identity: string;
  error: Error | null;
  sourceState: FirestoreSourceState;
  restart: PendingRestart | null;
  /** Bumped by every restart; the listener effect depends on it, so a bump re-opens the listener. */
  restarts: number;
}

type StatusPatch = Partial<Omit<SubscriptionStatus, 'identity' | 'restarts'>>;

function freshStatus(identity: string): SubscriptionStatus {
  return { identity, error: null, sourceState: 'connecting', restart: null, restarts: 0 };
}

/**
 * A realtime listener's source state and error, tagged to the subscription identity that
 * produced them. A new identity reads `connecting` with no error from its first render;
 * writes made for a retired identity are dropped once the new identity's listener has
 * started (it calls `reset`).
 *
 * `restart()` clears the error and bumps `restarts`; the listener effect re-opens on the bump,
 * and its first snapshot or next surfaced error ends the restart (`settled` in the patch).
 */
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

  // The identity the hook renders now. A `restart` captured under an earlier identity must not
  // touch the current one's status, or every write the current listener makes would be dropped.
  const renderedIdentity = useRef(identity);
  useEffect(() => {
    renderedIdentity.current = identity;
  }, [identity]);

  /** Re-opens the listener; false (and nothing changes) when this identity is no longer rendered. */
  const restart = useCallback((): boolean => {
    if (renderedIdentity.current !== identity) return false;
    setStatus((prev) => {
      const base = prev.identity === identity ? prev : freshStatus(identity);
      return {
        ...base,
        error: null,
        sourceState: 'connecting',
        restart: { fromError: base.error !== null || base.restart?.fromError === true },
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

/**
 * The subscribed hooks' result: the query's own result, with the listener's error and source
 * state merged in. In subscribe mode `refetch()` re-opens the listener (clearing its error, with a
 * fresh resubscribe ladder) and resolves once the re-opened listener delivers its first snapshot or
 * surfaces its next error; until then the result reports fetching. A restart after a failure shows
 * no data until that snapshot: the failed listener's last rows are not presented as current.
 */
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
      // An unmounted hook, or a refetch captured under an identity the hook has left, re-opens
      // nothing: it settles at once rather than waiting on a listener that will never report.
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

  let result: UseQueryResult<TData, Error>;
  if (!subscribe) {
    result = query;
  } else if (error) {
    result = {
      ...query,
      data: undefined,
      error,
      isError: true,
      isLoadingError: true,
      isSuccess: false,
      isPending: false,
      isLoading: false,
      status: 'error',
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

  // A refetch still open when the hook unmounts resolves with the last result instead of hanging.
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
