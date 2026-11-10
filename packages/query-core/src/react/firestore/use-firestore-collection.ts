'use client';

import { useRef } from 'react';
import { useQuery, useQueryClient, type UseQueryResult } from '@tanstack/react-query';
import { collection, query, getDocs, type DocumentData } from 'firebase/firestore';
import { useFirestoreDb } from './context.js';
import { collectionTarget } from './live-read-registry.js';
import { useLiveReadStatus, useSubscribedResult } from './subscription-status.js';
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

  const status = useLiveReadStatus({
    queryClient,
    queryKey: stableQueryKey,
    target: collectionTarget(db, collectionPath, stableConstraints, constraintsMemo),
    select: selectRef,
    active: subscribe && enabled,
  });

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

  return useSubscribedResult(queryResult, subscribe, enabled, status);
}
