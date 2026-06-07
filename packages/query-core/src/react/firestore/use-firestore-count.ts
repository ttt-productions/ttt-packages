'use client';

import { useQuery, type UseQueryResult } from '@tanstack/react-query';
import { collection, query, getCountFromServer } from 'firebase/firestore';
import { useFirestoreDb } from './context.js';
import type { FirestoreCountOptions } from '../../firestore/types.js';

/**
 * Count documents in a Firestore collection via a server-side `count()`
 * aggregation (cheap — it does not read the matching documents). Optional
 * polling via `refetchInterval`.
 *
 * @example
 * ```tsx
 * const { data: count } = useFirestoreCount({
 *   collectionPath: 'activeUserNotifications',
 *   queryKey: ['notifications', 'unread-count', userId],
 *   constraints: [where('targetUserId', '==', userId), where('seenAt', '==', 0)],
 *   refetchInterval: 30_000,
 * });
 * ```
 */
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
