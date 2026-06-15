import type {
  DocumentData,
  DocumentSnapshot,
  QueryDocumentSnapshot,
  QueryConstraint,
} from 'firebase/firestore';

/**
 * Document with ID included in the data object.
 */
export type WithId<T> = T & { id: string };

/**
 * Metadata-derived liveness of a realtime subscription. Firestore serves cached
 * snapshots offline WITHOUT firing the error callback, so error-only detection
 * renders a stale cached empty result as "live". This four-state is derived from
 * `snapshot.metadata.fromCache` (server-confirmed vs cache) plus the listener
 * error callback:
 * - `connecting` — no server-confirmed snapshot yet (initial, or only cache-first data).
 * - `live` — at least one server-confirmed snapshot (`fromCache === false`).
 * - `offline` — only cached data after having been live (connectivity loss).
 * - `error` — the listener error callback fired (e.g. permission loss).
 *
 * Meaningful only for `subscribe: true`; a non-subscribed hook stays `connecting`.
 */
export type FirestoreSourceState = 'connecting' | 'live' | 'offline' | 'error';

/** A query-hook result augmented with the metadata-derived subscription source state. */
export type WithSourceState<R> = R & { sourceState: FirestoreSourceState };

/**
 * Extract document data with ID from a QueryDocumentSnapshot.
 */
export function docWithId<T extends DocumentData>(
  snap: QueryDocumentSnapshot<T>
): WithId<T> {
  return { id: snap.id, ...snap.data() };
}

/**
 * Base options shared across all Firestore hooks.
 */
export interface FirestoreBaseOptions {
  /** React Query cache key */
  queryKey: readonly unknown[];
  /** Enable/disable the query */
  enabled?: boolean;
  /** Stale time override (ms) */
  staleTime?: number;
  /** Garbage collection time override (ms) */
  gcTime?: number;
}

/**
 * Options for single document queries.
 */
export interface FirestoreDocOptions<T> extends FirestoreBaseOptions {
  /** Full document path (e.g., 'users/abc123') */
  docPath: string;
  /** Enable realtime updates via onSnapshot (default: false) */
  subscribe?: boolean;
  /** Transform function applied to document data. Receives data WITH id included. */
  select?: (data: DocumentData & { id: string }) => T;
}

/**
 * Options for collection queries.
 */
export interface FirestoreCollectionOptions<T> extends FirestoreBaseOptions {
  /** Collection path (e.g., 'users' or 'entities/abc/members') */
  collectionPath: string;
  /** Firestore query constraints (where, orderBy, etc.) */
  constraints?: QueryConstraint[];
  /** Enable realtime updates via onSnapshot (default: false) */
  subscribe?: boolean;
  /** Transform function applied to each document. Receives data WITH id included. */
  select?: (data: DocumentData & { id: string }) => T;
}

/**
 * Options for infinite scroll queries.
 */
export interface FirestoreInfiniteOptions<T> extends FirestoreBaseOptions {
  /** Collection path */
  collectionPath: string;
  /** Firestore query constraints (where, orderBy - required for pagination) */
  constraints?: QueryConstraint[];
  /** Number of items per page (default: 20) */
  pageSize?: number;
  /** Transform function applied to each document. Receives data WITH id included. */
  select?: (data: DocumentData & { id: string }) => T;
}

/**
 * Options for paginated queries with page numbers.
 */
export interface FirestorePaginatedOptions<T> extends FirestoreBaseOptions {
  /** Collection path */
  collectionPath: string;
  /** Firestore query constraints */
  constraints?: QueryConstraint[];
  /** Number of items per page (default: 10) */
  pageSize?: number;
  /** Initial page number (default: 1) */
  initialPage?: number;
  /** Transform function applied to each document. Receives data WITH id included. */
  select?: (data: DocumentData & { id: string }) => T;
}

/**
 * Options for count() aggregation queries.
 */
export interface FirestoreCountOptions extends FirestoreBaseOptions {
  /** Collection path */
  collectionPath: string;
  /** Firestore query constraints (where, etc.) applied before counting */
  constraints?: QueryConstraint[];
  /** Polling interval in ms (omit for no polling) */
  refetchInterval?: number;
}

/**
 * Options for a live newest-window + cursor-bridged older-pages list
 * (e.g. chat messages, live comment threads, live activity feeds). The newest
 * page is a realtime onSnapshot window; older pages load on demand via getDocs,
 * seeded from the window's oldest document so there is no gap or re-read.
 */
export interface FirestoreLiveInfiniteOptions<T = DocumentData & { id: string }> {
  /** Collection path (slash-joined for nested paths, e.g. 'chats/t1/messages'). */
  collectionPath: string;
  /** React Query cache key. The older-pages query is keyed under `[...queryKey, 'older']`. */
  queryKey: readonly unknown[];
  /** Field both the live window and older pages order by (descending under the hood). */
  orderByField: string;
  /** Equality/filter constraints. Do NOT pass orderBy/limit/startAfter — the hook adds those. */
  constraints?: QueryConstraint[];
  /** Items per page / live-window size (default 20, capped at 100). */
  pageSize?: number;
  /** When false, no listener is opened and no pages are fetched. */
  enabled?: boolean;
  /** Map each raw doc (id included) to the item shape. Default: identity (WithId). */
  select?: (data: DocumentData & { id: string }) => T;
  /** Numeric sort key from a raw doc (id included). Default: reads `orderByField` as a number. */
  getSortValue?: (data: DocumentData & { id: string }) => number;
  /** Output ordering of the merged list. Default 'asc' (oldest → newest). */
  sort?: 'asc' | 'desc';
}

/**
 * Result page for infinite queries.
 */
export interface InfinitePage<T> {
  items: WithId<T>[];
  lastDoc: DocumentSnapshot | null;
  size: number;
}

/**
 * Result for paginated queries.
 */
export interface PaginatedResult<T> {
  items: WithId<T>[];
  cursors: DocumentSnapshot[];
  hasMore: boolean;
}

/**
 * Mutation operation types for batch mutations.
 */
export type MutationOperation =
  | { type: 'set'; docPath: string; data: DocumentData; merge?: boolean }
  | { type: 'update'; docPath: string; data: DocumentData }
  | { type: 'delete'; docPath: string };

/**
 * Options for document mutations.
 */
export interface FirestoreMutationOptions<T> {
  /** Document path for single-doc mutations */
  docPath?: string;
  /** Query keys to invalidate on success */
  invalidateKeys?: readonly unknown[][];
  /** Enable optimistic updates */
  optimistic?: {
    /** Query key of the cache to update */
    queryKey: readonly unknown[];
    /** How to update the cached data */
    updater: (oldData: T | undefined, newData: Partial<T>) => T;
  };
}

/**
 * Options for batch mutations.
 */
export interface FirestoreBatchOptions {
  /** Query keys to invalidate on success */
  invalidateKeys?: readonly unknown[][];
  /** Max operations per batch (default: 450) */
  batchSize?: number;
}
