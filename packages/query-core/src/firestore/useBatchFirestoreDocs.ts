import { useMemo } from 'react';
import { useQueries, useQueryClient } from '@tanstack/react-query';
import { collection, getDocs, query, where, documentId, type Firestore } from 'firebase/firestore';

const FIRESTORE_IN_LIMIT = 30;

export type BatchFirestoreDocsOptions = {
  /**
   * Firestore instance to use for queries
   */
  db: Firestore;
  
  /**
   * Full collection path (e.g., 'publicUsers', 'projects/public')
   */
  collectionPath: string;
  
  /**
   * Array of document IDs to fetch
   */
  ids: string[];
  
  /**
   * Query key prefix for individual document cache entries
   * Each document will be cached as [queryKeyPrefix, docId]
   * @example 'publicUser' -> ['publicUser', 'user123']
   */
  queryKeyPrefix: string;
  
  /**
   * Time in milliseconds to consider data fresh (default: 30 minutes)
   */
  staleTime?: number;
  
  /**
   * Time in milliseconds to keep unused data in cache (default: 1 hour)
   */
  gcTime?: number;
  
  /**
   * Whether queries should be enabled (default: true)
   */
  enabled?: boolean;
};

export type BatchFirestoreDocsResult<T> = {
  /**
   * Map of docId -> document data
   * Only includes documents that exist in Firestore
   */
  data: Record<string, T>;
  
  /**
   * True if any batch queries are still loading
   */
  isLoading: boolean;
  
  /**
   * True if any batch queries have errored
   */
  isError: boolean;
  
  /**
   * First error from batch queries, if any
   */
  error: Error | null;
  
  /**
   * Refetch all documents (even cached ones)
   */
  refetch: () => Promise<void>;
};

/**
 * Efficiently batch fetch Firestore documents with individual caching
 * 
 * Features:
 * - Each document is cached individually for maximum reuse
 * - Only fetches documents that are missing or stale
 * - Respects Firestore's 30-item limit for 'in' queries
 * - Returns combined result as Record<docId, data>
 * 
 * @example
 * ```typescript
 * const { data: users, isLoading } = useBatchFirestoreDocs<PublicUser>({
 *   db,
 *   collectionPath: 'publicUsers',
 *   ids: ['user1', 'user2', 'user3'],
 *   queryKeyPrefix: 'publicUser',
 *   staleTime: 30 * 60 * 1000, // 30 minutes
 * });
 * // users = { user1: {...}, user2: {...}, user3: {...} }
 * ```
 */
export function useBatchFirestoreDocs<T extends Record<string, any>>({
  db,
  collectionPath,
  ids,
  queryKeyPrefix,
  staleTime = 30 * 60 * 1000,
  gcTime = 60 * 60 * 1000,
  enabled = true,
}: BatchFirestoreDocsOptions): BatchFirestoreDocsResult<T> {
  const queryClient = useQueryClient();
  
  // Deduplicate and filter out empty IDs
  const uniqueIds = useMemo(() => {
    return Array.from(new Set(ids.filter(Boolean)));
  }, [ids]);

  // Separate IDs into cached/fresh vs needs-fetch
  const { cachedIds, fetchIds } = useMemo(() => {
    if (!enabled) {
      return { cachedIds: [], fetchIds: [] };
    }

    const cached: string[] = [];
    const needsFetch: string[] = [];

    for (const id of uniqueIds) {
      const queryKey = [queryKeyPrefix, id];
      const state = queryClient.getQueryState(queryKey);
      
      // Check if data exists and is still fresh
      if (state?.data && state.dataUpdatedAt && Date.now() - state.dataUpdatedAt < staleTime) {
        cached.push(id);
      } else {
        needsFetch.push(id);
      }
    }

    return { cachedIds: cached, fetchIds: needsFetch };
  }, [uniqueIds, queryKeyPrefix, queryClient, staleTime, enabled]);

  // Batch the fetchIds into groups of 30
  const batches = useMemo(() => {
    const result: string[][] = [];
    for (let i = 0; i < fetchIds.length; i += FIRESTORE_IN_LIMIT) {
      result.push(fetchIds.slice(i, i + FIRESTORE_IN_LIMIT));
    }
    return result;
  }, [fetchIds]);

  // Fetch each batch and populate individual cache entries
  const batchQueries = useQueries({
    queries: batches.map((batch, batchIndex) => ({
      queryKey: [queryKeyPrefix, 'batch', batchIndex, ...batch.sort()],
      queryFn: async (): Promise<T[]> => {
        if (batch.length === 0) return [];

        const q = query(
          collection(db, collectionPath),
          where(documentId(), 'in', batch)
        );

        const snapshot = await getDocs(q);
        const docs: T[] = [];

        // Process each document and update individual cache entries
        snapshot.forEach((doc) => {
          const data = { id: doc.id, ...doc.data() } as unknown as T;
          docs.push(data);

          // Populate individual cache entry
          queryClient.setQueryData(
            [queryKeyPrefix, doc.id],
            data,
            { updatedAt: Date.now() }
          );
        });

        return docs;
      },
      staleTime,
      gcTime,
      enabled: enabled && batch.length > 0,
    })),
  });

  // Combine results
  const isLoading = batchQueries.some(q => q.isLoading);
  const isError = batchQueries.some(q => q.isError);
  const error = batchQueries.find(q => q.error)?.error || null;

  const data = useMemo(() => {
    const combined: Record<string, T> = {};

    // Add cached data
    for (const id of cachedIds) {
      const cached = queryClient.getQueryData<T>([queryKeyPrefix, id]);
      if (cached) {
        combined[id] = cached;
      }
    }

    // Add freshly fetched data
    for (const batchQuery of batchQueries) {
      if (batchQuery.data) {
        for (const doc of batchQuery.data) {
          combined[doc.id] = doc;
        }
      }
    }

    return combined;
  }, [cachedIds, batchQueries, queryClient, queryKeyPrefix]);

  const refetch = async () => {
    await Promise.all(batchQueries.map(q => q.refetch()));
  };

  return {
    data,
    isLoading,
    isError,
    error: error as Error | null,
    refetch,
  };
}