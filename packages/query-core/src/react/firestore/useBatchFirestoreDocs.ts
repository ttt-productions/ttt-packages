'use client';

import { useEffect, useMemo, useState } from 'react';
import { useQueries, useQueryClient } from '@tanstack/react-query';
import { collection, getDocs, query, where, documentId, type Firestore } from 'firebase/firestore';
import { subscribeDoc } from './doc-subscription-registry.js';

const FIRESTORE_IN_LIMIT = 30;

export type BatchFirestoreDocsOptions = {
  /**
   * Firestore instance to use for queries
   */
  db: Firestore;

  /**
   * Full collection path (e.g., 'publicUsers', 'entities/public')
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

  /**
   * Real-time mode (default: false). When true, each id is resolved via a shared,
   * reference-counted `onSnapshot` listener instead of a one-shot `getDocs` batch:
   * - a missing doc caches `null` (negative caching) and resolves the instant it appears,
   * - identity edits propagate live, and every browser tab stays consistent,
   * - `staleTime` is irrelevant (listeners keep the cache fresh).
   * Initial read cost matches the batch path; listeners then stay open while mounted.
   * Use for small, frequently-rendered, change-sensitive identity docs (e.g. publicUsers).
   */
  subscribe?: boolean;
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
  subscribe = false,
}: BatchFirestoreDocsOptions): BatchFirestoreDocsResult<T> {
  const queryClient = useQueryClient();

  // Stabilize ids reference to prevent cascading re-renders
  const idsKey = JSON.stringify(ids);

  // Deduplicate and filter out empty IDs
  const uniqueIds = useMemo(() => {
    const parsed: string[] = JSON.parse(idsKey);
    return Array.from(new Set(parsed.filter(Boolean)));
  }, [idsKey]);

  // ── Real-time subscribe mode ──────────────────────────────────────────────
  // Re-render trigger; bumped whenever a subscribed doc's snapshot lands.
  const [snapshotVersion, setSnapshotVersion] = useState(0);
  const [subscribeError, setSubscribeError] = useState<Error | null>(null);

  useEffect(() => {
    if (!subscribe || !enabled || uniqueIds.length === 0) return;
    setSubscribeError(null);
    const unsubscribers = uniqueIds.map((id) =>
      subscribeDoc({
        queryClient,
        db,
        collectionPath,
        queryKeyPrefix,
        id,
        onUpdate: () => setSnapshotVersion((v) => v + 1),
        onError: (error) => setSubscribeError(error),
      }),
    );
    return () => {
      for (const unsubscribe of unsubscribers) unsubscribe();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- idsKey stands in for uniqueIds
  }, [idsKey, subscribe, enabled, collectionPath, queryKeyPrefix, queryClient, db]);

  // Separate IDs into cached/fresh vs needs-fetch (one-shot path only)
  const { fetchIds } = useMemo(() => {
    if (!enabled || subscribe) {
      return { fetchIds: [] };
    }

    const needsFetch: string[] = [];

    for (const id of uniqueIds) {
      const queryKey = [queryKeyPrefix, id];
      const state = queryClient.getQueryState(queryKey);

      // Check if data exists and is still fresh. `null` counts as data — it marks a
      // known-absent doc (negative caching) and must not be re-fetched while fresh.
      const hasResolvedData = state !== undefined && state.data !== undefined;
      if (!(hasResolvedData && state.dataUpdatedAt && Date.now() - state.dataUpdatedAt < staleTime)) {
        needsFetch.push(id);
      }
    }

    return { fetchIds: needsFetch };
  }, [uniqueIds, queryKeyPrefix, queryClient, staleTime, enabled, subscribe]);

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
      queryKey: [queryKeyPrefix, 'batch', batchIndex, ...[...batch].sort()],
      queryFn: async (): Promise<T[]> => {
        if (batch.length === 0) return [];

        const q = query(
          collection(db, collectionPath),
          where(documentId(), 'in', batch)
        );

        const snapshot = await getDocs(q);
        const docs: T[] = [];
        const returnedIds = new Set<string>();

        // Process each document and update individual cache entries
        snapshot.forEach((doc) => {
          const data = { id: doc.id, ...doc.data() } as unknown as T;
          docs.push(data);
          returnedIds.add(doc.id);

          // Populate individual cache entry
          queryClient.setQueryData(
            [queryKeyPrefix, doc.id],
            data,
            { updatedAt: Date.now() }
          );
        });

        // Negative-cache requested ids that came back missing so they aren't
        // re-fetched on every render while fresh (mirrors the subscribe path).
        for (const id of batch) {
          if (!returnedIds.has(id)) {
            queryClient.setQueryData([queryKeyPrefix, id], null, { updatedAt: Date.now() });
          }
        }

        return docs;
      },
      staleTime,
      gcTime,
      enabled: enabled && batch.length > 0,
    })),
  });

  // Combine results (one-shot batch path)
  const batchIsLoading = batchQueries.some(q => q.isLoading);
  const batchIsError = batchQueries.some(q => q.isError);
  const batchError = (batchQueries.find(q => q.error)?.error as Error | null) || null;

  // Trigger re-derivation when batch fetches complete
  const batchSettledCount = batchQueries.filter(q => q.isSuccess || q.isError).length;
  const batchUpdateTimestamp = batchQueries.reduce((sum, q) => sum + (q.dataUpdatedAt ?? 0), 0);

  const data = useMemo(() => {
    const combined: Record<string, T> = {};

    // Always read all IDs from individual cache entries. Both paths populate these via
    // setQueryData (batch queryFn, or the subscribe listener); we never read batch results
    // directly, so IDs can't fall through the cached/fetched split. A `null` entry means a
    // doc is known-absent (negative caching, both paths) and is correctly excluded here.
    for (const id of uniqueIds) {
      const cached = queryClient.getQueryData<T>([queryKeyPrefix, id]);
      if (cached) {
        combined[id] = cached;
      }
    }

    return combined;
    // batchSettledCount/batchUpdateTimestamp/snapshotVersion are intentional re-derivation triggers:
    // the cache is read imperatively via getQueryData (non-reactive), so these counters force a
    // recompute when a batch fetch settles or a subscribed doc updates.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uniqueIds, queryKeyPrefix, queryClient, batchSettledCount, batchUpdateTimestamp, snapshotVersion]);

  // In subscribe mode the batch queries are inert; "loading" means a subscribed id has not
  // received its first snapshot yet (no cache entry — `null` counts as resolved-missing).
  const subscribeIsLoading =
    subscribe && enabled && uniqueIds.some(
      (id) => queryClient.getQueryData([queryKeyPrefix, id]) === undefined,
    );

  const refetch = async () => {
    await Promise.all(batchQueries.map(q => q.refetch()));
  };

  return {
    data,
    isLoading: batchIsLoading || subscribeIsLoading,
    isError: batchIsError || subscribeError !== null,
    error: batchError ?? subscribeError,
    refetch,
  };
}
