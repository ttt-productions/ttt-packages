'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useQueries, useQueryClient } from '@tanstack/react-query';
import type { Firestore } from 'firebase/firestore';
import { isListenerOwned, subscribeDoc } from './doc-subscription-registry.js';
import { getDocLoader } from './batch-doc-loader.js';
import { ABSENT_RETRY_DELAYS_MS, trackAbsentDoc } from './absence-scheduler.js';

/** Transport used to resolve an id in one-shot mode. */
export type BatchFirestoreDocsTransport = 'batch' | 'get';

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
   * Each document is cached as [queryKeyPrefix, docId]
   * @example 'publicUser' -> ['publicUser', 'user123']
   */
  queryKeyPrefix: string;

  /**
   * Time in milliseconds a PRESENT document stays fresh (default: 30 minutes).
   * An absent document uses `absentStaleTime` instead.
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
   * reference-counted `onSnapshot` listener instead of a one-shot read:
   * - a missing doc caches `null` (negative caching) and resolves the instant it appears,
   * - identity edits propagate live, and every browser tab stays consistent,
   * - `staleTime` is irrelevant (listeners keep the cache fresh) and `refetch()` is a no-op.
   * Initial read cost matches the one-shot path; listeners then stay open while mounted.
   * Use for small, frequently-rendered, change-sensitive docs owned by the signed-in user.
   */
  subscribe?: boolean;

  /**
   * One-shot transport (default: `'batch'`).
   *
   * - `'batch'` — ids enqueued in the same microtask are coalesced into
   *   `where(documentId(), 'in', …)` queries of at most 30 ids each. Fewest round-trips.
   * - `'get'` — one `getDoc` per id, run concurrently. Required for a collection whose
   *   Firestore rules gate reads on `resource.data`: an unconstrained id-list query is
   *   denied WHOLESALE there, while per-document gets are evaluated per document, so one
   *   unreadable id errors alone instead of failing every id with it. On such a collection
   *   a get against a nonexistent doc is also denied, so "absent" and "hidden" are the same
   *   client-visible signal — the id surfaces as that query's error, never as a null.
   */
  transport?: BatchFirestoreDocsTransport;

  /**
   * Time in milliseconds an ABSENT (`null`) result stays fresh (default: 30 seconds).
   * Deliberately much shorter than `staleTime`: a missing doc is usually a doc that has
   * not been mirrored/created YET, and holding "missing" as fresh for the full staleTime
   * is what leaves a row blank long after the doc appears.
   */
  absentStaleTime?: number;

  /**
   * Backoff ladder (ms) for re-reading an id that resolved absent, one re-read per rung
   * per absence episode (default: {@link ABSENT_RETRY_DELAYS_MS}). Pass `[]` to ask for no
   * re-reads.
   *
   * The timer is per cache key, so many consumers of the same absent id still cost one
   * re-read per rung — and consumers that disagree combine by UNION, never by mount order:
   * the key polls if ANY mounted consumer wants polling, on the LONGEST ladder among them.
   * `[]` therefore only silences re-reads that no other mounted consumer asked for. The
   * effective ladder is recomputed on every mount and unmount; an episode already in
   * progress continues on the new ladder's remaining rungs, or stops if it is now empty.
   */
  absentRetryDelaysMs?: readonly number[];
};

export type BatchFirestoreDocsResult<T> = {
  /**
   * Map of docId -> document data.
   * Only includes documents that exist AND are currently readable: an id whose query is in
   * an error state is excluded, so a previously cached doc is never presented as readable
   * after access to it fails.
   */
  data: Record<string, T>;

  /**
   * True while any requested id has not resolved yet
   */
  isLoading: boolean;

  /**
   * True if any requested id is in an error state
   */
  isError: boolean;

  /**
   * First error across the requested ids, if any
   */
  error: Error | null;

  /**
   * Refetch every requested id, cached ones included. A no-op in subscribe mode.
   */
  refetch: () => Promise<void>;
};

function shallowRecordEqual<T>(a: Record<string, T>, b: Record<string, T>): boolean {
  const aKeys = Object.keys(a);
  if (aKeys.length !== Object.keys(b).length) return false;
  for (const key of aKeys) {
    if (!Object.prototype.hasOwnProperty.call(b, key) || a[key] !== b[key]) return false;
  }
  return true;
}

/**
 * Resolve many document ids into individually observed, individually cached React Query
 * entries at `[queryKeyPrefix, id]`.
 *
 * There is exactly ONE data cache: the per-id entries. Each id owns a real query with a
 * real `queryFn`, so exact-key invalidation, `refetchQueries({ type: 'active' })`, and
 * `refetchOnMount` all work on a single id the way they work on any other query — and the
 * returned `data` is derived reactively from those query results, never read imperatively.
 *
 * A nonexistent document resolves to `null` (negative caching) and is excluded from `data`;
 * an absent id is then re-read on a bounded ladder (see `absentRetryDelaysMs`) so a doc
 * that appears shortly afterwards shows up without an invalidation.
 *
 * @example
 * ```typescript
 * const { data: users, isLoading } = useBatchFirestoreDocs<PublicUser>({
 *   db,
 *   collectionPath: 'publicUsers',
 *   ids: ['user1', 'user2', 'user3'],
 *   queryKeyPrefix: 'publicUser',
 *   staleTime: 30 * 60 * 1000,
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
  transport = 'batch',
  absentStaleTime = 30 * 1000,
  absentRetryDelaysMs = ABSENT_RETRY_DELAYS_MS,
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
  // Listener errors cannot surface through the per-id queries (they are disabled while
  // subscribed), so they are tracked here and merged into the returned result.
  const [subscribeError, setSubscribeError] = useState<Error | null>(null);
  // Snapshot re-render trigger. The per-id query observers do notify on the listener's
  // cache write, but only on React Query's batched microtask; bumping state in the
  // snapshot callback keeps a landed snapshot visible in the SAME tick it arrives.
  const [, setSnapshotVersion] = useState(0);

  const results = useQueries({
    queries: uniqueIds.map((id) => ({
      queryKey: [queryKeyPrefix, id],
      queryFn: async ({ signal }: { signal: AbortSignal }): Promise<T | null> => {
        const loader = getDocLoader(queryClient, db, collectionPath);
        const loaded =
          transport === 'get' ? await loader.loadOne(id, signal) : await loader.loadBatched(id, signal);
        // If a shared listener took ownership of this key while the read was in flight, the
        // listener's value is the newer truth — `onSnapshot` will not re-emit until the doc
        // changes, so returning the read result here would leave a stale value stuck.
        if (isListenerOwned(queryClient, queryKeyPrefix, id)) {
          const owned = queryClient.getQueryData([queryKeyPrefix, id]);
          if (owned !== undefined) return owned as T | null;
        }
        return loaded as T | null;
      },
      enabled: enabled && !subscribe,
      // The consuming app's global default is `refetchOnMount: false`; these lookups opt
      // back in so a remount re-reads a STALE id (refetch-on-mount never fires on a fresh
      // one, so an all-cache-hit mount still costs nothing).
      refetchOnMount: !subscribe,
      staleTime: subscribe
        ? Infinity
        : (query: { state: { data: unknown } }) =>
            query.state.data === null ? absentStaleTime : staleTime,
      gcTime,
    })),
  });

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
        onUpdate: () => setSnapshotVersion((version) => version + 1),
        onError: (error) => setSubscribeError(error),
      }),
    );
    return () => {
      for (const unsubscribe of unsubscribers) unsubscribe();
    };
  }, [uniqueIds, subscribe, enabled, collectionPath, queryKeyPrefix, queryClient, db]);

  // Bounded re-read ladder for ids that resolved absent. Registration is per cache key, so
  // overlapping consumers share one episode budget. The ladder is rebuilt from its own
  // serialized form so an inline array literal cannot re-register (and reset it) every render.
  const absentDelaysKey = absentRetryDelaysMs.join(',');
  const absentDelays = useMemo(
    () => absentDelaysKey.split(',').filter(Boolean).map(Number),
    [absentDelaysKey],
  );

  useEffect(() => {
    if (uniqueIds.length === 0) return;
    const releases = uniqueIds.map((id) =>
      trackAbsentDoc({ queryClient, queryKey: [queryKeyPrefix, id], delays: absentDelays }),
    );
    return () => {
      for (const release of releases) release();
    };
  }, [uniqueIds, queryKeyPrefix, queryClient, absentDelays]);

  const nextData: Record<string, T> = {};
  let anyError: Error | null = null;
  let oneShotLoading = false;
  let anyUnresolved = false;

  for (let index = 0; index < uniqueIds.length; index += 1) {
    const result = results[index];
    if (!result) continue;
    if (result.isError) {
      anyError ??= (result.error as Error | null) ?? null;
      continue;
    }
    if (result.isLoading) oneShotLoading = true;
    const value = result.data as T | null | undefined;
    if (value === undefined) anyUnresolved = true;
    else if (value) nextData[uniqueIds[index]] = value;
  }

  // The map is rebuilt every render; keep the last COMMITTED object while it is unchanged so
  // consumers can safely depend on `data`'s identity. Only the effect writes the ref, so a
  // concurrent render React discards can never leave it pointing at an uncommitted map.
  const committedDataRef = useRef<Record<string, T>>(nextData);
  const data = shallowRecordEqual(committedDataRef.current, nextData)
    ? committedDataRef.current
    : nextData;

  useEffect(() => {
    committedDataRef.current = data;
  }, [data]);

  const refetch = useCallback(async () => {
    // Subscribe mode owns its freshness through the shared listeners — refetching would
    // issue reads against disabled queries and race the listener's value.
    if (subscribe || !enabled) return;
    await Promise.all(
      uniqueIds.map((id) =>
        queryClient.refetchQueries({ queryKey: [queryKeyPrefix, id], exact: true }),
      ),
    );
  }, [uniqueIds, subscribe, enabled, queryClient, queryKeyPrefix]);

  // In subscribe mode "loading" means a subscribed id has no cache entry yet (`null`
  // counts as resolved-missing).
  const isLoading = subscribe ? enabled && anyUnresolved : oneShotLoading;

  return {
    data,
    isLoading,
    isError: anyError !== null || subscribeError !== null,
    error: anyError ?? subscribeError,
    refetch,
  };
}
