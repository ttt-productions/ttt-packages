'use client';

import * as React from 'react';
import { useInfiniteQuery, useQueryClient } from '@tanstack/react-query';
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
import type { FirestoreSourceState } from '../../firestore/types.js';
import type { FirestoreLiveInfiniteOptions } from './types.js';
import { useSerializedIdentity } from './stable-inputs.js';

const MAX_PAGE_SIZE = 100;

export interface FirestoreLiveInfiniteResult<T> {
  items: T[];
  isInitialLoading: boolean;
  sourceState: FirestoreSourceState;
  error: Error | null;
  fetchOlder: () => Promise<void>;
  hasOlder: boolean;
  isFetchingOlder: boolean;
  olderError: Error | null;
  retry: () => void;
}

type Entry<T> = { docId: string; item: T };
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

export function useFirestoreLiveInfinite<T = DocumentData & { id: string }>({
  collectionPath,
  queryKey,
  orderByField,
  constraints = [],
  pageSize: requestedPageSize = 20,
  enabled = true,
  select,
  sort = 'asc',
}: FirestoreLiveInfiniteOptions<T>): FirestoreLiveInfiniteResult<T> {
  const db = useFirestoreDb();
  const queryClient = useQueryClient();
  const pageSize = Math.min(requestedPageSize, MAX_PAGE_SIZE);

  const selectRef = React.useRef(select);
  selectRef.current = select;

  const toEntry = React.useCallback((snap: Snap): Entry<T> => {
    const dataWithId: DocumentData & { id: string } = { id: snap.id, ...snap.data() };
    const item = selectRef.current ? selectRef.current(dataWithId) : (dataWithId as unknown as T);
    return { docId: snap.id, item };
  }, []);

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
  const stableQueryKey = useSerializedIdentity(queryKey, queryKeyMemo);
  const stableConstraints = useSerializedIdentity(constraints, constraintsMemo);

  const [windowState, setWindowState] = React.useState<WindowState<T>>(() => freshWindow(identity));
  const windowRef = React.useRef(windowState);
  windowRef.current = windowState;
  const [retryNonce, setRetryNonce] = React.useState(0);

  const current: WindowState<T> =
    windowState.identity === identity ? windowState : freshWindow<T>(identity);

  React.useEffect(() => {
    if (!enabled) {
      setWindowState(freshWindow<T>(identity));
      return;
    }

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
        ? query(colRef, ...stableConstraints, orderBy(orderByField, 'desc'), endAt(anchor))
        : query(colRef, ...stableConstraints, orderBy(orderByField, 'desc'), limit(pageSize + 1));
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
          if (isPermissionDeniedError(error)) {
            currentAnchor = null;
            queryClient.removeQueries({ queryKey: [...stableQueryKey, 'older', identity] });
            update(() => ({ ...freshWindow<T>(identity), sourceState: 'error', error }));
            return;
          }
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
  }, [
    db,
    identity,
    retryNonce,
    toEntry,
    queryClient,
    enabled,
    collectionPath,
    stableConstraints,
    orderByField,
    pageSize,
    stableQueryKey,
  ]);

  const anchor = enabled ? current.anchor : null;
  const olderEnabled = anchor !== null && current.olderExists;

  const older = useInfiniteQuery({
    queryKey: [...queryKey, 'older', identity, anchor?.id ?? null],
    enabled: false,
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
  }, [
    listenerFailed,
    identity,
    olderError,
    olderFetching,
    olderPages,
    fetchNextPage,
    refetchOlder,
  ]);

  const olderEntries = React.useMemo(
    () => (olderPages ?? []).flatMap((p) => p.entries),
    [olderPages],
  );

  const items = React.useMemo(() => {
    if (!enabled) return [];
    const liveIds = new Set(current.entries.map((entry) => entry.docId));
    const newestFirst = [
      ...current.entries.map((entry) => entry.item),
      ...olderEntries.filter((entry) => !liveIds.has(entry.docId)).map((entry) => entry.item),
    ];
    return sort === 'desc' ? newestFirst : newestFirst.reverse();
  }, [enabled, olderEntries, current.entries, sort]);

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
