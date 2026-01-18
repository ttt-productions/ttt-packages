'use client';

import { useInfiniteQuery } from '@tanstack/react-query';
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
import type { FirestoreInfiniteOptions, InfinitePage, WithId } from './types';

const DEFAULT_PAGE_SIZE = 20;

/**
 * Infinite scroll pagination for Firestore collections.
 * Automatically handles cursor-based pagination with React Query.
 * 
 * @example
 * ```tsx
 * const {
 *   data,
 *   fetchNextPage,
 *   hasNextPage,
 *   isFetchingNextPage,
 *   isLoading,
 * } = useFirestoreInfinite<Post>({
 *   collectionPath: 'posts',
 *   queryKey: ['posts', 'feed'],
 *   constraints: [
 *     where('status', '==', 'published'),
 *     orderBy('createdAt', 'desc'),
 *   ],
 *   pageSize: 20,
 * });
 * 
 * // Flatten pages for rendering
 * const posts = data?.pages.flatMap(page => page.items) ?? [];
 * 
 * // Load more on scroll
 * <InfiniteScroll onLoadMore={fetchNextPage} hasMore={hasNextPage} />
 * ```
 */
export function useFirestoreInfinite<T extends DocumentData = DocumentData>({
  collectionPath,
  queryKey,
  constraints = [],
  pageSize = DEFAULT_PAGE_SIZE,
  enabled = true,
  staleTime,
  gcTime,
  select,
}: FirestoreInfiniteOptions<T>) {
  const db = useFirestoreDb();

  return useInfiniteQuery<InfinitePage<T>, Error>({
    queryKey,
    queryFn: async ({ pageParam }): Promise<InfinitePage<T>> => {
      const collectionRef = collection(db, collectionPath);
      
      // Build query with constraints
      const queryConstraints = [
        ...constraints,
        ...(pageParam ? [startAfter(pageParam as DocumentSnapshot)] : []),
        limit(pageSize),
      ];

      const q = query(collectionRef, ...queryConstraints);
      const snapshot = await getDocs(q);

      const items = snapshot.docs.map((docSnap) => {
        const rawData = docSnap.data();
        // Include id in data passed to select, so it can be renamed/transformed
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
      // If we got fewer items than requested, there are no more pages
      if (lastPage.size < pageSize) return undefined;
      return lastPage.lastDoc;
    },
    enabled,
    staleTime,
    gcTime,
  });
}

/**
 * Helper to flatten infinite query pages into a single array.
 * 
 * @example
 * ```tsx
 * const { data } = useFirestoreInfinite<Post>({ ... });
 * const posts = flattenInfiniteData(data);
 * ```
 */
export function flattenInfiniteData<T>(
  data: { pages: InfinitePage<T>[] } | undefined
): WithId<T>[] {
  if (!data) return [];
  return data.pages.flatMap((page) => page.items);
}

/**
 * Get total count of items across all loaded pages.
 */
export function getInfiniteDataCount<T>(
  data: { pages: InfinitePage<T>[] } | undefined
): number {
  if (!data) return 0;
  return data.pages.reduce((sum, page) => sum + page.items.length, 0);
}
