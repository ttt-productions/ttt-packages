'use client';

import * as React from 'react';
import { useInfiniteQuery } from '@tanstack/react-query';
import {
  collection,
  query,
  orderBy,
  limit,
  startAfter,
  endAt,
  getDocs,
  onSnapshot,
  type DocumentData,
  type QueryDocumentSnapshot,
} from 'firebase/firestore';
import { useFirestoreDb } from './context.js';
import { RESUBSCRIBE_DELAYS_MS, isPermissionDeniedError } from './resubscribe.js';
import type { FirestoreLiveInfiniteOptions, FirestoreSourceState } from '../../firestore/types.js';

const MAX_PAGE_SIZE = 100;

export interface FirestoreLiveInfiniteResult<T> {
  /** The current subscription identity's rows — live set plus loaded older pages, sorted per `sort`. */
  items: T[];
  /** True until the current identity's first snapshot arrives, unless its listener has failed. */
  isInitialLoading: boolean;
  /** Liveness of the current identity's listener; `connecting` from that identity's first render. */
  sourceState: FirestoreSourceState;
  /** The listener's failure for the current identity; `null` while connecting, live, or offline. */
  error: Error | null;
  /** Load the next older page. Never rejects — a failed read lands in `olderError`. */
  fetchOlder: () => Promise<void>;
  /** Whether older rows exist that are not loaded yet (a one-doc look-ahead, never a full-page guess). */
  hasOlder: boolean;
  /** Whether an older page is being read (including a `retry` of one). */
  isFetchingOlder: boolean;
  /** The last older-page read failed; `null` once an older read succeeds. */
  olderError: Error | null;
  /** Re-run what failed: resubscribe a failed listener, re-read a failed older page. */
  retry: () => void;
}

type Entry<T> = { docId: string; sortValue: number; item: T };
type Snap = QueryDocumentSnapshot<DocumentData>;

interface WindowState<T> {
  identity: string;
  ready: boolean;
  entries: Entry<T>[];
  anchor: Snap | null;
  olderExists: boolean;
  sourceState: FirestoreSourceState;
  error: Error | null;
}

function freshWindow<T>(identity: string): WindowState<T> {
  return {
    identity,
    ready: false,
    entries: [],
    anchor: null,
    olderExists: false,
    sourceState: 'connecting',
    error: null,
  };
}

/**
 * A live list (newest rows realtime) with older rows paged in on demand, merged into
 * one ordered list.
 *
 * Until the first server-confirmed snapshot that has rows, the listener reads the newest
 * `pageSize` rows plus one look-ahead row. That snapshot fixes an anchor — the oldest row
 * of the window — and from then on the listener covers anchor → newest with no limit, so
 * it grows only with rows that arrive while the list is open, and every older page starts
 * after the anchor. Nothing can fall between the live set and the older pages, however
 * many rows arrive. Older pages carry the same one-row look-ahead, so `hasOlder` is false
 * exactly when nothing older exists.
 *
 * Everything read is tagged to its subscription identity (path, key, ordering,
 * constraints, page size, enabled): a new identity renders empty and connecting in its
 * first render, and a retired identity's late callback or older page never lands.
 *
 * A `permission-denied` listener error resubscribes on the `RESUBSCRIBE_DELAYS_MS` ladder
 * before surfacing; any other listener error surfaces at once. Rows already shown are
 * kept beside the error. `db` comes from `<FirestoreProvider>`.
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
    (snap: Snap): Entry<T> => {
      const dataWithId: DocumentData & { id: string } = { id: snap.id, ...snap.data() };
      const item = selectRef.current ? selectRef.current(dataWithId) : (dataWithId as unknown as T);
      const sortValue = getSortValueRef.current
        ? getSortValueRef.current(dataWithId)
        : (dataWithId[orderByField] as number);
      return { docId: snap.id, sortValue, item };
    },
    [orderByField],
  );

  // Constraint objects are fresh every render; their serialized form is the identity.
  const queryKeyMemo = JSON.stringify(queryKey);
  const constraintsMemo = JSON.stringify(constraints);
  const identity = JSON.stringify([
    collectionPath,
    queryKeyMemo,
    orderByField,
    constraintsMemo,
    pageSize,
    enabled,
  ]);

  const [windowState, setWindowState] = React.useState<WindowState<T>>(() => freshWindow(identity));
  const windowRef = React.useRef(windowState);
  windowRef.current = windowState;
  const [retryNonce, setRetryNonce] = React.useState(0);

  const current: WindowState<T> =
    windowState.identity === identity ? windowState : freshWindow<T>(identity);

  React.useEffect(() => {
    if (!enabled) {
      // Retire the enabled identity's rows, so re-enabling starts afresh rather than resuming.
      setWindowState(freshWindow<T>(identity));
      return;
    }

    // A retry of the same identity resumes from its anchor and keeps its rows.
    const prior = windowRef.current;
    const resumed = prior.identity === identity;
    setWindowState((prev) =>
      prev.identity === identity
        ? { ...prev, error: null, sourceState: 'connecting' }
        : freshWindow<T>(identity),
    );

    let disposed = false;
    let unsubscribe: (() => void) | null = null;
    let retryTimer: ReturnType<typeof setTimeout> | null = null;
    let attempt = 0;
    let currentAnchor: Snap | null = resumed ? prior.anchor : null;

    const update = (fn: (prev: WindowState<T>) => WindowState<T>) => {
      if (disposed) return;
      setWindowState((prev) => (prev.identity === identity ? fn(prev) : prev));
    };

    const listen = (anchor: Snap | null) => {
      if (disposed) return;
      currentAnchor = anchor;
      const colRef = collection(db, collectionPath);
      const q = anchor
        ? query(colRef, ...constraints, orderBy(orderByField, 'desc'), endAt(anchor))
        : query(colRef, ...constraints, orderBy(orderByField, 'desc'), limit(pageSize + 1));
      let serverConfirmed = false;

      unsubscribe = onSnapshot(
        q,
        { includeMetadataChanges: true },
        (snap) => {
          if (disposed) return;
          attempt = 0;
          const docs = snap.docs as Snap[];
          const fromCache = snap.metadata?.fromCache ?? false;
          const nextSource = (prev: FirestoreSourceState): FirestoreSourceState => {
            if (!fromCache) return 'live';
            if (!serverConfirmed) return prev === 'error' ? 'connecting' : prev;
            return 'offline';
          };
          if (!fromCache) serverConfirmed = true;

          if (anchor) {
            update((prev) => ({
              ...prev,
              ready: true,
              entries: docs.map(toEntry),
              sourceState: nextSource(prev.sourceState),
              error: null,
            }));
            return;
          }

          const windowDocs = docs.slice(0, pageSize);
          if (fromCache || windowDocs.length === 0) {
            update((prev) => ({
              ...prev,
              ready: true,
              entries: windowDocs.map(toEntry),
              sourceState: nextSource(prev.sourceState),
              error: null,
            }));
            return;
          }

          const newAnchor = windowDocs[windowDocs.length - 1];
          update((prev) => ({
            ...prev,
            ready: true,
            entries: windowDocs.map(toEntry),
            anchor: newAnchor,
            olderExists: docs.length > pageSize,
            sourceState: 'live',
            error: null,
          }));
          unsubscribe?.();
          unsubscribe = null;
          listen(newAnchor);
        },
        (error) => {
          if (disposed) return;
          unsubscribe?.();
          unsubscribe = null;
          if (isPermissionDeniedError(error) && attempt < RESUBSCRIBE_DELAYS_MS.length) {
            const delay = RESUBSCRIBE_DELAYS_MS[attempt];
            attempt += 1;
            update((prev) => ({ ...prev, sourceState: 'connecting' }));
            retryTimer = setTimeout(() => listen(currentAnchor), delay);
            return;
          }
          console.error('[useFirestoreLiveInfinite] Subscription error:', error);
          update((prev) => ({ ...prev, sourceState: 'error', error }));
        },
      );
    };

    listen(currentAnchor);

    return () => {
      disposed = true;
      if (retryTimer) clearTimeout(retryTimer);
      unsubscribe?.();
    };
    // `identity` carries collectionPath, queryKey, orderByField, constraints, pageSize, and
    // enabled; constraints are read from the render that produced it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [db, identity, retryNonce, toEntry]);

  const anchor = enabled ? current.anchor : null;
  const olderEnabled = anchor !== null && current.olderExists;

  const older = useInfiniteQuery({
    queryKey: [...queryKey, 'older', identity, anchor?.id ?? null],
    enabled: olderEnabled,
    initialPageParam: undefined as Snap | undefined,
    queryFn: async ({ pageParam }) => {
      const cursor = pageParam ?? anchor;
      if (!cursor) {
        return { entries: [] as Entry<T>[], nextCursor: undefined as Snap | undefined };
      }
      const colRef = collection(db, collectionPath);
      const q = query(
        colRef,
        ...constraints,
        orderBy(orderByField, 'desc'),
        startAfter(cursor),
        limit(pageSize + 1),
      );
      const snap = await getDocs(q);
      const docs = snap.docs as Snap[];
      const page = docs.slice(0, pageSize);
      return {
        entries: page.map(toEntry),
        nextCursor: docs.length > pageSize ? page[page.length - 1] : undefined,
      };
    },
    getNextPageParam: (last) => last.nextCursor,
  });

  const {
    data: olderData,
    isFetching: olderFetching,
    isError: olderIsError,
    error: olderErr,
    hasNextPage: olderHasNext,
    fetchNextPage,
    refetch: refetchOlder,
  } = older;

  const olderPages = olderEnabled ? olderData?.pages : undefined;
  const hasOlder = olderEnabled && (olderPages ? Boolean(olderHasNext) : true);
  const olderError = olderEnabled && olderIsError ? olderErr : null;

  const fetchOlder = React.useCallback(async () => {
    if (!olderEnabled || olderFetching) return;
    if (!olderPages) {
      await refetchOlder();
      return;
    }
    if (olderHasNext) await fetchNextPage();
  }, [olderEnabled, olderFetching, olderPages, olderHasNext, refetchOlder, fetchNextPage]);

  const listenerFailed = enabled && current.error !== null;
  const retry = React.useCallback(() => {
    if (listenerFailed) {
      setWindowState((prev) =>
        prev.identity === identity ? { ...prev, error: null, sourceState: 'connecting' } : prev,
      );
      setRetryNonce((n) => n + 1);
    }
    if (olderError && !olderFetching) {
      if (olderPages) void fetchNextPage();
      else void refetchOlder();
    }
  }, [listenerFailed, identity, olderError, olderFetching, olderPages, fetchNextPage, refetchOlder]);

  const items = React.useMemo(() => {
    if (!enabled) return [];
    const olderEntries = (olderPages ?? []).flatMap((p) => p.entries);
    // Live entries win on overlap (they are the freshest copies).
    const merged = new Map<string, Entry<T>>();
    for (const entry of [...current.entries, ...olderEntries]) {
      if (!merged.has(entry.docId)) merged.set(entry.docId, entry);
    }
    const arr = Array.from(merged.values());
    arr.sort((a, b) => (sort === 'asc' ? a.sortValue - b.sortValue : b.sortValue - a.sortValue));
    return arr.map((e) => e.item);
  }, [enabled, olderPages, current.entries, sort]);

  return {
    items,
    isInitialLoading: enabled ? !current.ready && current.error === null : false,
    sourceState: current.sourceState,
    error: enabled ? current.error : null,
    fetchOlder,
    hasOlder,
    isFetchingOlder: olderEnabled && olderFetching,
    olderError,
    retry,
  };
}
