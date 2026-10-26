import { vi } from 'vitest';
import type {
  FirestoreErrorCode,
  DocumentData,
  DocumentSnapshot,
  Firestore,
  FirestoreDataConverter,
  FirestoreError,
  Query,
  QueryDocumentSnapshot,
  QuerySnapshot,
} from 'firebase/firestore';
import { toBundleValue } from './client-values.js';
import {
  compareTuples,
  isInequality,
  matchesField,
  normalizedOrders as normalizedOrdersOf,
  valueAt,
  withinBound,
  type ComparableValue,
} from './stored-values.js';
import {
  answeredFromCache,
  countSnapshot,
  describeQuery,
  isDocumentSnapshotOf,
  missingDocumentSnapshot,
  type DescribedOrder,
  type DescribedPredicate,
  type DescribedQuery,
  withChangesSince,
} from './sdk-internals.js';

// The real SDK, though suites mock 'firebase/firestore': a mock's factory loads this module.
const sdk = await vi.importActual<typeof import('firebase/firestore')>('firebase/firestore');
const { initializeApp } = await vi.importActual<typeof import('firebase/app')>('firebase/app');

type Sdk = typeof import('firebase/firestore');

export interface ClientReadFunctions {
  getDoc: Sdk['getDoc'];
  getDocFromServer: Sdk['getDocFromServer'];
  getDocs: Sdk['getDocs'];
  getDocsFromServer: Sdk['getDocsFromServer'];
  getCountFromServer: Sdk['getCountFromServer'];
  onSnapshot: Sdk['onSnapshot'];
}

export interface ExecutedClientReadFilter {
  field: string;
  op: string;
  value: ComparableValue;
}

export interface ExecutedClientRead {
  kind: 'doc' | 'query' | 'count';
  listen: boolean;
  path: string;
  group: boolean;
  filters: readonly ExecutedClientReadFilter[];
  orders: readonly DescribedOrder[];
  limit: number;
  limitToLast: boolean;
  includeMetadataChanges: boolean;
}

export type ClientReadPredicate = (read: ExecutedClientRead) => boolean;

export interface InMemoryClientFirestore {
  readonly db: Firestore;
  readonly reads: ClientReadFunctions;
  seed(path: string, data: DocumentData): void;
  remove(path: string): void;
  reset(): void;
  read(path: string): DocumentData | undefined;
  paths(prefix?: string): string[];
  beforeRead(predicate: ClientReadPredicate, fn: () => void | Promise<void>): void;
  afterRead(predicate: ClientReadPredicate, fn: () => void | Promise<void>): void;
  failReads(predicate: ClientReadPredicate, error?: FirestoreError): void;
  failListeners(predicate: ClientReadPredicate, error?: FirestoreError): void;
  answerFromCache(predicate: ClientReadPredicate): void;
  answerFromServer(predicate: ClientReadPredicate): void;
  queries(): readonly ExecutedClientRead[];
  liveListeners(): number;
  snapshotOf(path: string, firestore?: Firestore): DocumentSnapshot;
  queryDocumentSnapshotOf(path: string, firestore?: Firestore): QueryDocumentSnapshot;
}

const BUNDLE_TIME = '2000-01-01T00:00:00.000000000Z';
const encoder = new TextEncoder();
let created = 0;

const element = (value: object): string => {
  const json = JSON.stringify(value);
  return `${encoder.encode(json).byteLength}${json}`;
};

function databaseRoot(firestore: Firestore): string {
  const projectId = firestore.app.options.projectId;
  if (!projectId)
    throw new Error('in-memory client Firestore: the Firestore instance names no projectId');
  return `projects/${projectId}/databases/(default)`;
}

const documentsRootOf = (firestore: Firestore): string => `${databaseRoot(firestore)}/documents`;

interface BundledDocument {
  path: string;
  data: DocumentData | undefined;
  query?: string;
}

function bundleOf(firestore: Firestore, id: string, named: object[], docs: BundledDocument[]) {
  const root = documentsRootOf(firestore);
  let body = named.map((namedQuery) => element({ namedQuery })).join('');
  for (const doc of docs) {
    const name = `${root}/${doc.path}`;
    body += element({
      documentMetadata: {
        name,
        readTime: BUNDLE_TIME,
        exists: doc.data !== undefined,
        ...(doc.query ? { queries: [doc.query] } : {}),
      },
    });
    if (doc.data !== undefined) {
      const fields = Object.fromEntries(
        Object.entries(doc.data)
          .filter(([, value]) => value !== undefined)
          .map(([key, value]) => [key, toBundleValue(value, root)]),
      );
      body += element({
        document: { name, fields, createTime: BUNDLE_TIME, updateTime: BUNDLE_TIME },
      });
    }
  }
  const metadata = {
    id,
    createTime: BUNDLE_TIME,
    version: 1,
    totalDocuments: docs.length,
    totalBytes: encoder.encode(body).length,
  };
  return element({ metadata }) + body;
}

function snapshotJson(firestore: Firestore, path: string, data: DocumentData) {
  return {
    type: 'firestore/documentSnapshot/1.0',
    bundleSource: 'DocumentSnapshot',
    bundleName: path,
    bundle: bundleOf(firestore, `doc-${path}`, [], [{ path, data }]),
  };
}

function realDocumentSnapshot(firestore: Firestore, path: string, data: DocumentData) {
  return sdk.documentSnapshotFromJSON(firestore, snapshotJson(firestore, path, data));
}

function unexpected(what: string): never {
  throw new Error(`in-memory client Firestore: the SDK built ${what} of another model type`);
}

const isQuerySnapshotOf = <A, D extends DocumentData>(
  value: unknown,
  converter: FirestoreDataConverter<A, D> | null,
): value is QuerySnapshot<A, D> =>
  value instanceof sdk.QuerySnapshot && value.query.converter === converter;

const parentOf = (path: string): string => path.split('/').slice(0, -1).join('/');
const collectionIdOf = (path: string): string => path.split('/').slice(-2, -1)[0] ?? '';

function normalizedOrders(query: DescribedQuery): DescribedOrder[] {
  const inequality: string[] = [];
  const collect = (filter: DescribedPredicate) => {
    if (filter.kind === 'field') {
      if (isInequality(filter.op)) inequality.push(filter.field);
    } else filter.filters.forEach(collect);
  };
  query.filters.forEach(collect);
  return normalizedOrdersOf(query.orders, inequality);
}

function matches(path: string, data: DocumentData, filter: DescribedPredicate): boolean {
  if (filter.kind === 'field')
    return matchesField(valueAt(path, data, filter.field), filter.op, filter.value);
  return filter.kind === 'and'
    ? filter.filters.every((inner) => matches(path, data, inner))
    : filter.filters.some((inner) => matches(path, data, inner));
}

function inScope(path: string, query: DescribedQuery): boolean {
  if (query.collectionGroup !== null) {
    const base = query.path;
    return (
      collectionIdOf(path) === query.collectionGroup && (base === '' || path.startsWith(`${base}/`))
    );
  }
  return parentOf(path) === query.path;
}

function readOf(kind: ExecutedClientRead['kind'], listen: boolean, query: DescribedQuery) {
  const flat: ExecutedClientReadFilter[] = [];
  const collect = (filter: DescribedPredicate) => {
    if (filter.kind === 'field')
      flat.push({ field: filter.field, op: filter.op, value: filter.value });
    else filter.filters.forEach(collect);
  };
  query.filters.forEach(collect);
  return {
    kind,
    listen,
    path: query.collectionGroup ?? query.path,
    group: query.collectionGroup !== null,
    filters: flat,
    orders: query.orders,
    limit: query.limit ?? Infinity,
    limitToLast: query.limitToLast,
    includeMetadataChanges: false,
  } satisfies ExecutedClientRead;
}

const docRead = (path: string, listen: boolean): ExecutedClientRead => ({
  kind: 'doc',
  listen,
  path,
  group: false,
  filters: [],
  orders: [],
  limit: 1,
  limitToLast: false,
  includeMetadataChanges: false,
});

// FirebaseError resets its prototype, so the SDK's own FirestoreError fails `instanceof FirestoreError`.
const isFirestoreError = (value: unknown): value is FirestoreError =>
  value instanceof Error &&
  value.name === 'FirebaseError' &&
  typeof Reflect.get(value, 'code') === 'string';

export function firestoreError(code: FirestoreErrorCode, message: string): FirestoreError {
  const error: unknown = Reflect.construct(sdk.FirestoreError, [code, message]);
  if (isFirestoreError(error)) return error;
  throw new Error('in-memory client Firestore: the SDK built no FirestoreError');
}

const offlineError = () =>
  firestoreError('unavailable', 'Failed to get document because the client is offline.');

const isAnswerSnapshot = (value: unknown): value is DocumentSnapshot | QuerySnapshot =>
  value instanceof sdk.DocumentSnapshot || value instanceof sdk.QuerySnapshot;

interface Listener {
  read: ExecutedClientRead;
  emit(): void;
  fail(error: FirestoreError): void;
}

export interface InMemoryClientFirestoreOptions {
  projectId?: string;
}

export function makeInMemoryClientFirestore(
  options: InMemoryClientFirestoreOptions = {},
): InMemoryClientFirestore {
  created += 1;
  const db = sdk.getFirestore(
    initializeApp(
      { projectId: options.projectId ?? 'demo-test' },
      `in-memory-client-firestore-${created}`,
    ),
  );
  const docs = new Map<string, DocumentData>();
  const log: ExecutedClientRead[] = [];
  const listeners = new Set<Listener>();
  let before: Array<{ predicate: ClientReadPredicate; fn: () => void | Promise<void> }> = [];
  let after: Array<{ predicate: ClientReadPredicate; fn: () => void | Promise<void> }> = [];
  let failures: Array<{ predicate: ClientReadPredicate; error: FirestoreError }> = [];
  let cacheModes: Array<{ predicate: ClientReadPredicate; fromCache: boolean }> = [];

  const answersFromCache = (read: ExecutedClientRead) =>
    [...cacheModes].reverse().find((mode) => mode.predicate(read))?.fromCache ?? false;

  const failureFor = (read: ExecutedClientRead) =>
    failures.find((failure) => failure.predicate(read))?.error;

  async function gate(read: ExecutedClientRead): Promise<void> {
    log.push(read);
    for (const hook of before) if (hook.predicate(read)) await hook.fn();
    const error = failureFor(read);
    if (error) throw error;
  }

  async function settle(read: ExecutedClientRead): Promise<void> {
    for (const hook of after) if (hook.predicate(read)) await hook.fn();
  }

  function documentSnapshot<A, D extends DocumentData>(
    firestore: Firestore,
    path: string,
    converter: FirestoreDataConverter<A, D> | null,
  ): DocumentSnapshot<A, D> {
    const data = docs.get(path);
    if (data === undefined)
      return missingDocumentSnapshot(realDocumentSnapshot(firestore, path, {}), path, converter);
    const json = snapshotJson(firestore, path, data);
    const snapshot: unknown = converter
      ? sdk.documentSnapshotFromJSON(firestore, json, converter)
      : sdk.documentSnapshotFromJSON(firestore, json);
    return isDocumentSnapshotOf(snapshot, converter) ? snapshot : unexpected('a document snapshot');
  }

  function resultPaths(query: DescribedQuery): string[] {
    const orders = normalizedOrders(query);
    const rows = [...docs.entries()]
      .filter(([path]) => inScope(path, query))
      .filter(([path, data]) => query.filters.every((filter) => matches(path, data, filter)))
      .map(([path, data]) => ({
        path,
        tuple: orders.map((order) => valueAt(path, data, order.field)),
      }))
      .filter((row): row is { path: string; tuple: ComparableValue[] } =>
        row.tuple.every((value) => value !== undefined),
      )
      .filter(
        (row) =>
          withinBound(row.tuple, query.startAt, orders, 'start') &&
          withinBound(row.tuple, query.endAt, orders, 'end'),
      )
      .sort((a, b) => compareTuples(a.tuple, b.tuple, orders));
    if (query.limit === null) return rows.map((row) => row.path);
    const kept = query.limitToLast ? rows.slice(-query.limit) : rows.slice(0, query.limit);
    return kept.map((row) => row.path);
  }

  function querySnapshot<A, D extends DocumentData>(
    query: Query<A, D>,
    described: DescribedQuery,
  ): QuerySnapshot<A, D> {
    const firestore = query.firestore;
    const root = documentsRootOf(firestore);
    const name = `query-${log.length}-${Math.random().toString(36).slice(2)}`;
    const orders = normalizedOrders(described);
    const group = described.collectionGroup;
    const from = group
      ? { collectionId: group, allDescendants: true }
      : { collectionId: described.path.split('/').at(-1) ?? '' };
    const parentPath = group ? described.path : parentOf(described.path);
    const bundledQuery = {
      parent: parentPath ? `${root}/${parentPath}` : root,
      structuredQuery: {
        from: [from],
        orderBy: orders.map((order) => ({
          field: { fieldPath: order.field },
          direction: order.direction === 'desc' ? 'DESCENDING' : 'ASCENDING',
        })),
      },
    };
    const paths = resultPaths(described);
    const json = {
      type: 'firestore/querySnapshot/1.0',
      bundleSource: 'QuerySnapshot',
      bundleName: name,
      bundle: bundleOf(
        firestore,
        name,
        [{ name, readTime: BUNDLE_TIME, bundledQuery }],
        paths.map((path) => ({ path, data: docs.get(path), query: name })),
      ),
    };
    const converter = query.converter;
    const snapshot: unknown = converter
      ? sdk.querySnapshotFromJSON(firestore, json, converter)
      : sdk.querySnapshotFromJSON(firestore, json);
    return isQuerySnapshotOf(snapshot, converter) ? snapshot : unexpected('a query snapshot');
  }

  // The SDK hands a listener each change on a later turn, never inside the write that caused it.
  const notify = () => queueMicrotask(() => [...listeners].forEach((listener) => listener.emit()));

  const getDoc: Sdk['getDoc'] = async (reference) => {
    const read = docRead(reference.path, false);
    await gate(read);
    const snapshot = documentSnapshot(reference.firestore, reference.path, reference.converter);
    await settle(read);
    return snapshot;
  };

  const getDocs: Sdk['getDocs'] = async (query) => {
    const described = describeQuery(query);
    const read = readOf('query', false, described);
    await gate(read);
    const snapshot = querySnapshot(query, described);
    await settle(read);
    return snapshot;
  };

  const getCountFromServer: Sdk['getCountFromServer'] = async (query) => {
    const described = describeQuery(query);
    const read = readOf('count', false, described);
    await gate(read);
    const template = realDocumentSnapshot(query.firestore, '__count__/template', {});
    const snapshot = countSnapshot(query, template, resultPaths(described).length);
    await settle(read);
    return snapshot;
  };

  interface ListenSource {
    read: ExecutedClientRead;
    snapshot(): unknown;
    signature(): string;
  }

  function listenSourceOf(target: unknown, includeMetadataChanges: boolean): ListenSource {
    if (target instanceof sdk.DocumentReference) {
      const reference = target;
      return {
        read: { ...docRead(reference.path, true), includeMetadataChanges },
        snapshot: () => documentSnapshot(reference.firestore, reference.path, reference.converter),
        signature: () => JSON.stringify(docs.get(reference.path) ?? null),
      };
    }
    if (target instanceof sdk.Query) {
      const query = target;
      const described = describeQuery(query);
      return {
        read: { ...readOf('query', true, described), includeMetadataChanges },
        snapshot: () => querySnapshot(query, described),
        signature: () =>
          JSON.stringify(resultPaths(described).map((path) => [path, docs.get(path)])),
      };
    }
    throw new Error('in-memory client Firestore: onSnapshot needs a reference or a query');
  }

  const onSnapshot: Sdk['onSnapshot'] = (target: unknown, ...rest: unknown[]) => {
    const callbacks = rest.filter((arg) => typeof arg === 'function');
    const observer = rest.find(
      (arg): arg is Record<string, unknown> =>
        typeof arg === 'object' && arg !== null && ('next' in arg || 'error' in arg),
    );
    const options = rest.find(
      (arg): arg is Record<string, unknown> =>
        typeof arg === 'object' && arg !== null && arg !== observer,
    );
    const next: unknown = observer ? observer.next : callbacks[0];
    const fail: unknown = observer ? observer.error : callbacks[1];
    const source = listenSourceOf(target, options?.includeMetadataChanges === true);
    let active = true;
    let last: string | null = null;
    let previous: QuerySnapshot | null = null;

    const listener: Listener = {
      read: source.read,
      fail(error) {
        if (!active) return;
        active = false;
        listeners.delete(listener);
        queueMicrotask(() => {
          if (typeof fail === 'function') Reflect.apply(fail, undefined, [error]);
        });
      },
      emit() {
        if (!active) return;
        const fromCache = answersFromCache(source.read);
        const metadata = source.read.includeMetadataChanges ? String(fromCache) : '';
        const now = `${metadata}${source.signature()}`;
        if (now === last) return;
        last = now;
        const built = source.snapshot();
        const snapshot =
          built instanceof sdk.QuerySnapshot && previous
            ? withChangesSince(built, previous, fromCache)
            : built;
        if (snapshot instanceof sdk.QuerySnapshot) previous = snapshot;
        const answer =
          fromCache && isAnswerSnapshot(snapshot) ? answeredFromCache(snapshot) : snapshot;
        if (typeof next === 'function') Reflect.apply(next, undefined, [answer]);
      },
    };

    void (async () => {
      try {
        await gate(source.read);
      } catch (error) {
        if (!active) return;
        active = false;
        if (typeof fail === 'function') Reflect.apply(fail, undefined, [error]);
        return;
      }
      if (!active) return;
      listeners.add(listener);
      listener.emit();
      await settle(source.read);
    })();

    return () => {
      active = false;
      listeners.delete(listener);
    };
  };

  return {
    db,
    reads: {
      getDoc,
      getDocFromServer: getDoc,
      getDocs,
      getDocsFromServer: getDocs,
      getCountFromServer,
      onSnapshot,
    },
    seed(path, data) {
      docs.set(path, data);
      notify();
    },
    remove(path) {
      docs.delete(path);
      notify();
    },
    reset() {
      docs.clear();
      log.length = 0;
      listeners.clear();
      before = [];
      after = [];
      failures = [];
      cacheModes = [];
    },
    read: (path) => docs.get(path),
    paths: (prefix = '') => [...docs.keys()].filter((path) => path.startsWith(prefix)).sort(),
    beforeRead(predicate, fn) {
      before.push({ predicate, fn });
    },
    afterRead(predicate, fn) {
      after.push({ predicate, fn });
    },
    failReads(predicate, error) {
      failures.push({
        predicate,
        error: error ?? offlineError(),
      });
    },
    answerFromCache(predicate) {
      cacheModes.push({ predicate, fromCache: true });
      notify();
    },
    answerFromServer(predicate) {
      cacheModes.push({ predicate, fromCache: false });
      notify();
    },
    failListeners(predicate, error) {
      const failure = error ?? offlineError();
      for (const listener of [...listeners]) if (predicate(listener.read)) listener.fail(failure);
    },
    queries: () => log,
    liveListeners: () => listeners.size,
    snapshotOf: (path, firestore = db) => documentSnapshot(firestore, path, null),
    queryDocumentSnapshotOf(path, firestore = db) {
      const data = docs.get(path);
      if (data === undefined)
        throw new Error(
          `in-memory client Firestore: ${path} is not seeded, so no query returns it`,
        );
      const parent = parentOf(path);
      const snapshot = querySnapshot(
        sdk.query(
          sdk.collection(firestore, parent),
          sdk.where(sdk.documentId(), '==', path.split('/').at(-1) ?? ''),
        ),
        {
          path: parent,
          collectionGroup: null,
          filters: [{ kind: 'field', field: '__name__', op: '==', value: { t: 'ref', v: path } }],
          orders: [],
          limit: null,
          limitToLast: false,
          startAt: null,
          endAt: null,
        },
      );
      const found = snapshot.docs[0];
      if (!found) throw new Error(`in-memory client Firestore: ${path} did not resolve`);
      return found;
    },
  };
}
