'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
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
import { useFirestoreDb } from './context.js';
import { paginatedPageKey } from '../../cache-helpers.js';
import type { FirestorePaginatedOptions, PaginatedPage, WithId } from '../../firestore/types.js';

const DEFAULT_PAGE_SIZE = 10;

/**
 * Return type for useFirestorePaginated hook. `data` is the displayed page's rows; the
 * page's cache entry (rows, cursor, has-more) lives at `paginatedPageKey(queryKey, page)`.
 */
export type UseFirestorePaginatedResult<T> = Omit<UseQueryResult<PaginatedPage<WithId<T>>, Error>, 'data'> & {
  data: WithId<T>[] | undefined;
  page: number;
  pageSize: number;
  hasNextPage: boolean;
  hasPrevPage: boolean;
  setPage: (page: number) => void;
  nextPage: () => void;
  prevPage: () => void;
};

/**
 * Page-based pagination for Firestore collections (Previous / Next, one page at a time).
 *
 * Each page is ONE cache entry at `[...queryKey, 'page', n]` holding its rows, its last
 * row as the next page's cursor, and whether a further page exists — read with a one-row
 * look-ahead, so `hasNextPage` is false exactly when nothing follows the displayed page.
 * Page n reads page n-1's cursor from the cache (loading the chain first if it is
 * missing) and records it as `after`. A displayed page whose `after` no longer matches
 * page n-1's cached cursor (page n-1 was re-read and its last row moved) is re-read before
 * it is shown, so every instance, remount, and refetch of a key agrees on where a page
 * starts. The page number belongs to the query identity (path, key, constraints, page
 * size): a new identity renders `initialPage` in its first render.
 *
 * `queryKey` must encode everything that changes the read — path, filters, ordering, and
 * page size — because the cache entries are shared by key.
 *
 * @example
 * ```tsx
 * const { data, page, nextPage, prevPage, hasNextPage, hasPrevPage } = useFirestorePaginated<Task>({
 *   collectionPath: 'tasks',
 *   queryKey: ['tasks', 'active', { pageSize: 10 }],
 *   constraints: [where('status', '==', 'active'), orderBy('createdAt', 'desc')],
 *   pageSize: 10,
 * });
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
  refetchInterval,
  select,
}: FirestorePaginatedOptions<T>): UseFirestorePaginatedResult<T> {
  const db = useFirestoreDb();
  const queryClient = useQueryClient();

  const queryKeyMemo = JSON.stringify(queryKey);
  const constraintsMemo = JSON.stringify(constraints);
  const identity = JSON.stringify([collectionPath, queryKeyMemo, constraintsMemo, pageSize]);
  const firstPage = Math.max(1, Math.floor(initialPage));

  const [pageState, setPageState] = useState(() => ({ identity, page: firstPage }));
  const page = pageState.identity === identity ? pageState.page : firstPage;

  const selectRef = useRef(select);
  selectRef.current = select;

  const fetchPage = useCallback(
    async (n: number): Promise<PaginatedPage<WithId<T>>> => {
      let cursor: DocumentSnapshot | null = null;
      if (n > 1) {
        const previous = await queryClient.ensureQueryData<PaginatedPage<WithId<T>>>({
          queryKey: paginatedPageKey(queryKey, n - 1),
          queryFn: () => fetchPage(n - 1),
        });
        if (!previous.hasMore || !previous.cursor) {
          return { items: [], cursor: null, hasMore: false, after: previous.cursor?.id ?? null };
        }
        cursor = previous.cursor;
      }
      const q = query(
        collection(db, collectionPath),
        ...constraints,
        ...(cursor ? [startAfter(cursor)] : []),
        limit(pageSize + 1),
      );
      const snapshot = await getDocs(q);
      const pageDocs = snapshot.docs.slice(0, pageSize);
      return {
        items: pageDocs.map((docSnap) => {
          const dataWithId = { id: docSnap.id, ...docSnap.data() };
          const mapped = selectRef.current ? selectRef.current(dataWithId) : dataWithId;
          return mapped as WithId<T>;
        }),
        cursor: pageDocs[pageDocs.length - 1] ?? null,
        hasMore: snapshot.docs.length > pageSize,
        after: cursor?.id ?? null,
      };
    },
    // queryKey and constraints are captured through their serialized identity.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [db, queryClient, identity, selectRef],
  );

  const queryResult = useQuery({
    queryKey: paginatedPageKey(queryKey, page),
    queryFn: () => fetchPage(page),
    enabled,
    staleTime,
    gcTime,
    refetchInterval,
  });

  // The page before the displayed one, observed from the cache only (never fetched here).
  // When it is re-read and its last row moves, the displayed entry no longer starts where the
  // chain says it must: it is re-read before it is shown as current.
  const previousPage = useQuery({
    queryKey: paginatedPageKey(queryKey, Math.max(1, page - 1)),
    queryFn: () => fetchPage(Math.max(1, page - 1)),
    enabled: false,
  });
  const cachedEntry = queryResult.data;
  const outOfChain =
    page > 1 &&
    cachedEntry !== undefined &&
    (previousPage.data === undefined || cachedEntry.after !== (previousPage.data.cursor?.id ?? null));
  const { refetch, isFetching } = queryResult;
  useEffect(() => {
    if (enabled && outOfChain && !isFetching) void refetch();
  }, [enabled, outOfChain, isFetching, refetch]);

  const entry = outOfChain ? undefined : cachedEntry;
  const hasNextPage = Boolean(entry?.hasMore && entry.cursor);

  const setPage = useCallback(
    (target: number) => {
      const next = Math.floor(target);
      if (next < 1 || next === page) return;
      if (next > page + 1) {
        const before = queryClient.getQueryData<PaginatedPage<unknown>>(
          paginatedPageKey(queryKey, next - 1),
        );
        if (!before?.hasMore) return;
      }
      if (next === page + 1 && !hasNextPage) return;
      setPageState({ identity, page: next });
    },
    // queryKey is captured through its serialized identity.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [page, hasNextPage, identity, queryClient],
  );

  const nextPage = useCallback(() => setPage(page + 1), [page, setPage]);
  const prevPage = useCallback(() => setPage(page - 1), [page, setPage]);

  return {
    ...queryResult,
    ...(outOfChain ? { isLoading: true, isPending: true, isSuccess: false, status: 'pending' as const } : {}),
    data: entry?.items,
    page,
    pageSize,
    hasNextPage,
    hasPrevPage: page > 1,
    setPage,
    nextPage,
    prevPage,
  } as UseFirestorePaginatedResult<T>;
}
