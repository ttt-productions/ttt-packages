import type {
  DocumentData,
  DocumentSnapshot,
  QueryDocumentSnapshot,
  QueryConstraint,
} from 'firebase/firestore';
import type { WithId, FirestoreBaseOptions } from '../../firestore/types.js';

/**
 * Extract document data with ID from a QueryDocumentSnapshot.
 */
export function docWithId<T extends DocumentData>(snap: QueryDocumentSnapshot<T>): WithId<T> {
  return { id: snap.id, ...snap.data() };
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
  /** Re-read the displayed page every `refetchInterval` ms while it is mounted (omit for none). */
  refetchInterval?: number;
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
  /** Output ordering of the merged list, by `orderByField` as Firestore orders it. Default 'asc' (oldest → newest). */
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
 * One page's cache entry for `useFirestorePaginated`, stored at `[...queryKey, 'page', n]`:
 * the page's rows, its last row (the next page's cursor; `null` for an empty page), and
 * whether a further page exists (read with a one-row look-ahead), and the id of the row it
 * was read after (`null` for page 1), checked against the previous page's cursor.
 */
export interface PaginatedPage<T> {
  items: T[];
  cursor: DocumentSnapshot | null;
  hasMore: boolean;
  after: string | null;
}

/**
 * Mutation operation types for batch mutations.
 */
export type MutationOperation =
  | { type: 'set'; docPath: string; data: DocumentData; merge?: boolean }
  | { type: 'update'; docPath: string; data: DocumentData }
  | { type: 'delete'; docPath: string };
