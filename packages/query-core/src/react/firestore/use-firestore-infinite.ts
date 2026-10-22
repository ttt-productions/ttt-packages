'use client';

import { useInfiniteQuery, type UseInfiniteQueryResult } from '@tanstack/react-query';
import {
  collection,
  query,
  getDocs,
  limit,
  startAfter,
  type DocumentData,
  type DocumentSnapshot,
} from 'firebase/firestore';
import { useFirestoreDb } from './context.js';
import type { WithId } from '../../firestore/types.js';
import type { FirestoreInfiniteOptions, InfinitePage } from './types.js';

const DEFAULT_PAGE_SIZE = 20;

export function useFirestoreInfinite<T extends DocumentData = DocumentData>({
  collectionPath,
  queryKey,
  constraints = [],
  pageSize = DEFAULT_PAGE_SIZE,
  enabled = true,
  staleTime,
  gcTime,
  select,
}: FirestoreInfiniteOptions<T>): UseInfiniteQueryResult<
  { pages: InfinitePage<T>[]; pageParams: (DocumentSnapshot | null)[] },
  Error
> {
  const db = useFirestoreDb();

  return useInfiniteQuery({
    queryKey,
    queryFn: async ({ pageParam }): Promise<InfinitePage<T>> => {
      const collectionRef = collection(db, collectionPath);

      const queryConstraints = [
        ...constraints,
        ...(pageParam ? [startAfter(pageParam as DocumentSnapshot)] : []),
        limit(pageSize),
      ];

      const q = query(collectionRef, ...queryConstraints);
      const snapshot = await getDocs(q);

      const items = snapshot.docs.map((docSnap) => {
        const rawData = docSnap.data();
        const dataWithId = { id: docSnap.id, ...rawData };
        const data = select ? select(dataWithId) : dataWithId;
        return data as WithId<T>;
      });

      return {
        items,
        lastDoc: snapshot.docs[snapshot.docs.length - 1] ?? null,
        size: snapshot.docs.length,
      };
    },
    initialPageParam: null as DocumentSnapshot | null,
    getNextPageParam: (lastPage) => {
      if (lastPage.size < pageSize) return undefined;
      return lastPage.lastDoc;
    },
    enabled,
    staleTime,
    gcTime,
  });
}
