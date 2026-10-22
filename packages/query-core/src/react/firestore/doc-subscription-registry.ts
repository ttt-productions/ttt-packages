'use client';

import { doc, onSnapshot, type Firestore } from 'firebase/firestore';
import type { QueryClient } from '@tanstack/react-query';
import { isPermissionDeniedError } from './resubscribe.js';

type Subscriber = {
  onUpdate: () => void;
  onError?: (error: Error) => void;
};

type Entry = {
  unsubscribe: () => void;
  subscribers: Set<Subscriber>;
  error: Error | null;
};

const registries = new WeakMap<QueryClient, Map<string, Entry>>();

function registryKey(queryKeyPrefix: string, id: string): string {
  return `${queryKeyPrefix} ${id}`;
}

export function isListenerOwned(
  queryClient: QueryClient,
  queryKeyPrefix: string,
  id: string,
): boolean {
  return registries.get(queryClient)?.has(registryKey(queryKeyPrefix, id)) ?? false;
}

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
  collectionPath: string;
  queryKeyPrefix: string;
  id: string;
  onUpdate: () => void;
  onError?: (error: Error) => void;
}

export function subscribeDoc(params: SubscribeDocParams): () => void {
  const { queryClient, db, collectionPath, queryKeyPrefix, id, onUpdate, onError } = params;
  const registry = getRegistry(queryClient);
  const key = registryKey(queryKeyPrefix, id);

  let entry = registry.get(key);
  if (!entry) {
    const created: Entry = {
      unsubscribe: () => {},
      subscribers: new Set<Subscriber>(),
      error: null,
    };
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
        created.error = error;
        const held = queryClient.getQueryData([queryKeyPrefix, id]);
        if (held === undefined || held === null || isPermissionDeniedError(error)) {
          queryClient.setQueryData([queryKeyPrefix, id], null, { updatedAt: Date.now() });
        }
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
      if (current.error) {
        void queryClient.invalidateQueries({ queryKey: [queryKeyPrefix, id], exact: true });
      }
    }
  };
}

export function __activeListenerCount(queryClient: QueryClient): number {
  return registries.get(queryClient)?.size ?? 0;
}
