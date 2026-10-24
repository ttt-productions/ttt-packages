'use client';

import { useEffect, useRef } from 'react';
import { useQuery, useQueryClient, type UseQueryResult } from '@tanstack/react-query';
import { collection, query, getDocs, onSnapshot, type DocumentData } from 'firebase/firestore';
import { useFirestoreDb } from './context.js';
import { RESUBSCRIBE_DELAYS_MS, isPermissionDeniedError } from './resubscribe.js';
import { useSubscribedResult, useSubscriptionStatus } from './subscription-status.js';
import { useSerializedIdentity } from './stable-inputs.js';
import type { WithId, WithSourceState } from '../../firestore/types.js';
import type { FirestoreCollectionOptions } from './types.js';

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

  const constraintsMemo = JSON.stringify(constraints);
  const queryKeyMemo = JSON.stringify(queryKey);
  const stableConstraints = useSerializedIdentity(constraints, constraintsMemo);
  const stableQueryKey = useSerializedIdentity(queryKey, queryKeyMemo);
  const selectRef = useRef(select);
  selectRef.current = select;

  const subscription = useSubscriptionStatus(
    JSON.stringify([collectionPath, queryKeyMemo, constraintsMemo, enabled, subscribe]),
  );
  const { reset: resetStatus, update: updateStatus, restarts } = subscription;

  useEffect(() => {
    if (!subscribe || !enabled) return;

    resetStatus();

    let currentUnsubscribe: (() => void) | null = null;
    let retryTimer: ReturnType<typeof setTimeout> | null = null;
    let attempt = 0;
    let disposed = false;

    const start = () => {
      if (disposed) return;
      const collectionRef = collection(db, collectionPath);
      const q =
        stableConstraints.length > 0 ? query(collectionRef, ...stableConstraints) : collectionRef;

      currentUnsubscribe = onSnapshot(
        q,
        { includeMetadataChanges: true },
        (snapshot) => {
          attempt = 0;
          updateStatus({ error: null, restart: null });
          const items = snapshot.docs.map((docSnap) => {
            const rawData = docSnap.data();
            const dataWithId = { id: docSnap.id, ...rawData };
            const data = selectRef.current ? selectRef.current(dataWithId) : dataWithId;
            return data as WithId<T>;
          });
          queryClient.setQueryData(stableQueryKey, items);
          const fromCache = snapshot.metadata?.fromCache ?? false;
          updateStatus((prev) => ({
            sourceState: fromCache
              ? prev.sourceState === 'connecting'
                ? 'connecting'
                : 'offline'
              : 'live',
          }));
        },
        (error) => {
          if (isPermissionDeniedError(error) && attempt < RESUBSCRIBE_DELAYS_MS.length) {
            currentUnsubscribe?.();
            currentUnsubscribe = null;
            const delay = RESUBSCRIBE_DELAYS_MS[attempt];
            attempt += 1;
            updateStatus({ sourceState: 'connecting' });
            retryTimer = setTimeout(start, delay);
            return;
          }
          console.error('[useFirestoreCollection] Subscription error:', error);
          updateStatus({ error, sourceState: 'error', restart: null });
          queryClient.setQueryData(stableQueryKey, undefined);
        },
      );
    };

    start();

    return () => {
      disposed = true;
      if (retryTimer) clearTimeout(retryTimer);
      currentUnsubscribe?.();
    };
  }, [
    db,
    collectionPath,
    stableQueryKey,
    stableConstraints,
    enabled,
    subscribe,
    restarts,
    queryClient,
    resetStatus,
    updateStatus,
  ]);

  const queryResult = useQuery({
    queryKey,
    queryFn: async (): Promise<WithId<T>[]> => {
      const collectionRef = collection(db, collectionPath);
      const q = constraints.length > 0 ? query(collectionRef, ...constraints) : collectionRef;

      const snapshot = await getDocs(q);
      return snapshot.docs.map((docSnap) => {
        const rawData = docSnap.data();
        const dataWithId = { id: docSnap.id, ...rawData };
        const data = select ? select(dataWithId) : dataWithId;
        return data as WithId<T>;
      });
    },
    enabled: enabled && !subscribe,
    staleTime: subscribe ? Infinity : staleTime,
    gcTime,
  });

  return useSubscribedResult(queryResult, subscribe, enabled, subscription);
}
