'use client';

import { useQuery, type UseQueryResult } from '@tanstack/react-query';
import { collection, query, getCountFromServer } from 'firebase/firestore';
import { useFirestoreDb } from './context.js';
import type { FirestoreCountOptions } from './types.js';

export function useFirestoreCount({
  collectionPath,
  queryKey,
  constraints = [],
  enabled = true,
  staleTime,
  gcTime,
  refetchInterval,
}: FirestoreCountOptions): UseQueryResult<number, Error> {
  const db = useFirestoreDb();

  return useQuery({
    queryKey,
    queryFn: async (): Promise<number> => {
      const collectionRef = collection(db, collectionPath);
      const q = constraints.length > 0 ? query(collectionRef, ...constraints) : collectionRef;
      const snapshot = await getCountFromServer(q);
      return snapshot.data().count;
    },
    enabled,
    staleTime,
    gcTime,
    refetchInterval,
  });
}
