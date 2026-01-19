'use client';

import { useState, useCallback, useMemo } from 'react';
import { useQuery, useQueryClient, type UseQueryResult } from '@tanstack/react-query';
import {
  collection,
  query,
  getDocs,
  limit,
  startAfter,
  type DocumentData,
  type DocumentSnapshot,
} from 'firebase/firestore';
import { useFirestoreDb } from './context';
import type { FirestorePaginatedOptions, WithId } from './types';

const DEFAULT_PAGE_SIZE = 10;
const MAX_CACHED_CURSORS = 20;

/**
 * Return type for useFirestorePaginated hook
 */
export type UseFirestorePaginatedResult<T> = UseQueryResult<WithId<T>[], Error> & {
  page: number;
  pageSize: number;
  hasNextPage: boolean;
  hasPrevPage: boolean;
  setPage: (page: number) => void;
  nextPage: () => void;
  prevPage: () => void;
  resetToFirstPage: () => void;
};

/**
 * Page-based pagination for Firestore collections.
 * Supports navigating to specific pages (1, 2, 3...) rather than infinite scroll.
 * * @example
 * ```tsx
 * const {
 * data,
 * page,
 * setPage,
 * hasNextPage,
 * hasPrevPage,
 * isLoading,
 * } = useFirestorePaginated<Task>({
 * collectionPath: 'tasks',
 * queryKey: ['tasks', 'list'],
 * constraints: [where('status', '==', 'active'), orderBy('createdAt', 'desc')],
 * pageSize: 10,
 * });
 * * // Render pagination controls
 * <button onClick={() => setPage(page - 1)} disabled={!hasPrevPage}>Previous</button>
 * <span>Page {page}</span>
 * <button onClick={() => setPage(page + 1)} disabled={!hasNextPage}>Next</button>
 * ```
 */
export function useFirestorePaginated<T extends DocumentData = DocumentData>({
  collectionPath,
  queryKey,
  constraints = [],
  pageSize = DEFAULT_PAGE_SIZE,
  initialPage = 1,
  enabled = true,
  staleTime,
  gcTime,
  select,
}: FirestorePaginatedOptions<T>): UseFirestorePaginatedResult<T> {
  const db = useFirestoreDb();
  const queryClient = useQueryClient();
  
  const [page, setPageInternal] = useState(initialPage);
  const [cursors, setCursors] = useState<Map<number, DocumentSnapshot>>(new Map());
  const [hasMore, setHasMore] = useState(true);

  // Create a stable query key that includes the page
  const pageQueryKey = useMemo(
    () => [...queryKey, 'page', page],
    [queryKey, page]
  );

  const queryResult = useQuery({
    queryKey: pageQueryKey,
    queryFn: async (): Promise<WithId<T>[]> => {
      const collectionRef = collection(db, collectionPath);
      
      // Get cursor for current page (if not page 1)
      const cursor = page > 1 ? cursors.get(page - 1) : undefined;
      
      // Build query
      const queryConstraints = [
        ...constraints,
        ...(cursor ? [startAfter(cursor)] : []),
        limit(pageSize),
      ];

      const q = query(collectionRef, ...queryConstraints);
      const snapshot = await getDocs(q);

      // Store the last doc as cursor for next page
      if (snapshot.docs.length > 0) {
        const lastDoc = snapshot.docs[snapshot.docs.length - 1];
        setCursors((prev) => {
          const next = new Map(prev);
          next.set(page, lastDoc);
          
          // Prune old cursors if too many (prevent memory leaks)
          if (next.size > MAX_CACHED_CURSORS) {
            const sorted = Array.from(next.keys()).sort((a, b) => a - b);
            const toDelete = sorted.slice(0, sorted.length - MAX_CACHED_CURSORS);
            toDelete.forEach((k) => next.delete(k));
          }
          
          return next;
        });
      }

      // Determine if there are more pages
      setHasMore(snapshot.docs.length === pageSize);

      return snapshot.docs.map((docSnap) => {
        const rawData = docSnap.data();
        // Include id in data passed to select, so it can be renamed/transformed
        const dataWithId = { id: docSnap.id, ...rawData };
        const data = select ? select(dataWithId) : dataWithId;
        return data as WithId<T>;
      });
    },
    enabled,
    staleTime,
    gcTime,
  });

  const setPage = useCallback((newPage: number) => {
    if (newPage < 1) return;
    
    // Can only go forward one page at a time if cursor doesn't exist
    if (newPage > page + 1 && !cursors.has(newPage - 1)) {
      console.warn('[useFirestorePaginated] Cannot skip pages. Navigate sequentially.');
      return;
    }
    
    setPageInternal(newPage);
  }, [page, cursors]);

  const nextPage = useCallback(() => {
    if (hasMore) setPage(page + 1);
  }, [page, hasMore, setPage]);

  const prevPage = useCallback(() => {
    if (page > 1) setPage(page - 1);
  }, [page, setPage]);

  const resetToFirstPage = useCallback(() => {
    setCursors(new Map());
    setPageInternal(1);
    setHasMore(true);
    // Invalidate all cached pages
    queryClient.invalidateQueries({ queryKey, exact: false });
  }, [queryClient, queryKey]);

  return {
    ...queryResult,
    // Pagination state
    page,
    pageSize,
    hasNextPage: hasMore,
    hasPrevPage: page > 1,
    // Navigation functions
    setPage,
    nextPage,
    prevPage,
    resetToFirstPage,
  };
}