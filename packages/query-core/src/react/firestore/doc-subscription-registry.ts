'use client';

import { doc, onSnapshot, type Firestore } from 'firebase/firestore';
import type { QueryClient } from '@tanstack/react-query';

/**
 * Reference-counted, real-time document subscription registry.
 *
 * Backs the `subscribe` mode of {@link useBatchFirestoreDocs}. The problem it solves:
 * many components on a page resolve the SAME document id (e.g. the same author rendered
 * in a feed card, a comment, and a mention). Without sharing, each would open its own
 * `onSnapshot` listener. This registry keeps exactly ONE Firestore listener per
 * `(queryClient, queryKeyPrefix, id)` and fans its updates out to every subscriber, so N
 * components showing the same id cost one listener.
 *
 * The single listener writes the document straight into the React Query cache at
 * `[queryKeyPrefix, id]` — `{ id, ...data }` when the doc exists, or `null` when it does
 * not (negative caching, so a missing/lagging doc resolves the instant it appears instead
 * of staying blank until staleTime). A listener ERROR also negative-caches the id: a
 * rules-denied doc (hidden, or non-existent when the rule references `resource.data`) is
 * resolved, not forever-loading — consumers see `data: null` plus the error instead
 * of an eternal spinner. Firestore ends a listener that errors, so the entry keeps that error
 * for as long as the entry lives (until its last subscriber leaves; a later snapshot, were one
 * to arrive, clears it): a subscriber that joins an errored listener receives the error too,
 * and a one-shot reader of the same key reads it through `listenerErrorOf`, so neither takes
 * the cached `null` as a missing document. The registry is keyed per `QueryClient` (a WeakMap),
 * which in practice means per browser tab, so each tab listens independently and stays
 * consistent without cross-tab plumbing.
 */

type Subscriber = {
  onUpdate: () => void;
  onError?: (error: Error) => void;
};

type Entry = {
  unsubscribe: () => void;
  subscribers: Set<Subscriber>;
  /** The listener's last error, cleared by the next snapshot. */
  error: Error | null;
};

// Per-QueryClient registry. WeakMap so a discarded QueryClient (and its entries) is GC'd.
const registries = new WeakMap<QueryClient, Map<string, Entry>>();

function registryKey(queryKeyPrefix: string, id: string): string {
  return `${queryKeyPrefix} ${id}`;
}

/**
 * True while a shared listener owns `[queryKeyPrefix, id]` for this client.
 *
 * A one-shot read that was already in flight when a consumer entered subscribe mode would
 * otherwise resolve AFTER the listener's first snapshot and overwrite it — and `onSnapshot`
 * does not re-emit until the document actually changes, so the stale value would stick.
 * The one-shot `queryFn` consults this after its read and yields to the listener's value.
 */
export function isListenerOwned(
  queryClient: QueryClient,
  queryKeyPrefix: string,
  id: string,
): boolean {
  return registries.get(queryClient)?.has(registryKey(queryKeyPrefix, id)) ?? false;
}

/**
 * The error of the shared listener that owns `[queryKeyPrefix, id]`, or `null` when no listener
 * owns the key or it has not errored. The listener writes `null` to the key when it errors, so a
 * one-shot reader of the same key consults this before taking that `null` as a missing document.
 */
export function listenerErrorOf(
  queryClient: QueryClient,
  queryKeyPrefix: string,
  id: string,
): Error | null {
  return registries.get(queryClient)?.get(registryKey(queryKeyPrefix, id))?.error ?? null;
}

function getRegistry(queryClient: QueryClient): Map<string, Entry> {
  let registry = registries.get(queryClient);
  if (!registry) {
    registry = new Map();
    registries.set(queryClient, registry);
  }
  return registry;
}

export interface SubscribeDocParams {
  queryClient: QueryClient;
  db: Firestore;
  /** Top-level/full collection path the doc lives in (e.g. 'publicUsers'). */
  collectionPath: string;
  /** Cache key prefix; the doc is cached at `[queryKeyPrefix, id]`. */
  queryKeyPrefix: string;
  id: string;
  /** Called whenever a snapshot (data or missing) lands, so the caller can re-render. */
  onUpdate: () => void;
  /** Called on listener error — and at once on joining a listener that has already errored. */
  onError?: (error: Error) => void;
}

/**
 * Subscribe to a single document via a shared, reference-counted listener.
 * Returns an idempotent unsubscribe function; the underlying Firestore listener is
 * detached only when the last subscriber for that id unsubscribes.
 */
export function subscribeDoc(params: SubscribeDocParams): () => void {
  const { queryClient, db, collectionPath, queryKeyPrefix, id, onUpdate, onError } = params;
  const registry = getRegistry(queryClient);
  const key = registryKey(queryKeyPrefix, id);

  let entry = registry.get(key);
  if (!entry) {
    const created: Entry = { unsubscribe: () => {}, subscribers: new Set<Subscriber>(), error: null };
    const subscribers = created.subscribers;
    const ref = doc(db, collectionPath, id);
    created.unsubscribe = onSnapshot(
      ref,
      (snapshot) => {
        created.error = null;
        queryClient.setQueryData(
          [queryKeyPrefix, id],
          snapshot.exists() ? { id: snapshot.id, ...snapshot.data() } : null,
          { updatedAt: Date.now() },
        );
        // Copy before iterating: an onUpdate could (re-entrantly) unsubscribe.
        for (const sub of [...subscribers]) sub.onUpdate();
      },
      (error) => {
        // Write `null` so the id resolves — as a failure, through the kept error — instead
        // of loading forever: subscribe-mode loading ("no cache entry yet") would otherwise
        // stay true for ids whose listener can never land a snapshot.
        created.error = error;
        queryClient.setQueryData([queryKeyPrefix, id], null, { updatedAt: Date.now() });
        for (const sub of [...subscribers]) sub.onError?.(error);
      },
    );
    entry = created;
    registry.set(key, entry);
  }

  const subscriber: Subscriber = { onUpdate, onError };
  entry.subscribers.add(subscriber);
  if (entry.error) onError?.(entry.error);

  let released = false;
  return () => {
    if (released) return;
    released = true;
    const current = registry.get(key);
    if (!current) return;
    current.subscribers.delete(subscriber);
    if (current.subscribers.size === 0) {
      current.unsubscribe();
      registry.delete(key);
      // A failed listener's `null` is a placeholder, not a read: once nothing owns the key,
      // mark it stale so a remaining one-shot reader reads the document for itself.
      if (current.error) {
        void queryClient.invalidateQueries({ queryKey: [queryKeyPrefix, id], exact: true });
      }
    }
  };
}

/** Test-only: number of active shared listeners for a QueryClient. */
export function __activeListenerCount(queryClient: QueryClient): number {
  return registries.get(queryClient)?.size ?? 0;
}
