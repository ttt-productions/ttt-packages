'use client';

import {
  collection,
  doc,
  onSnapshot,
  query,
  type DocumentData,
  type Firestore,
  type QueryConstraint,
} from 'firebase/firestore';
import type { QueryCacheNotifyEvent, QueryClient, QueryKey } from '@tanstack/react-query';
import type { FirestoreSourceState } from '../../firestore/types.js';
import { clientScoped } from './client-scoped.js';
import { RESUBSCRIBE_DELAYS_MS, isPermissionDeniedError } from './resubscribe.js';

export interface PendingRestart {
  fromError: boolean;
  failure: Error | null;
}

type Select = (data: DocumentData & { id: string }) => unknown;

export interface LiveReadHandlers {
  next: (data: unknown, fromCache: boolean) => void;
  error: (error: Error) => void;
}

export interface LiveReadTarget {
  db: Firestore;
  path: string;
  signature: string;
  label: string;
  open: (selectOf: () => Select | undefined, handlers: LiveReadHandlers) => () => void;
}

export interface LiveReadStatus {
  signature: string;
  db: Firestore;
  path: string;
  carried: boolean;
  error: Error | null;
  sourceState: FirestoreSourceState;
  restart: PendingRestart | null;
}

export type LiveReadIdentity = Pick<LiveReadTarget, 'db' | 'path' | 'signature'>;

export function collectionTarget(
  db: Firestore,
  path: string,
  constraints: QueryConstraint[],
  constraintsSignature: string,
): LiveReadTarget {
  return {
    db,
    path,
    signature: JSON.stringify(['collection', path, constraintsSignature]),
    label: '[useFirestoreCollection]',
    open: (selectOf, { next, error }) => {
      const collectionRef = collection(db, path);
      const q = constraints.length > 0 ? query(collectionRef, ...constraints) : collectionRef;
      return onSnapshot(
        q,
        { includeMetadataChanges: true },
        (snapshot) => {
          const select = selectOf();
          next(
            snapshot.docs.map((docSnap) => {
              const dataWithId = { id: docSnap.id, ...docSnap.data() };
              return select ? select(dataWithId) : dataWithId;
            }),
            snapshot.metadata?.fromCache ?? false,
          );
        },
        error,
      );
    },
  };
}

export function docTarget(db: Firestore, path: string): LiveReadTarget {
  return {
    db,
    path,
    signature: JSON.stringify(['doc', path]),
    label: '[useFirestoreDoc]',
    open: (selectOf, { next, error }) =>
      onSnapshot(
        doc(db, path),
        { includeMetadataChanges: true },
        (snapshot) => {
          const dataWithId = snapshot.exists() ? { id: snapshot.id, ...snapshot.data() } : null;
          const select = selectOf();
          next(
            dataWithId && select ? select(dataWithId) : dataWithId,
            snapshot.metadata?.fromCache ?? false,
          );
        },
        error,
      ),
  };
}

interface Mount {
  select: { readonly current: Select | undefined };
}

interface Entry {
  queryKey: QueryKey;
  target: LiveReadTarget;
  status: LiveReadStatus;
  mounts: Set<Mount>;
  unsubscribe: (() => void) | null;
  retryTimer: ReturnType<typeof setTimeout> | null;
  attempt: number;
  generation: number;
  unwatchCache: () => void;
}

interface Registry {
  entries: Map<string, Entry>;
  watchers: Map<string, Set<() => void>>;
}

const registryOf = clientScoped<Registry>(() => ({ entries: new Map(), watchers: new Map() }));

function freshStatus(identity: LiveReadIdentity, carried = false): LiveReadStatus {
  return {
    signature: identity.signature,
    db: identity.db,
    path: identity.path,
    carried,
    error: null,
    sourceState: 'connecting',
    restart: null,
  };
}

export function liveReadStatusFor(
  shared: LiveReadStatus | null,
  identity: LiveReadIdentity,
): LiveReadStatus {
  if (shared === null) return freshStatus(identity);
  if (shared.signature === identity.signature && shared.db === identity.db) return shared;
  const answered =
    shared.error === null &&
    (shared.sourceState === 'live' ||
      shared.sourceState === 'offline' ||
      (shared.carried && shared.sourceState === 'connecting'));
  return freshStatus(
    identity,
    answered && shared.db === identity.db && shared.path === identity.path,
  );
}

export function sharedLiveReadStatus(queryClient: QueryClient, key: string): LiveReadStatus | null {
  return registryOf(queryClient).entries.get(key)?.status ?? null;
}

export function watchLiveRead(
  queryClient: QueryClient,
  key: string,
  onChange: () => void,
): () => void {
  const { watchers } = registryOf(queryClient);
  let set = watchers.get(key);
  if (!set) {
    set = new Set();
    watchers.set(key, set);
  }
  set.add(onChange);
  return () => {
    const current = watchers.get(key);
    current?.delete(onChange);
    if (current?.size === 0) watchers.delete(key);
  };
}

function notifyWatchers(registry: Registry, key: string) {
  for (const onChange of [...(registry.watchers.get(key) ?? [])]) onChange();
}

function setStatus(registry: Registry, key: string, entry: Entry, status: LiveReadStatus) {
  entry.status = status;
  notifyWatchers(registry, key);
}

function stopListening(entry: Entry) {
  entry.generation += 1;
  if (entry.retryTimer) clearTimeout(entry.retryTimer);
  entry.retryTimer = null;
  entry.unsubscribe?.();
  entry.unsubscribe = null;
}

function latestSelect(entry: Entry): Select | undefined {
  let latest: Mount | undefined;
  for (const mount of entry.mounts) latest = mount;
  return latest?.select.current;
}

function listen(queryClient: QueryClient, key: string, entry: Entry) {
  stopListening(entry);
  const registry = registryOf(queryClient);
  const generation = entry.generation;
  const current = () => entry.generation === generation && registry.entries.get(key) === entry;

  entry.unsubscribe = entry.target.open(() => latestSelect(entry), {
    next: (data, fromCache) => {
      if (!current()) return;
      entry.attempt = 0;
      queryClient.setQueryData(entry.queryKey, data);
      const prev = entry.status;
      const sourceState: FirestoreSourceState = fromCache
        ? prev.sourceState === 'connecting'
          ? 'connecting'
          : 'offline'
        : 'live';
      setStatus(registry, key, entry, {
        ...prev,
        error: null,
        restart: null,
        sourceState,
        carried: sourceState === 'connecting' ? prev.carried : false,
      });
    },
    error: (error) => {
      if (!current()) return;
      if (isPermissionDeniedError(error) && entry.attempt < RESUBSCRIBE_DELAYS_MS.length) {
        entry.unsubscribe?.();
        entry.unsubscribe = null;
        const delay = RESUBSCRIBE_DELAYS_MS[entry.attempt];
        entry.attempt += 1;
        setStatus(registry, key, entry, {
          ...entry.status,
          sourceState: 'connecting',
          carried: false,
        });
        entry.retryTimer = setTimeout(() => {
          if (current()) listen(queryClient, key, entry);
        }, delay);
        return;
      }
      console.error(`${entry.target.label} Subscription error:`, error);
      setStatus(registry, key, entry, {
        ...entry.status,
        error,
        sourceState: 'error',
        restart: null,
        carried: false,
      });
    },
  });
}

function isCacheEntryDropped(event: QueryCacheNotifyEvent, queryHash: string): boolean {
  if (event.query.queryHash !== queryHash) return false;
  if (event.type === 'removed') return true;
  return (
    event.type === 'updated' &&
    event.action.type === 'setState' &&
    event.query.state.data === undefined
  );
}

function watchCacheEntry(queryClient: QueryClient, key: string, entry: Entry): () => void {
  return queryClient.getQueryCache().subscribe((event) => {
    const registry = registryOf(queryClient);
    if (registry.entries.get(key) !== entry || entry.mounts.size === 0) return;
    if (!isCacheEntryDropped(event, key)) return;
    entry.attempt = 0;
    setStatus(registry, key, entry, {
      ...entry.status,
      carried: false,
      error: null,
      sourceState: 'connecting',
    });
    listen(queryClient, key, entry);
  });
}

export interface AcquireLiveReadParams {
  queryClient: QueryClient;
  key: string;
  queryKey: QueryKey;
  target: LiveReadTarget;
  select: Mount['select'];
}

export function acquireLiveRead({
  queryClient,
  key,
  queryKey,
  target,
  select,
}: AcquireLiveReadParams): () => void {
  const registry = registryOf(queryClient);
  const mount: Mount = { select };
  const existing = registry.entries.get(key);
  if (existing) {
    existing.mounts.add(mount);
    retargetLiveRead(queryClient, key, target);
  } else {
    const entry: Entry = {
      queryKey,
      target,
      status: freshStatus(target),
      mounts: new Set([mount]),
      unsubscribe: null,
      retryTimer: null,
      attempt: 0,
      generation: 0,
      unwatchCache: () => {},
    };
    registry.entries.set(key, entry);
    entry.unwatchCache = watchCacheEntry(queryClient, key, entry);
    notifyWatchers(registry, key);
    listen(queryClient, key, entry);
  }

  let released = false;
  return () => {
    if (released) return;
    released = true;
    const entry = registry.entries.get(key);
    if (!entry) return;
    entry.mounts.delete(mount);
    if (entry.mounts.size > 0) return;
    // React runs every passive cleanup of a commit before its passive mounts, so a mount of the
    // same key arriving in that commit acquires only after this release; the teardown waits until
    // that commit's effects are done.
    queueMicrotask(() => {
      if (entry.mounts.size > 0 || registry.entries.get(key) !== entry) return;
      stopListening(entry);
      entry.unwatchCache();
      registry.entries.delete(key);
      notifyWatchers(registry, key);
    });
  };
}

export function retargetLiveRead(
  queryClient: QueryClient,
  key: string,
  target: LiveReadTarget,
): void {
  const registry = registryOf(queryClient);
  const entry = registry.entries.get(key);
  if (!entry) return;
  if (entry.target.signature === target.signature && entry.target.db === target.db) return;
  entry.target = target;
  entry.attempt = 0;
  setStatus(registry, key, entry, liveReadStatusFor(entry.status, target));
  listen(queryClient, key, entry);
}

export function restartLiveRead(
  queryClient: QueryClient,
  key: string,
  identity: LiveReadIdentity,
): boolean {
  const registry = registryOf(queryClient);
  const entry = registry.entries.get(key);
  if (!entry || entry.target.signature !== identity.signature || entry.target.db !== identity.db) {
    return false;
  }
  if (entry.status.restart !== null) return true;
  const base = entry.status;
  entry.attempt = 0;
  setStatus(registry, key, entry, {
    ...base,
    carried: false,
    error: null,
    sourceState: 'connecting',
    restart: { fromError: base.error !== null, failure: base.error },
  });
  listen(queryClient, key, entry);
  return true;
}
