'use client';

import { useRef } from 'react';
import { useQuery, useQueryClient, type UseQueryResult } from '@tanstack/react-query';
import { doc, getDoc, type DocumentData } from 'firebase/firestore';
import { useFirestoreDb } from './context.js';
import { docTarget } from './live-read-registry.js';
import { useLiveReadStatus, useSubscribedResult } from './subscription-status.js';
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

  const status = useLiveReadStatus({
    queryClient,
    queryKey: stableQueryKey,
    target: docTarget(db, docPath),
    select: selectRef,
    active: subscribe && enabled,
  });

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

  return useSubscribedResult(query, subscribe, enabled, status);
}
