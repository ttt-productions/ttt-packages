'use client';

import { useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { doc, getDoc, onSnapshot, type DocumentData } from 'firebase/firestore';
import { useFirestoreDb } from './context';
import type { FirestoreDocOptions, WithId } from './types';

/**
 * Fetch a single Firestore document with optional realtime updates.
 * 
 * @example
 * ```tsx
 * // Simple fetch
 * const { data: user } = useFirestoreDoc<User>({
 *   docPath: `users/${userId}`,
 *   queryKey: ['user', userId],
 * });
 * 
 * // With realtime updates
 * const { data: project } = useFirestoreDoc<Project>({
 *   docPath: `projects/${projectId}`,
 *   queryKey: ['project', projectId],
 *   subscribe: true,
 * });
 * 
 * // Conditional fetch
 * const { data: profile } = useFirestoreDoc<Profile>({
 *   docPath: `profiles/${userId}`,
 *   queryKey: ['profile', userId],
 *   enabled: !!userId,
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
}: FirestoreDocOptions<T>) {
  const db = useFirestoreDb();
  const queryClient = useQueryClient();

  // Set up realtime subscription
  useEffect(() => {
    if (!subscribe || !enabled) return;

    const docRef = doc(db, docPath);
    const unsubscribe = onSnapshot(
      docRef,
      (snapshot) => {
        if (snapshot.exists()) {
          const rawData = snapshot.data();
          // Include id in data passed to select, so it can be renamed/transformed
          const dataWithId = { id: snapshot.id, ...rawData };
          const data = select ? select(dataWithId) : dataWithId;
          queryClient.setQueryData(queryKey, data as WithId<T>);
        } else {
          queryClient.setQueryData(queryKey, null);
        }
      },
      (error) => {
        console.error('[useFirestoreDoc] Subscription error:', error);
      }
    );

    return () => unsubscribe();
  }, [db, docPath, queryKey, enabled, subscribe, select, queryClient]);

  return useQuery({
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
}
