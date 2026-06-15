'use client';

import { useEffect, useState } from 'react';
import { useQuery, useQueryClient, type UseQueryResult } from '@tanstack/react-query';
import {
  collection,
  query,
  getDocs,
  onSnapshot,
  type DocumentData,
} from 'firebase/firestore';
import { useFirestoreDb } from './context.js';
import type {
  FirestoreCollectionOptions,
  FirestoreSourceState,
  WithId,
  WithSourceState,
} from '../../firestore/types.js';

/**
 * Fetch all documents from a Firestore collection with optional realtime updates.
 * Use this for small collections where you need all documents at once.
 * For large collections, use useFirestoreInfinite or useFirestorePaginated.
 * * @example
 * ```tsx
 * // Fetch all channels in an entity
 * const { data: channels } = useFirestoreCollection<Channel>({
 * collectionPath: `entities/${entityId}/channels`,
 * queryKey: ['channels', entityId],
 * constraints: [orderBy('createdAt', 'asc')],
 * });
 * * // With realtime updates
 * const { data: members } = useFirestoreCollection<Member>({
 * collectionPath: `entities/${entityId}/members`,
 * queryKey: ['members', entityId],
 * subscribe: true,
 * });
 * ```
 */
export function useFirestoreCollection<T extends DocumentData = DocumentData>({
  collectionPath,
  queryKey,
  constraints = [],
  enabled = true,
  subscribe = false,
  staleTime,
  gcTime,
  select,
}: FirestoreCollectionOptions<T>): WithSourceState<UseQueryResult<WithId<T>[], Error>> {
  const db = useFirestoreDb();
  const queryClient = useQueryClient();

  // STABILIZE DEPENDENCIES:
  // We stringify these because [where('a', '==', 'b')] !== [where('a', '==', 'b')] in JS.
  const constraintsMemo = JSON.stringify(constraints);
  const queryKeyMemo = JSON.stringify(queryKey);

  // Listener errors can't surface through useQuery (the queryFn is disabled while
  // subscribed), so they're tracked here and merged into the returned result.
  const [subscriptionError, setSubscriptionError] = useState<Error | null>(null);
  // Metadata-derived source state — reset whenever the subscription identity changes.
  const [sourceState, setSourceState] = useState<FirestoreSourceState>('connecting');

  useEffect(() => {
    if (!subscribe || !enabled) return;

    setSubscriptionError(null);
    setSourceState('connecting');
    const collectionRef = collection(db, collectionPath);
    const q = constraints.length > 0
      ? query(collectionRef, ...constraints)
      : collectionRef;

    const unsubscribe = onSnapshot(
      q,
      { includeMetadataChanges: true },
      (snapshot) => {
        setSubscriptionError(null);
        const items = snapshot.docs.map((docSnap) => {
          const rawData = docSnap.data();
          const dataWithId = { id: docSnap.id, ...rawData };
          const data = select ? select(dataWithId) : dataWithId;
          return data as WithId<T>;
        });
        queryClient.setQueryData(queryKey, items);
        const fromCache = snapshot.metadata?.fromCache ?? false;
        setSourceState((prev) => (fromCache ? (prev === 'connecting' ? 'connecting' : 'offline') : 'live'));
      },
      (error) => {
        console.error('[useFirestoreCollection] Subscription error:', error);
        setSubscriptionError(error);
        setSourceState('error');
        queryClient.setQueryData(queryKey, undefined);
      }
    );

    return () => unsubscribe();
    // queryKey & constraints are tracked via their stringified forms above; select is intentionally
    // excluded so an inline caller function doesn't force a re-subscribe on every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [db, collectionPath, queryKeyMemo, constraintsMemo, enabled, subscribe, queryClient]);

  const queryResult = useQuery({
    queryKey,
    queryFn: async (): Promise<WithId<T>[]> => {
      const collectionRef = collection(db, collectionPath);
      const q = constraints.length > 0
        ? query(collectionRef, ...constraints)
        : collectionRef;

      const snapshot = await getDocs(q);
      return snapshot.docs.map((docSnap) => {
        const rawData = docSnap.data();
        // Include id in data passed to select, so it can be renamed/transformed
        const dataWithId = { id: docSnap.id, ...rawData };
        const data = select ? select(dataWithId) : dataWithId;
        return data as WithId<T>;
      });
    },
    enabled: enabled && !subscribe,
    staleTime: subscribe ? Infinity : staleTime,
    gcTime,
  });

  // Merge a listener error into the result so subscribed consumers see a truthful
  // isError/error/status instead of a forever-pending disabled query.
  if (subscribe && subscriptionError) {
    return {
      ...queryResult,
      data: undefined,
      error: subscriptionError,
      isError: true,
      isLoadingError: true,
      isSuccess: false,
      isPending: false,
      isLoading: false,
      status: 'error',
      sourceState,
    } as WithSourceState<UseQueryResult<WithId<T>[], Error>>;
  }

  return { ...queryResult, sourceState } as WithSourceState<UseQueryResult<WithId<T>[], Error>>;
}
