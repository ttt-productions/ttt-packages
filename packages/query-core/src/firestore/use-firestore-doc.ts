'use client';

import { useEffect } from 'react';
import { useQuery, useQueryClient, type UseQueryResult } from '@tanstack/react-query';
import { doc, getDoc, onSnapshot, type DocumentData } from 'firebase/firestore';
import { useFirestoreDb } from './context';
import type { FirestoreDocOptions, WithId } from './types';

/**
 * Fetch a single Firestore document with optional realtime updates.
 * * @example
 * ```tsx
 * // Simple fetch
 * const { data: user } = useFirestoreDoc<User>({
 * docPath: `users/${userId}`,
 * queryKey: ['user', userId],
 * });
 * * // With realtime updates
 * const { data: project } = useFirestoreDoc<Project>({
 * docPath: `projects/${projectId}`,
 * queryKey: ['project', projectId],
 * subscribe: true,
 * });
 * * // Conditional fetch
 * const { data: profile } = useFirestoreDoc<Profile>({
 * docPath: `profiles/${userId}`,
 * queryKey: ['profile', userId],
 * enabled: !!userId,
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
}: FirestoreDocOptions<T>): UseQueryResult<WithId<T> | null, Error> {
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
        // Surface error to React Query so UI can show error state
        // Note: setQueryError isn't public API, so we clear data to force UI reaction
        // or rely on the query failing naturally if we triggered a fetch.
        // Clearing data to undefined forces a "loading" or "empty" state depending on app logic,
        // which is better than stale data hiding the error.
        queryClient.setQueryData(queryKey, undefined);
      }
    );

    return () => unsubscribe();
    // Note: select intentionally excluded to prevent re-subscribing on every render
    // if the caller passes an inline function.
  }, [db, docPath, queryKey, enabled, subscribe, queryClient]);

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