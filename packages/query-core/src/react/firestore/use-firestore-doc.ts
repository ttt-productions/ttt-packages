'use client';

import { useEffect, useState } from 'react';
import { useQuery, useQueryClient, type UseQueryResult } from '@tanstack/react-query';
import { doc, getDoc, onSnapshot, type DocumentData } from 'firebase/firestore';
import { useFirestoreDb } from './context.js';
import { RESUBSCRIBE_DELAYS_MS, isPermissionDeniedError } from './resubscribe.js';
import type {
  FirestoreDocOptions,
  FirestoreSourceState,
  WithId,
  WithSourceState,
} from '../../firestore/types.js';

/**
 * Fetch a single Firestore document with optional realtime updates.
 * * @example
 * ```tsx
 * // Simple fetch
 * const { data: user } = useFirestoreDoc<User>({
 * docPath: `users/${userId}`,
 * queryKey: ['user', userId],
 * });
 * * // With realtime updates
 * const { data: entity } = useFirestoreDoc<Entity>({
 * docPath: `entities/${entityId}`,
 * queryKey: ['entity', entityId],
 * subscribe: true,
 * });
 * * // Conditional fetch
 * const { data: profile } = useFirestoreDoc<Profile>({
 * docPath: `profiles/${userId}`,
 * queryKey: ['profile', userId],
 * enabled: !!userId,
 * });
 * ```
 */
export function useFirestoreDoc<T extends DocumentData = DocumentData>({
  docPath,
  queryKey,
  enabled = true,
  subscribe = false,
  staleTime,
  gcTime,
  select,
}: FirestoreDocOptions<T>): WithSourceState<UseQueryResult<WithId<T> | null, Error>> {
  const db = useFirestoreDb();
  const queryClient = useQueryClient();
  const queryKeyMemo = JSON.stringify(queryKey);

  // Listener errors can't surface through useQuery (the queryFn is disabled while
  // subscribed), so they're tracked here and merged into the returned result.
  const [subscriptionError, setSubscriptionError] = useState<Error | null>(null);
  // Metadata-derived source state — reset whenever the subscription identity changes.
  const [sourceState, setSourceState] = useState<FirestoreSourceState>('connecting');

  // Set up realtime subscription
  useEffect(() => {
    if (!subscribe || !enabled) return;

    setSubscriptionError(null);
    setSourceState('connecting');

    // Bounded resubscribe: a transient `permission-denied` (e.g. a failed mid-session
    // App Check token refresh) is retried on the RESUBSCRIBE_DELAYS_MS ladder before the
    // error is surfaced. `attempt` resets on any healthy snapshot; `disposed`/timers are
    // cleaned up on unmount so a pending retry never fires after teardown.
    let currentUnsubscribe: (() => void) | null = null;
    let retryTimer: ReturnType<typeof setTimeout> | null = null;
    let attempt = 0;
    let disposed = false;

    const start = () => {
      if (disposed) return;
      const docRef = doc(db, docPath);
      currentUnsubscribe = onSnapshot(
        docRef,
        { includeMetadataChanges: true },
        (snapshot) => {
          attempt = 0;
          setSubscriptionError(null);
          if (snapshot.exists()) {
            const rawData = snapshot.data();
            // Include id in data passed to select, so it can be renamed/transformed
            const dataWithId = { id: snapshot.id, ...rawData };
            const data = select ? select(dataWithId) : dataWithId;
            queryClient.setQueryData(queryKey, data as WithId<T>);
          } else {
            queryClient.setQueryData(queryKey, null);
          }
          const fromCache = snapshot.metadata?.fromCache ?? false;
          setSourceState((prev) => (fromCache ? (prev === 'connecting' ? 'connecting' : 'offline') : 'live'));
        },
        (error) => {
          // Heal a transient permission-denied by resubscribing on the backoff ladder,
          // keeping the last-known data visible. Only surface the error once the ladder
          // is exhausted; any other error surfaces immediately, as before.
          if (isPermissionDeniedError(error) && attempt < RESUBSCRIBE_DELAYS_MS.length) {
            currentUnsubscribe?.();
            currentUnsubscribe = null;
            const delay = RESUBSCRIBE_DELAYS_MS[attempt];
            attempt += 1;
            setSourceState('connecting');
            retryTimer = setTimeout(start, delay);
            return;
          }
          console.error('[useFirestoreDoc] Subscription error:', error);
          setSubscriptionError(error);
          setSourceState('error');
          queryClient.setQueryData(queryKey, undefined);
        }
      );
    };

    start();

    return () => {
      disposed = true;
      if (retryTimer) clearTimeout(retryTimer);
      currentUnsubscribe?.();
    };
    // Note: select intentionally excluded to prevent re-subscribing on every render if the caller
    // passes an inline function. queryKey is tracked via queryKeyMemo above.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [db, docPath, queryKeyMemo, enabled, subscribe, queryClient]);

  const query = useQuery({
    queryKey,
    queryFn: async (): Promise<WithId<T> | null> => {
      const docRef = doc(db, docPath);
      const snapshot = await getDoc(docRef);

      if (!snapshot.exists()) {
        return null;
      }

      const rawData = snapshot.data();
      // Include id in data passed to select, so it can be renamed/transformed
      const dataWithId = { id: snapshot.id, ...rawData };
      const data = select ? select(dataWithId) : dataWithId;
      return data as WithId<T>;
    },
    enabled: enabled && !subscribe, // Don't fetch if subscribing (snapshot handles it)
    staleTime: subscribe ? Infinity : staleTime, // Realtime data is always fresh
    gcTime,
  });

  // Merge a listener error into the result so subscribed consumers see a truthful
  // isError/error/status instead of a forever-pending disabled query.
  if (subscribe && subscriptionError) {
    return {
      ...query,
      data: undefined,
      error: subscriptionError,
      isError: true,
      isLoadingError: true,
      isSuccess: false,
      isPending: false,
      isLoading: false,
      status: 'error',
      sourceState,
    } as WithSourceState<UseQueryResult<WithId<T> | null, Error>>;
  }

  return { ...query, sourceState } as WithSourceState<UseQueryResult<WithId<T> | null, Error>>;
}
