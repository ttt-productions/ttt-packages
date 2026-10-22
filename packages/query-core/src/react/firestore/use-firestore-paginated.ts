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
import { paginatedPageKey } from '../cache-helpers.js';
import type { WithId } from '../../firestore/types.js';
import type { FirestorePaginatedOptions, PaginatedPage } from './types.js';

const DEFAULT_PAGE_SIZE = 10;

export type UseFirestorePaginatedResult<T> = Omit<
  UseQueryResult<PaginatedPage<WithId<T>>, Error>,
  'data'
> & {
  data: WithId<T>[] | undefined;
  page: number;
  pageSize: number;
  hasNextPage: boolean;
  hasPrevPage: boolean;
  setPage: (page: number) => void;
  nextPage: () => void;
  prevPage: () => void;
};

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
    // eslint-disable-next-line react-hooks/exhaustive-deps -- queryKey and constraints are captured through their serialized identity
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

  const previousPage = useQuery({
    queryKey: paginatedPageKey(queryKey, Math.max(1, page - 1)),
    queryFn: () => fetchPage(Math.max(1, page - 1)),
    enabled: false,
  });
  const cachedEntry = queryResult.data;
  const outOfChain =
    page > 1 &&
    cachedEntry !== undefined &&
    (previousPage.data === undefined ||
      cachedEntry.after !== (previousPage.data.cursor?.id ?? null));
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
    // eslint-disable-next-line react-hooks/exhaustive-deps -- queryKey is captured through its serialized identity
    [page, hasNextPage, identity, queryClient],
  );

  const nextPage = useCallback(() => setPage(page + 1), [page, setPage]);
  const prevPage = useCallback(() => setPage(page - 1), [page, setPage]);

  return {
    ...queryResult,
    ...(outOfChain
      ? { isLoading: true, isPending: true, isSuccess: false, status: 'pending' as const }
      : {}),
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
