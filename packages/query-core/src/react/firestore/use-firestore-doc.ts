'use client';

import { useEffect, useRef } from 'react';
import { useQuery, useQueryClient, type UseQueryResult } from '@tanstack/react-query';
import { doc, getDoc, onSnapshot, type DocumentData } from 'firebase/firestore';
import { useFirestoreDb } from './context.js';
import { RESUBSCRIBE_DELAYS_MS, isPermissionDeniedError } from './resubscribe.js';
import { useSubscribedResult, useSubscriptionStatus } from './subscription-status.js';
import { useSerializedIdentity } from './stable-inputs.js';
import type { WithId, WithSourceState } from '../../firestore/types.js';
import type { FirestoreDocOptions } from './types.js';

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
  const stableQueryKey = useSerializedIdentity(queryKey, queryKeyMemo);
  const selectRef = useRef(select);
  selectRef.current = select;

  const subscription = useSubscriptionStatus(
    JSON.stringify([docPath, queryKeyMemo, enabled, subscribe]),
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
      const docRef = doc(db, docPath);
      currentUnsubscribe = onSnapshot(
        docRef,
        { includeMetadataChanges: true },
        (snapshot) => {
          attempt = 0;
          updateStatus({ error: null, restart: null });
          if (snapshot.exists()) {
            const rawData = snapshot.data();
            const dataWithId = { id: snapshot.id, ...rawData };
            const data = selectRef.current ? selectRef.current(dataWithId) : dataWithId;
            queryClient.setQueryData(stableQueryKey, data as WithId<T>);
          } else {
            queryClient.setQueryData(stableQueryKey, null);
          }
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
          console.error('[useFirestoreDoc] Subscription error:', error);
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
    docPath,
    stableQueryKey,
    enabled,
    subscribe,
    restarts,
    queryClient,
    resetStatus,
    updateStatus,
  ]);

  const query = useQuery({
    queryKey,
    queryFn: async (): Promise<WithId<T> | null> => {
      const docRef = doc(db, docPath);
      const snapshot = await getDoc(docRef);

      if (!snapshot.exists()) {
        return null;
      }

      const rawData = snapshot.data();
      const dataWithId = { id: snapshot.id, ...rawData };
      const data = select ? select(dataWithId) : dataWithId;
      return data as WithId<T>;
    },
    enabled: enabled && !subscribe,
    staleTime: subscribe ? Infinity : staleTime,
    gcTime,
  });

  return useSubscribedResult(query, subscribe, enabled, subscription);
}
