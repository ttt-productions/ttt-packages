'use client';

import * as React from 'react';
import { useInfiniteQuery } from '@tanstack/react-query';
import {
  collection,
  query,
  orderBy,
  limit,
  startAfter,
  getDocs,
  onSnapshot,
  type DocumentData,
  type QueryDocumentSnapshot,
} from 'firebase/firestore';
import { useFirestoreDb } from './context.js';
import type { FirestoreLiveInfiniteOptions } from '../../firestore/types.js';

const MAX_PAGE_SIZE = 100;

export interface FirestoreLiveInfiniteResult<T> {
  /** Merged + deduped live-window and older items, sorted per `sort` (default asc). */
  items: T[];
  /** True until the live window's first snapshot arrives. */
  isInitialLoading: boolean;
  /** Load the next older page. */
  fetchOlder: () => Promise<void>;
  /** Whether more older pages remain. */
  hasOlder: boolean;
  /** Whether an older page is currently being fetched. */
  isFetchingOlder: boolean;
}

type Entry<T> = { docId: string; sortValue: number; item: T };

/**
 * A live newest-window plus cursor-bridged older pagination, merged into one
 * ordered list. The newest page is a realtime `onSnapshot` window (orderBy
 * descending, limited to `pageSize`); older pages load on demand via `getDocs`,
 * each seeded with `startAfter(previousOldestDoc)` — the first older page starts
 * after the live window's oldest document, so there is no gap and no re-read of
 * pages already in memory.
 *
 * Generic enough for any live feed (chat threads, live comments, activity
 * feeds). `db` comes from `<FirestoreProvider>`.
 */
export function useFirestoreLiveInfinite<T = DocumentData & { id: string }>({
  collectionPath,
  queryKey,
  orderByField,
  constraints = [],
  pageSize: requestedPageSize = 20,
  enabled = true,
  select,
  getSortValue,
  sort = 'asc',
}: FirestoreLiveInfiniteOptions<T>): FirestoreLiveInfiniteResult<T> {
  const db = useFirestoreDb();
  const pageSize = Math.min(requestedPageSize, MAX_PAGE_SIZE);

  // Latest-callback refs: an inline select/getSortValue must not re-subscribe
  // the listener on every render.
  const selectRef = React.useRef(select);
  selectRef.current = select;
  const getSortValueRef = React.useRef(getSortValue);
  getSortValueRef.current = getSortValue;

  const toEntry = React.useCallback(
    (snap: QueryDocumentSnapshot<DocumentData>): Entry<T> => {
      const dataWithId: DocumentData & { id: string } = { id: snap.id, ...snap.data() };
      const item = selectRef.current ? selectRef.current(dataWithId) : (dataWithId as unknown as T);
      const sortValue = getSortValueRef.current
        ? getSortValueRef.current(dataWithId)
        : (dataWithId[orderByField] as number);
      return { docId: snap.id, sortValue, item };
    },
    [orderByField],
  );

  // Stable string deps for the subscription effect (values are captured via the
  // queryKey, which the caller varies per collection/thread).
  const queryKeyMemo = JSON.stringify(queryKey);
  const constraintsMemo = JSON.stringify(constraints);

  const [windowState, setWindowState] = React.useState<{
    ready: boolean;
    entries: Entry<T>[];
    oldestDoc: QueryDocumentSnapshot<DocumentData> | null;
  }>({ ready: false, entries: [], oldestDoc: null });

  React.useEffect(() => {
    if (!enabled) {
      setWindowState({ ready: false, entries: [], oldestDoc: null });
      return;
    }
    const colRef = collection(db, collectionPath);
    const q = query(colRef, ...constraints, orderBy(orderByField, 'desc'), limit(pageSize));
    const unsub = onSnapshot(q, (snap) => {
      const docs = snap.docs as QueryDocumentSnapshot<DocumentData>[];
      setWindowState({
        ready: true,
        entries: docs.map(toEntry),
        oldestDoc: docs[docs.length - 1] ?? null,
      });
    });
    return () => unsub();
    // constraints captured via constraintsMemo; queryKey via queryKeyMemo; toEntry is stable.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [db, collectionPath, orderByField, pageSize, enabled, queryKeyMemo, constraintsMemo, toEntry]);

  const older = useInfiniteQuery({
    queryKey: [...queryKey, 'older'],
    enabled: enabled && windowState.ready,
    initialPageParam: undefined as QueryDocumentSnapshot<DocumentData> | undefined,
    queryFn: async ({ pageParam }) => {
      const cursor = pageParam ?? windowState.oldestDoc ?? undefined;
      if (!cursor) {
        return {
          entries: [] as Entry<T>[],
          nextCursor: undefined as QueryDocumentSnapshot<DocumentData> | undefined,
        };
      }
      const colRef = collection(db, collectionPath);
      const q = query(
        colRef,
        ...constraints,
        orderBy(orderByField, 'desc'),
        startAfter(cursor),
        limit(pageSize),
      );
      const snap = await getDocs(q);
      const docs = snap.docs as QueryDocumentSnapshot<DocumentData>[];
      return {
        entries: docs.map(toEntry),
        nextCursor: docs.length === pageSize ? docs[docs.length - 1] : undefined,
      };
    },
    getNextPageParam: (last) => last.nextCursor,
  });

  const { fetchNextPage } = older;
  const fetchOlder = React.useCallback(async () => {
    await fetchNextPage();
  }, [fetchNextPage]);

  const items = React.useMemo(() => {
    if (!enabled) return [];
    const olderEntries = (older.data?.pages ?? []).flatMap((p) => p.entries);
    // Window entries win on overlap (they are the freshest, live copies).
    const merged = new Map<string, Entry<T>>();
    for (const entry of [...windowState.entries, ...olderEntries]) {
      if (!merged.has(entry.docId)) merged.set(entry.docId, entry);
    }
    const arr = Array.from(merged.values());
    arr.sort((a, b) => (sort === 'asc' ? a.sortValue - b.sortValue : b.sortValue - a.sortValue));
    return arr.map((e) => e.item);
  }, [enabled, older.data, windowState.entries, sort]);

  return {
    items,
    isInitialLoading: enabled ? !windowState.ready : false,
    fetchOlder,
    hasOlder: Boolean(older.hasNextPage),
    isFetchingOlder: older.isFetchingNextPage,
  };
}
