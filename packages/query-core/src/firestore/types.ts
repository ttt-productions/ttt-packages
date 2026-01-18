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
  /** Collection path (e.g., 'users' or 'projects/abc/members') */
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
