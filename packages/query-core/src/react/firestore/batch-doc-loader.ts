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
import { chunk, FIRESTORE_IN_FILTER_LIMIT } from '@ttt-productions/firebase-helpers';

export const MAX_CONCURRENT_BATCH_REQUESTS = 4;

export const MAX_CONCURRENT_DOC_GETS = 12;

export type LoadedDoc = Record<string, unknown> & { id: string };

type Waiter = {
  resolve: (value: LoadedDoc | null) => void;
  reject: (error: unknown) => void;
};

export type DocLoader = {
  loadBatched(id: string, signal?: AbortSignal): Promise<LoadedDoc | null>;
  loadOne(id: string, signal?: AbortSignal): Promise<LoadedDoc | null>;
};

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
    for (const ids of chunk([...batch.keys()], FIRESTORE_IN_FILTER_LIMIT)) {
      void runChunk(ids, batch);
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
