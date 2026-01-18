'use client';

import { useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  collection,
  query,
  getDocs,
  onSnapshot,
  type DocumentData,
} from 'firebase/firestore';
import { useFirestoreDb } from './context';
import type { FirestoreCollectionOptions, WithId } from './types';
import { docWithId } from './types';

/**
 * Fetch all documents from a Firestore collection with optional realtime updates.
 * Use this for small collections where you need all documents at once.
 * For large collections, use useFirestoreInfinite or useFirestorePaginated.
 * 
 * @example
 * ```tsx
 * // Fetch all channels in a project
 * const { data: channels } = useFirestoreCollection<Channel>({
 *   collectionPath: `projects/${projectId}/channels`,
 *   queryKey: ['channels', projectId],
 *   constraints: [orderBy('createdAt', 'asc')],
 * });
 * 
 * // With realtime updates
 * const { data: members } = useFirestoreCollection<Member>({
 *   collectionPath: `projects/${projectId}/members`,
 *   queryKey: ['members', projectId],
 *   subscribe: true,
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
}: FirestoreCollectionOptions<T>) {
  const db = useFirestoreDb();
  const queryClient = useQueryClient();

  // Set up realtime subscription
  useEffect(() => {
    if (!subscribe || !enabled) return;

    const collectionRef = collection(db, collectionPath);
    const q = constraints.length > 0 
      ? query(collectionRef, ...constraints) 
      : collectionRef;

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const items = snapshot.docs.map((docSnap) => {
          const rawData = docSnap.data();
          // Include id in data passed to select, so it can be renamed/transformed
          const dataWithId = { id: docSnap.id, ...rawData };
          const data = select ? select(dataWithId) : dataWithId;
          return data as WithId<T>;
        });
        queryClient.setQueryData(queryKey, items);
      },
      (error) => {
        console.error('[useFirestoreCollection] Subscription error:', error);
      }
    );

    return () => unsubscribe();
  }, [db, collectionPath, queryKey, constraints, enabled, subscribe, select, queryClient]);

  return useQuery({
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
}
