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
 * One requested id's answer from `useBatchFirestoreDocs`:
 * - `loading` — no answer yet (nothing cached for the id, or the hook is disabled).
 * - `present` — the document exists and is readable; `data` is it.
 * - `absent` — the read succeeded and the document does not exist.
 * - `failed` — the read (or, in subscribe mode, the listener) errored; `error` is the cause.
 *   A failure is never reported as `absent`, and a document cached before the failure is
 *   not reported as `present`. What a failure means for a given collection (a rules denial
 *   that stands for "not there for this reader", say) is the consumer's to decide from `error`.
 * - A failed id stays `failed` through a retry of it, with the failure it showed and `retrying`
 *   true while the retry runs; an answer replaces it, a new failure replaces its `error`.
 */
export type BatchFirestoreDocOutcome<T> =
  | { status: 'loading' }
  | { status: 'present'; data: T }
  | { status: 'absent' }
  | { status: 'failed'; error: Error; retrying: boolean };

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
