'use client';

import {
  collection,
  doc,
  documentId,
  getDoc,
  getDocs,
  query,
  where,
  type Firestore,
} from 'firebase/firestore';
import type { QueryClient } from '@tanstack/react-query';

/**
 * Coalescing document loader behind {@link useBatchFirestoreDocs}'s one-shot mode.
 *
 * Every id is its own observed React Query query, so without coalescing N ids would issue
 * N Firestore round-trips. The loader collects the ids enqueued in a single microtask and
 * dispatches them as `where(documentId(), 'in', chunk)` queries of at most 30 ids each
 * (`'batch'` transport), or as concurrent per-document gets (`'get'` transport — required
 * for collections whose rules gate reads on `resource.data`, where an unconstrained list
 * query is denied wholesale but per-document gets are evaluated per doc).
 *
 * Two properties are load-bearing:
 *
 * - **The loader resolves promises only — it NEVER writes the query cache.** TanStack's
 *   per-query fetch identity is therefore the sole guard against a late batch response
 *   overwriting a newer per-id result.
 * - **A dispatched batch is closed.** A later enqueue of the same id (a refetch after a
 *   cancellation, say) always joins a NEW batch, never the in-flight one — so a cancelled
 *   read can never be served by the request it was cancelled out of.
 *
 * Cancelling one per-id query detaches only that waiter; the shared request still completes
 * for its batch-mates.
 *
 * Loaders are scoped per `(QueryClient, Firestore instance, collectionPath)`. The Firestore
 * instance is part of the scope on purpose: two `db` instances sharing a collection path
 * must never share a request.
 */

/** Firestore's hard cap on the number of values in an `in` filter. */
export const FIRESTORE_IN_LIMIT = 30;

/** Maximum `in`-query requests in flight at once, per loader scope. */
export const MAX_CONCURRENT_BATCH_REQUESTS = 4;

/** Maximum per-document gets in flight at once, per loader scope. */
export const MAX_CONCURRENT_DOC_GETS = 12;

export type LoadedDoc = Record<string, unknown> & { id: string };

type Waiter = {
  resolve: (value: LoadedDoc | null) => void;
  reject: (error: unknown) => void;
};

export type DocLoader = {
  /** Resolve one id through the coalescing `in`-query batcher. */
  loadBatched(id: string, signal?: AbortSignal): Promise<LoadedDoc | null>;
  /** Resolve one id through its own `getDoc`, bounded by the get concurrency limit. */
  loadOne(id: string, signal?: AbortSignal): Promise<LoadedDoc | null>;
};

/** Runs at most `max` tasks concurrently; a slot is released when its task settles. */
function createConcurrencyLimiter(max: number) {
  let active = 0;
  const waiting: (() => void)[] = [];

  const pump = () => {
    while (active < max && waiting.length > 0) {
      const start = waiting.shift();
      active += 1;
      start?.();
    }
  };

  const release = () => {
    active -= 1;
    pump();
  };

  return <R>(task: () => Promise<R>): Promise<R> =>
    new Promise<R>((resolve, reject) => {
      waiting.push(() => {
        task().then(
          (value) => {
            release();
            resolve(value);
          },
          (error) => {
            release();
            reject(error);
          },
        );
      });
      pump();
    });
}

function abortReason(signal: AbortSignal): unknown {
  return signal.reason ?? new Error('Document read was cancelled');
}

function createDocLoader(db: Firestore, collectionPath: string): DocLoader {
  const runBatchRequest = createConcurrencyLimiter(MAX_CONCURRENT_BATCH_REQUESTS);
  const runDocGet = createConcurrencyLimiter(MAX_CONCURRENT_DOC_GETS);

  // Ids enqueued in the CURRENT microtask. Nulled out at dispatch so the dispatched batch
  // is closed and a later enqueue opens a fresh one.
  let openBatch: Map<string, Waiter[]> | null = null;

  const runChunk = (chunk: string[], batch: Map<string, Waiter[]>) =>
    runBatchRequest(async () => {
      let found: Map<string, LoadedDoc> | null = null;
      let failure: unknown;
      try {
        const snapshot = await getDocs(
          query(collection(db, collectionPath), where(documentId(), 'in', chunk)),
        );
        found = new Map<string, LoadedDoc>();
        snapshot.forEach((snap) => {
          found!.set(snap.id, { id: snap.id, ...snap.data() } as LoadedDoc);
        });
      } catch (error) {
        failure = error;
      }

      for (const id of chunk) {
        const waiters = batch.get(id);
        batch.delete(id);
        if (!waiters) continue;
        for (const waiter of [...waiters]) {
          if (found) waiter.resolve(found.get(id) ?? null);
          else waiter.reject(failure);
        }
      }
    });

  const dispatch = () => {
    const batch = openBatch;
    openBatch = null;
    if (!batch || batch.size === 0) return;
    const ids = [...batch.keys()];
    for (let i = 0; i < ids.length; i += FIRESTORE_IN_LIMIT) {
      void runChunk(ids.slice(i, i + FIRESTORE_IN_LIMIT), batch);
    }
  };

  const loadBatched = (id: string, signal?: AbortSignal): Promise<LoadedDoc | null> =>
    new Promise<LoadedDoc | null>((resolve, reject) => {
      if (signal?.aborted) {
        reject(abortReason(signal));
        return;
      }

      if (!openBatch) {
        openBatch = new Map();
        queueMicrotask(dispatch);
      }

      const batch = openBatch;
      let slot = batch.get(id);
      if (!slot) {
        slot = [];
        batch.set(id, slot);
      }
      const waiters = slot;

      let settled = false;
      let onAbort: (() => void) | undefined;

      const settle = (run: () => void) => {
        if (settled) return;
        settled = true;
        const index = waiters.indexOf(waiter);
        if (index >= 0) waiters.splice(index, 1);
        // An id nobody is waiting on any more must not ride into a billed `in` query.
        if (waiters.length === 0 && batch.get(id) === waiters) batch.delete(id);
        if (onAbort) signal?.removeEventListener('abort', onAbort);
        run();
      };

      const waiter: Waiter = {
        resolve: (value) => settle(() => resolve(value)),
        reject: (error) => settle(() => reject(error)),
      };

      waiters.push(waiter);

      if (signal) {
        onAbort = () => waiter.reject(abortReason(signal));
        signal.addEventListener('abort', onAbort, { once: true });
      }
    });

  const loadOne = (id: string, signal?: AbortSignal): Promise<LoadedDoc | null> =>
    runDocGet(async () => {
      if (signal?.aborted) throw abortReason(signal);
      const snapshot = await getDoc(doc(db, collectionPath, id));
      return snapshot.exists() ? ({ id: snapshot.id, ...snapshot.data() } as LoadedDoc) : null;
    });

  return { loadBatched, loadOne };
}

// Per-QueryClient → per-Firestore-instance → per-collectionPath. WeakMaps so a discarded
// client or db instance takes its loaders with it.
const loaderScopes = new WeakMap<QueryClient, WeakMap<Firestore, Map<string, DocLoader>>>();

export function getDocLoader(
  queryClient: QueryClient,
  db: Firestore,
  collectionPath: string,
): DocLoader {
  let byDb = loaderScopes.get(queryClient);
  if (!byDb) {
    byDb = new WeakMap();
    loaderScopes.set(queryClient, byDb);
  }
  let byPath = byDb.get(db);
  if (!byPath) {
    byPath = new Map();
    byDb.set(db, byPath);
  }
  let loader = byPath.get(collectionPath);
  if (!loader) {
    loader = createDocLoader(db, collectionPath);
    byPath.set(collectionPath, loader);
  }
  return loader;
}
