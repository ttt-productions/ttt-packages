import type {
  AggregateField,
  AggregateQuery,
  AggregateQuerySnapshot,
  AggregateSpec,
  AggregateSpecData,
  CollectionGroup,
  CollectionReference,
  DocumentData,
  DocumentReference,
  DocumentSnapshot,
  FieldPath,
  Filter,
  Firestore,
  OrderByDirection,
  PartialWithFieldValue,
  Precondition,
  Query,
  QueryDocumentSnapshot,
  QuerySnapshot,
  ReadOptions,
  SetOptions,
  Transaction,
  UpdateData,
  WhereFilterOp,
  WithFieldValue,
  WriteBatch,
  WriteResult,
} from 'firebase-admin/firestore';
import { vi } from 'vitest';

const { Timestamp } = await vi.importActual<typeof import('firebase-admin/firestore')>(
  'firebase-admin/firestore',
);
type Timestamp = InstanceType<typeof Timestamp>;

type Doc = Record<string, unknown>;

interface Sentinel {
  _type: 'deleteField' | 'increment' | 'arrayUnion' | 'arrayRemove' | 'serverTimestamp';
  value?: number;
  items?: unknown[];
}

const DOCUMENT_ID = '__name__';

function isSentinel(value: unknown): value is Sentinel {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as { _type?: unknown })._type === 'string'
  );
}

function isPlainObject(value: unknown): value is Doc {
  if (typeof value !== 'object' || value === null || Array.isArray(value) || isSentinel(value))
    return false;
  const proto: unknown = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
}

// A stored Timestamp (or any other class value) comes back as itself, as Firestore returns it.
function cloneStoredValue<T>(value: T): T {
  if (Array.isArray(value)) return value.map((item: unknown) => cloneStoredValue(item)) as T;
  if (!isPlainObject(value)) return value;
  const out: Doc = {};
  for (const [k, v] of Object.entries(value)) out[k] = cloneStoredValue(v);
  return out as T;
}

function hasMillis(value: unknown): value is { toMillis(): number } {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as { toMillis?: unknown }).toMillis === 'function'
  );
}

function applySentinel(current: unknown, sentinel: Sentinel): unknown {
  switch (sentinel._type) {
    case 'increment':
      return (typeof current === 'number' ? current : 0) + (sentinel.value ?? 0);
    case 'arrayUnion': {
      const base: unknown[] = Array.isArray(current) ? [...(current as unknown[])] : [];
      for (const item of sentinel.items ?? []) {
        if (!base.some((existing) => JSON.stringify(existing) === JSON.stringify(item)))
          base.push(item);
      }
      return base;
    }
    case 'arrayRemove': {
      const base = Array.isArray(current) ? current : [];
      const removed = (sentinel.items ?? []).map((item) => JSON.stringify(item));
      return base.filter((existing) => !removed.includes(JSON.stringify(existing)));
    }
    case 'serverTimestamp':
      return Date.now();
    default:
      return current;
  }
}

function writeField(target: Doc, key: string, value: unknown, mergeMaps: boolean): void {
  if (isSentinel(value)) {
    if (value._type === 'deleteField') delete target[key];
    else target[key] = applySentinel(target[key], value);
    return;
  }
  if (mergeMaps && isPlainObject(value)) {
    const existing = isPlainObject(target[key]) ? (target[key] as Doc) : {};
    const next: Doc = { ...existing };
    for (const [k, v] of Object.entries(value)) writeField(next, k, v, true);
    target[key] = next;
    return;
  }
  target[key] = stripSentinels(value);
}

function stripSentinels(value: unknown): unknown {
  if (isPlainObject(value)) {
    const out: Doc = {};
    for (const [k, v] of Object.entries(value)) {
      if (isSentinel(v)) {
        if (v._type !== 'deleteField') out[k] = applySentinel(undefined, v);
      } else {
        out[k] = stripSentinels(v);
      }
    }
    return out;
  }
  return cloneStoredValue(value);
}

function readFieldPath(data: Doc | undefined, path: string, docPath: string): unknown {
  if (path === DOCUMENT_ID) return docPath;
  let cursor: unknown = data;
  for (const part of path.split('.')) {
    if (!isPlainObject(cursor)) return undefined;
    cursor = cursor[part];
  }
  return cursor;
}

function compareValues(a: unknown, b: unknown): number {
  if (a === b) return 0;
  if (typeof a === 'number' && typeof b === 'number') return a - b;
  if (hasMillis(a) && hasMillis(b)) return a.toMillis() - b.toMillis();
  if (typeof a === 'boolean' && typeof b === 'boolean') return Number(a) - Number(b);
  return String(a) < String(b) ? -1 : String(a) > String(b) ? 1 : 0;
}

function sameValue(a: unknown, b: unknown): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

interface FieldFilter {
  field: string;
  op: string;
  value: unknown;
}

interface Order {
  field: string;
  direction: 'asc' | 'desc';
}

interface QueryShape {
  source: string;
  group: boolean;
  filters: FieldFilter[];
  orders: Order[];
  limit: number;
  startAfter?: unknown[];
  fields?: string[];
}

function filterMatchesDoc(filter: FieldFilter, data: Doc | undefined, docPath: string): boolean {
  const value = readFieldPath(data, filter.field, docPath);
  if (value === undefined) return false;
  switch (filter.op) {
    case '==':
      return sameValue(value, filter.value);
    case '!=':
      return !sameValue(value, filter.value);
    case '<':
      return compareValues(value, filter.value) < 0;
    case '<=':
      return compareValues(value, filter.value) <= 0;
    case '>':
      return compareValues(value, filter.value) > 0;
    case '>=':
      return compareValues(value, filter.value) >= 0;
    case 'in':
      return (filter.value as unknown[]).some((v) => sameValue(v, value));
    case 'not-in':
      return !(filter.value as unknown[]).some((v) => sameValue(v, value));
    case 'array-contains':
      return Array.isArray(value) && value.some((v) => sameValue(v, filter.value));
    case 'array-contains-any':
      return (
        Array.isArray(value) &&
        value.some((v) => (filter.value as unknown[]).some((w) => sameValue(v, w)))
      );
    default:
      throw new Error(`in-memory-firestore: unsupported operator ${filter.op}`);
  }
}

export interface InMemoryFirestore {
  readonly db: Firestore;
  seed(path: string, data: Doc): void;
  remove(path: string): void;
  reset(): void;
  read(path: string): Doc | undefined;
  paths(prefix?: string): string[];
  afterRead(path: string, fn: () => void | Promise<void>): void;
  beforeRead(path: string, fn: () => void | Promise<void>): void;
  failReads(predicate: (path: string) => boolean, error?: Error): void;
  failQueries(predicate: (source: string) => boolean, error?: Error): void;
  failCommits(predicate: (path: string) => boolean, count?: number): void;
  failNextTransaction(error: Error): void;
  afterCommit(fn: () => void | Promise<void>, touches?: (path: string) => boolean): void;
  queries(): readonly ExecutedQuery[];
  writes(): readonly CommittedWrite[];
  transactionAttempts(): number;
  snapshotOf(path: string): DocumentSnapshot;
  queryDocumentSnapshotOf(path: string): QueryDocumentSnapshot;
  querySnapshotOf(collectionPath: string, docPaths: readonly string[]): QuerySnapshot;
}

export interface ExecutedQuery {
  source: string;
  group: boolean;
  limit: number;
  filters: readonly ExecutedQueryFilter[];
  orders: readonly ExecutedQueryOrder[];
}

export interface ExecutedQueryOrder {
  field: string;
  direction: 'asc' | 'desc';
}

export interface ExecutedQueryFilter {
  field: string;
  op: string;
  value: unknown;
}

export type CommittedWrite = Readonly<WriteOp>;

type WriteOp =
  | { kind: 'set'; path: string; data: Doc; merge: boolean }
  | { kind: 'update'; path: string; data: Doc }
  | { kind: 'create'; path: string; data: Doc }
  | { kind: 'delete'; path: string };

// The Admin SDK reports a Firestore failure with its numeric gRPC status and a "<code> <NAME>: …" message.
function grpcError(code: number, name: string, detail: string): Error & { code: number } {
  return Object.assign(new Error(`${code} ${name}: ${detail}`), { code });
}

const notInFake = (what: string) => (): never => {
  throw new Error(`in-memory-firestore: ${what} is not part of this fake`);
};

function pathOf(target: unknown, what: string): string {
  if (typeof target === 'object' && target !== null && 'path' in target) {
    const { path } = target;
    if (typeof path === 'string') return path;
  }
  throw new Error(`in-memory-firestore: ${what} takes a document reference`);
}

function docOf(data: unknown, what: string): Doc {
  if (isPlainObject(data)) return data;
  throw new Error(`in-memory-firestore: ${what} takes a document object`);
}

// Firestore's `update(field, value, field, value, …)` form, folded into one update object.
function updateDataOf(first: unknown, rest: readonly unknown[], what: string): Doc {
  if (typeof first !== 'string') return docOf(first, what);
  const pairs: Doc = {};
  const values = [first, ...rest];
  for (let i = 0; i + 1 < values.length; i += 2) pairs[String(values[i])] = values[i + 1];
  return pairs;
}

function mergeOf(options: unknown): boolean {
  return (
    typeof options === 'object' && options !== null && 'merge' in options && options.merge === true
  );
}

class FakeWriteResult implements WriteResult {
  get writeTime(): never {
    return notInFake('WriteResult.writeTime')();
  }
  isEqual(other: WriteResult): boolean {
    return other === this;
  }
}

class OpRecorder {
  readonly ops: WriteOp[] = [];
  wrote = false;
  record(op: WriteOp): void {
    this.wrote = true;
    this.ops.push(op);
  }
}

function buildFakeFirestore(options: InMemoryFirestoreOptions): InMemoryFirestore {
  const docsByPath = new Map<string, Doc>();
  const versions = new Map<string, number>();
  const afterReadHooks = new Map<string, Array<() => void | Promise<void>>>();
  const beforeReadHooks = new Map<string, Array<() => void | Promise<void>>>();
  let readFailure: { predicate: (path: string) => boolean; error?: Error } | null = null;
  let queryFailure: { predicate: (source: string) => boolean; error?: Error } | null = null;
  let nextTransactionFailure: Error | null = null;
  const afterCommitHooks: Array<{
    fn: () => void | Promise<void>;
    touches?: (path: string) => boolean;
  }> = [];
  const executedQueries: ExecutedQuery[] = [];
  const committedWrites: CommittedWrite[] = [];
  let commitFailure: { predicate: (path: string) => boolean; remaining: number } | null = null;
  let attempts = 0;
  let autoId = 0;

  const updateTimes = new Map<string, Timestamp>();
  let updateClock = 0;
  const storedVersionOf = (path: string): number => versions.get(path) ?? 0;
  const bumpStoredVersion = (path: string): void => {
    versions.set(path, storedVersionOf(path) + 1);
    updateTimes.set(path, Timestamp.fromMillis(++updateClock));
  };

  function assertReadable(path: string): void {
    if (readFailure?.predicate(path))
      throw readFailure.error ?? grpcError(14, 'UNAVAILABLE', `read of ${path} failed`);
  }

  function executeQuery(shape: QueryShape): string[] {
    executedQueries.push({
      source: shape.source,
      group: shape.group,
      limit: shape.limit,
      filters: shape.filters.map((f) => ({ ...f })),
      orders: shape.orders.map((o) => ({ ...o })),
    });
    if (queryFailure?.predicate(shape.source))
      throw queryFailure.error ?? grpcError(14, 'UNAVAILABLE', `query of ${shape.source} failed`);
    const paths = runQuery(shape);
    for (const path of paths) assertReadable(path);
    return paths;
  }

  async function commit(ops: readonly WriteOp[]): Promise<void> {
    commitOps(ops);
    await runAfterCommit(ops);
  }

  async function runAfterCommit(ops: readonly WriteOp[]): Promise<void> {
    const index = afterCommitHooks.findIndex(
      (hook) => !hook.touches || ops.some((op) => hook.touches!(op.path)),
    );
    if (index < 0) return;
    const [hook] = afterCommitHooks.splice(index, 1);
    await hook.fn();
  }

  async function runReadHook(
    hooksByPath: Map<string, Array<() => void | Promise<void>>>,
    path: string,
  ): Promise<void> {
    const hooks = hooksByPath.get(path);
    if (!hooks?.length) return;
    const hook = hooks.shift()!;
    if (hooks.length === 0) hooksByPath.delete(path);
    await hook();
  }
  const runAfterRead = (path: string) => runReadHook(afterReadHooks, path);
  const runBeforeRead = (path: string) => runReadHook(beforeReadHooks, path);

  function applyOp(op: WriteOp): void {
    const existing = docsByPath.get(op.path);
    switch (op.kind) {
      case 'delete':
        docsByPath.delete(op.path);
        break;
      case 'create':
        docsByPath.set(op.path, docOf(stripSentinels(op.data), 'create'));
        break;
      case 'set': {
        if (op.merge) {
          const next: Doc = { ...(existing ?? {}) };
          for (const [k, v] of Object.entries(op.data)) writeField(next, k, v, true);
          docsByPath.set(op.path, next);
        } else {
          docsByPath.set(op.path, docOf(stripSentinels(op.data), 'set'));
        }
        break;
      }
      case 'update': {
        const next: Doc = cloneStoredValue(existing ?? {});
        for (const [key, value] of Object.entries(op.data)) {
          const parts = key.split('.');
          let cursor = next;
          for (const part of parts.slice(0, -1)) {
            const child = cursor[part];
            const nested: Doc = isPlainObject(child) ? child : {};
            cursor[part] = nested;
            cursor = nested;
          }
          writeField(cursor, parts[parts.length - 1], value, false);
        }
        docsByPath.set(op.path, next);
        break;
      }
    }
    bumpStoredVersion(op.path);
  }

  function commitOps(ops: readonly WriteOp[]): void {
    if (commitFailure && ops.some((op) => commitFailure!.predicate(op.path))) {
      commitFailure.remaining -= 1;
      if (commitFailure.remaining <= 0) commitFailure = null;
      throw grpcError(14, 'UNAVAILABLE', 'commit failed');
    }
    const exists = new Map<string, boolean>();
    const present = (path: string) => (exists.has(path) ? exists.get(path)! : docsByPath.has(path));
    for (const op of ops) {
      if (op.kind === 'create' && present(op.path)) throw grpcError(6, 'ALREADY_EXISTS', op.path);
      if (op.kind === 'update' && !present(op.path)) throw grpcError(5, 'NOT_FOUND', op.path);
      exists.set(op.path, op.kind !== 'delete');
    }
    for (const op of ops) applyOp(op);
    committedWrites.push(...ops.map((op) => cloneStoredValue(op)));
  }

  function runQuery(shape: QueryShape): string[] {
    let paths = [...docsByPath.keys()].filter((path) => {
      const segments = path.split('/');
      if (shape.group)
        return segments.length >= 2 && segments[segments.length - 2] === shape.source;
      return (
        path.startsWith(`${shape.source}/`) && !path.slice(shape.source.length + 1).includes('/')
      );
    });
    paths = paths.filter((path) =>
      shape.filters.every((f) => filterMatchesDoc(f, docsByPath.get(path), path)),
    );
    const orders = [...shape.orders];
    for (const order of orders) {
      paths = paths.filter(
        (path) => readFieldPath(docsByPath.get(path), order.field, path) !== undefined,
      );
    }
    const sortKey = (path: string): unknown[] =>
      orders.map((o) => readFieldPath(docsByPath.get(path), o.field, path));
    const compareByQueryOrder = (a: string, b: string): number => {
      const ka = sortKey(a);
      const kb = sortKey(b);
      for (let i = 0; i < orders.length; i++) {
        const c = compareValues(ka[i], kb[i]);
        if (c !== 0) return orders[i].direction === 'desc' ? -c : c;
      }
      return compareValues(a, b);
    };
    paths.sort(compareByQueryOrder);
    if (shape.startAfter) {
      const cursor = shape.startAfter;
      paths = paths.filter((path) => {
        const key = [...sortKey(path), path];
        for (let i = 0; i < cursor.length; i++) {
          const c = compareValues(key[i], cursor[i]);
          if (c !== 0) return i < orders.length && orders[i].direction === 'desc' ? c < 0 : c > 0;
        }
        return false;
      });
    }
    return paths.slice(0, shape.limit);
  }

  class StoredDocumentSnapshot implements DocumentSnapshot {
    readonly exists: boolean;
    readonly id: string;
    readonly ref: StoredDocumentReference;
    readonly #data: Doc | undefined;
    readonly #updateTime: Timestamp | undefined;
    constructor(
      readonly path: string,
      fields?: readonly string[],
    ) {
      const stored = cloneStoredValue(docsByPath.get(path));
      this.#data =
        stored && fields
          ? Object.fromEntries(fields.filter((f) => f in stored).map((f) => [f, stored[f]]))
          : stored;
      this.exists = this.#data !== undefined;
      this.#updateTime = this.exists ? updateTimes.get(path) : undefined;
      this.id = path.slice(path.lastIndexOf('/') + 1);
      this.ref = new StoredDocumentReference(path);
    }
    get readTime(): never {
      return notInFake('DocumentSnapshot.readTime')();
    }
    get updateTime(): Timestamp | undefined {
      return this.#updateTime;
    }
    data(): Doc | undefined {
      return cloneStoredValue(this.#data);
    }
    get(field: string | FieldPath): unknown {
      return cloneStoredValue(readFieldPath(this.#data, String(field), this.path));
    }
    isEqual(other: DocumentSnapshot): boolean {
      return other === this;
    }
  }

  class StoredQueryDocumentSnapshot
    extends StoredDocumentSnapshot
    implements QueryDocumentSnapshot
  {
    get createTime(): never {
      return notInFake('QueryDocumentSnapshot.createTime')();
    }
    get updateTime(): Timestamp {
      return super.updateTime ?? Timestamp.fromMillis(0);
    }
    data(): Doc {
      return super.data() ?? {};
    }
  }

  class StoredQuerySnapshot implements QuerySnapshot {
    readonly docs: StoredQueryDocumentSnapshot[];
    constructor(
      readonly query: StoredQuery,
      paths: readonly string[],
    ) {
      this.docs = paths.map((path) => new StoredQueryDocumentSnapshot(path, query.shape.fields));
    }
    get size(): number {
      return this.docs.length;
    }
    get empty(): boolean {
      return this.docs.length === 0;
    }
    get readTime(): never {
      return notInFake('QuerySnapshot.readTime')();
    }
    docChanges = notInFake('QuerySnapshot.docChanges');
    forEach(callback: (result: QueryDocumentSnapshot) => void): void {
      this.docs.forEach((doc) => callback(doc));
    }
    isEqual(other: QuerySnapshot): boolean {
      return other === this;
    }
  }

  class StoredQuery implements Query {
    constructor(readonly shape: QueryShape) {}
    get firestore(): StoredFirestore {
      return db;
    }
    where(fieldPath: string | FieldPath, opStr: WhereFilterOp, value: unknown): StoredQuery;
    where(filter: Filter): StoredQuery;
    where(field: unknown, op?: unknown, value?: unknown): StoredQuery {
      if (typeof op !== 'string')
        throw new Error('in-memory-firestore: Filter objects are not part of this fake');
      // A collection query resolves a bare document id against its own collection, and a reference
      // to its path.
      const asPath = (v: unknown): unknown =>
        v instanceof StoredDocumentReference
          ? v.path
          : !this.shape.group && typeof v === 'string' && !v.includes('/')
            ? `${this.shape.source}/${v}`
            : v;
      const resolved =
        String(field) !== DOCUMENT_ID
          ? value
          : Array.isArray(value)
            ? value.map(asPath)
            : asPath(value);
      return new StoredQuery({
        ...this.shape,
        filters: [...this.shape.filters, { field: String(field), op, value: resolved }],
      });
    }
    orderBy(fieldPath: string | FieldPath, directionStr: OrderByDirection = 'asc'): StoredQuery {
      return new StoredQuery({
        ...this.shape,
        orders: [...this.shape.orders, { field: String(fieldPath), direction: directionStr }],
      });
    }
    limit(limit: number): StoredQuery {
      return new StoredQuery({ ...this.shape, limit });
    }
    startAfter(snapshot: DocumentSnapshot): StoredQuery;
    startAfter(...fieldValues: unknown[]): StoredQuery;
    startAfter(...args: unknown[]): StoredQuery {
      const [first] = args;
      const cursor =
        first instanceof StoredDocumentSnapshot
          ? [
              ...this.shape.orders.map((o) =>
                readFieldPath(docsByPath.get(first.path), o.field, first.path),
              ),
              first.path,
            ]
          : args.map((value, i) =>
              this.shape.orders[i]?.field === DOCUMENT_ID &&
              !this.shape.group &&
              typeof value === 'string' &&
              !value.includes('/')
                ? `${this.shape.source}/${value}`
                : value,
            );
      return new StoredQuery({ ...this.shape, startAfter: cursor });
    }
    select(...fields: Array<string | FieldPath>): StoredQuery {
      return new StoredQuery({ ...this.shape, fields: fields.map(String) });
    }
    count(): StoredCountQuery {
      return new StoredCountQuery(this);
    }
    aggregate<S extends AggregateSpec>(spec: S): StoredAggregateQuery<S> {
      return new StoredAggregateQuery(this, spec);
    }
    async get(): Promise<StoredQuerySnapshot> {
      const paths = executeQuery(this.shape);
      const snap = new StoredQuerySnapshot(this, paths);
      for (const path of paths) await runAfterRead(path);
      return snap;
    }
    isEqual(other: Query): boolean {
      return other === this;
    }
    limitToLast = notInFake('Query.limitToLast');
    offset = notInFake('Query.offset');
    startAt = notInFake('Query.startAt');
    endBefore = notInFake('Query.endBefore');
    endAt = notInFake('Query.endAt');
    explain = notInFake('Query.explain');
    stream = notInFake('Query.stream');
    explainStream = notInFake('Query.explainStream');
    onSnapshot = notInFake('Query.onSnapshot');
    findNearest = notInFake('Query.findNearest');
    withConverter = notInFake('Query.withConverter');
  }

  type CountSpec = { count: AggregateField<number> };

  class StoredCountSnapshot implements AggregateQuerySnapshot<CountSpec> {
    constructor(
      readonly query: StoredCountQuery,
      readonly count: number,
    ) {}
    get readTime(): never {
      return notInFake('AggregateQuerySnapshot.readTime')();
    }
    data(): { count: number } {
      return { count: this.count };
    }
    isEqual(other: AggregateQuerySnapshot<CountSpec>): boolean {
      return other === this;
    }
  }

  class StoredCountQuery implements AggregateQuery<CountSpec> {
    constructor(readonly query: StoredQuery) {}
    async get(): Promise<StoredCountSnapshot> {
      const paths = executeQuery(this.query.shape);
      return new StoredCountSnapshot(this, paths.length);
    }
    isEqual(other: AggregateQuery<CountSpec>): boolean {
      return other === this;
    }
    explain = notInFake('AggregateQuery.explain');
  }

  // Count, sum, and average over the query's matching documents, as Firestore computes them: a sum
  // or average reads only numeric values, a sum of none is 0, and an average of none is null.
  function aggregateOver<S extends AggregateSpec>(paths: string[], spec: S): AggregateSpecData<S> {
    const data: Record<string, number | null> = {};
    for (const [alias, aggregate] of Object.entries(spec)) {
      if (aggregate.aggregateType === 'count') {
        data[alias] = paths.length;
        continue;
      }
      // The SDK keeps the aggregated field internal, and the real AggregateField carries it here.
      const field: unknown = Reflect.get(aggregate, '_field');
      const values = paths
        .map((path) => readFieldPath(docsByPath.get(path), String(field), path))
        .filter((value): value is number => typeof value === 'number');
      const sum = values.reduce((total, value) => total + value, 0);
      data[alias] =
        aggregate.aggregateType === 'sum' ? sum : values.length > 0 ? sum / values.length : null;
    }
    return data as AggregateSpecData<S>;
  }

  class StoredAggregateSnapshot<S extends AggregateSpec> implements AggregateQuerySnapshot<S> {
    constructor(
      readonly query: StoredAggregateQuery<S>,
      private readonly values: AggregateSpecData<S>,
    ) {}
    get readTime(): never {
      return notInFake('AggregateQuerySnapshot.readTime')();
    }
    data(): AggregateSpecData<S> {
      return this.values;
    }
    isEqual(other: AggregateQuerySnapshot<S>): boolean {
      return other === this;
    }
  }

  class StoredAggregateQuery<S extends AggregateSpec> implements AggregateQuery<S> {
    constructor(
      readonly query: StoredQuery,
      readonly spec: S,
    ) {}
    async get(): Promise<StoredAggregateSnapshot<S>> {
      return new StoredAggregateSnapshot(
        this,
        aggregateOver(executeQuery(this.query.shape), this.spec),
      );
    }
    isEqual(other: AggregateQuery<S>): boolean {
      return other === this;
    }
    explain = notInFake('AggregateQuery.explain');
  }

  class StoredCollectionGroup extends StoredQuery implements CollectionGroup {
    getPartitions = notInFake('CollectionGroup.getPartitions');
  }

  class StoredCollectionReference extends StoredQuery implements CollectionReference {
    readonly id: string;
    constructor(readonly path: string) {
      super({ source: path, group: false, filters: [], orders: [], limit: Infinity });
      this.id = path.slice(path.lastIndexOf('/') + 1);
    }
    get parent(): StoredDocumentReference | null {
      return this.path.includes('/')
        ? new StoredDocumentReference(this.path.slice(0, this.path.lastIndexOf('/')))
        : null;
    }
    doc(documentPath?: string): StoredDocumentReference {
      return new StoredDocumentReference(`${this.path}/${documentPath ?? `auto-${++autoId}`}`);
    }
    async add(data: WithFieldValue<DocumentData>): Promise<StoredDocumentReference> {
      const ref = this.doc();
      await commit([{ kind: 'create', path: ref.path, data: docOf(data, 'add') }]);
      return ref;
    }
    isEqual(other: Query): boolean {
      return other instanceof StoredCollectionReference && other.path === this.path;
    }
    listDocuments = notInFake('CollectionReference.listDocuments');
  }

  class StoredDocumentReference implements DocumentReference {
    readonly id: string;
    constructor(readonly path: string) {
      this.id = path.slice(path.lastIndexOf('/') + 1);
    }
    get firestore(): StoredFirestore {
      return db;
    }
    get parent(): StoredCollectionReference {
      return new StoredCollectionReference(this.path.slice(0, this.path.lastIndexOf('/')));
    }
    collection(collectionPath: string): StoredCollectionReference {
      return new StoredCollectionReference(`${this.path}/${collectionPath}`);
    }
    async get(): Promise<StoredDocumentSnapshot> {
      await runBeforeRead(this.path);
      assertReadable(this.path);
      const snap = new StoredDocumentSnapshot(this.path);
      await runAfterRead(this.path);
      return snap;
    }
    async create(data: WithFieldValue<DocumentData>): Promise<WriteResult> {
      await commit([{ kind: 'create', path: this.path, data: docOf(data, 'create') }]);
      return new FakeWriteResult();
    }
    set(data: PartialWithFieldValue<DocumentData>, options: SetOptions): Promise<WriteResult>;
    set(data: WithFieldValue<DocumentData>): Promise<WriteResult>;
    async set(data: unknown, setOptions?: unknown): Promise<WriteResult> {
      await commit([
        { kind: 'set', path: this.path, data: docOf(data, 'set'), merge: mergeOf(setOptions) },
      ]);
      return new FakeWriteResult();
    }
    update(data: UpdateData<DocumentData>, precondition?: Precondition): Promise<WriteResult>;
    update(field: string | FieldPath, value: unknown, ...more: unknown[]): Promise<WriteResult>;
    async update(first: unknown, ...rest: unknown[]): Promise<WriteResult> {
      await commit([
        { kind: 'update', path: this.path, data: updateDataOf(first, rest, 'update') },
      ]);
      return new FakeWriteResult();
    }
    async delete(precondition?: Precondition): Promise<WriteResult> {
      const required = precondition?.lastUpdateTime;
      if (required !== undefined) {
        const current = docsByPath.has(this.path) ? updateTimes.get(this.path) : undefined;
        if (!current?.isEqual(required)) {
          throw grpcError(9, 'FAILED_PRECONDITION', `${this.path} changed since it was read`);
        }
      }
      await commit([{ kind: 'delete', path: this.path }]);
      return new FakeWriteResult();
    }
    isEqual(other: DocumentReference): boolean {
      return other.path === this.path;
    }
    listCollections = notInFake('DocumentReference.listCollections');
    onSnapshot = notInFake('DocumentReference.onSnapshot');
    withConverter = notInFake('DocumentReference.withConverter');
  }

  class StoredWriteBatch implements WriteBatch {
    readonly #recorder = new OpRecorder();
    create<A, D extends DocumentData>(ref: DocumentReference<A, D>, data: WithFieldValue<A>): this;
    create(ref: unknown, data: unknown): this {
      this.#recorder.record({
        kind: 'create',
        path: pathOf(ref, 'create'),
        data: docOf(data, 'create'),
      });
      return this;
    }
    set<A, D extends DocumentData>(
      ref: DocumentReference<A, D>,
      data: PartialWithFieldValue<A>,
      options: SetOptions,
    ): this;
    set<A, D extends DocumentData>(ref: DocumentReference<A, D>, data: WithFieldValue<A>): this;
    set(ref: unknown, data: unknown, setOptions?: unknown): this {
      this.#recorder.record({
        kind: 'set',
        path: pathOf(ref, 'set'),
        data: docOf(data, 'set'),
        merge: mergeOf(setOptions),
      });
      return this;
    }
    update<A, D extends DocumentData>(
      ref: DocumentReference<A, D>,
      data: UpdateData<D>,
      precondition?: Precondition,
    ): this;
    update(
      ref: DocumentReference,
      field: string | FieldPath,
      value: unknown,
      ...more: unknown[]
    ): this;
    update(ref: unknown, first: unknown, ...rest: unknown[]): this {
      this.#recorder.record({
        kind: 'update',
        path: pathOf(ref, 'update'),
        data: updateDataOf(first, rest, 'update'),
      });
      return this;
    }
    delete(ref: DocumentReference): this {
      this.#recorder.record({ kind: 'delete', path: pathOf(ref, 'delete') });
      return this;
    }
    async commit(): Promise<WriteResult[]> {
      await commit(this.#recorder.ops);
      return this.#recorder.ops.map(() => new FakeWriteResult());
    }
  }

  class StoredTransaction implements Transaction {
    readonly recorder = new OpRecorder();
    readonly docReads = new Map<string, number>();
    readonly queryReads: Array<{ shape: QueryShape; paths: string[]; versions: number[] }> = [];
    private assertNoWriteYet(): void {
      if (this.recorder.wrote)
        throw new Error(
          'Firestore transactions require all reads to be executed before all writes.',
        );
    }
    private async readDoc(path: string): Promise<StoredDocumentSnapshot> {
      this.assertNoWriteYet();
      await runBeforeRead(path);
      assertReadable(path);
      if (!this.docReads.has(path)) this.docReads.set(path, storedVersionOf(path));
      const snap = new StoredDocumentSnapshot(path);
      await runAfterRead(path);
      return snap;
    }
    get<A, D extends DocumentData>(query: Query<A, D>): Promise<QuerySnapshot<A, D>>;
    get<A, D extends DocumentData>(ref: DocumentReference<A, D>): Promise<DocumentSnapshot<A, D>>;
    get<A, D extends DocumentData, S extends AggregateSpec>(
      aggregateQuery: AggregateQuery<S, A, D>,
    ): Promise<AggregateQuerySnapshot<S, A, D>>;
    async get(target: unknown): Promise<unknown> {
      if (target instanceof StoredCountQuery) {
        this.assertNoWriteYet();
        const paths = executeQuery(target.query.shape);
        this.queryReads.push({
          shape: target.query.shape,
          paths,
          versions: paths.map(storedVersionOf),
        });
        return new StoredCountSnapshot(target, paths.length);
      }
      if (target instanceof StoredAggregateQuery) {
        this.assertNoWriteYet();
        const paths = executeQuery(target.query.shape);
        this.queryReads.push({
          shape: target.query.shape,
          paths,
          versions: paths.map(storedVersionOf),
        });
        return new StoredAggregateSnapshot(target, aggregateOver(paths, target.spec));
      }
      if (target instanceof StoredQuery) {
        this.assertNoWriteYet();
        const paths = executeQuery(target.shape);
        this.queryReads.push({ shape: target.shape, paths, versions: paths.map(storedVersionOf) });
        const snap = new StoredQuerySnapshot(target, paths);
        for (const path of paths) await runAfterRead(path);
        return snap;
      }
      return this.readDoc(pathOf(target, 'get'));
    }
    getAll<A, D extends DocumentData>(
      ...refs: Array<DocumentReference<A, D> | ReadOptions>
    ): Promise<Array<DocumentSnapshot<A, D>>>;
    async getAll(...refs: unknown[]): Promise<unknown[]> {
      const snaps: StoredDocumentSnapshot[] = [];
      for (const ref of refs) snaps.push(await this.readDoc(pathOf(ref, 'getAll')));
      return snaps;
    }
    create<A, D extends DocumentData>(ref: DocumentReference<A, D>, data: WithFieldValue<A>): this;
    create(ref: unknown, data: unknown): this {
      this.recorder.record({
        kind: 'create',
        path: pathOf(ref, 'create'),
        data: docOf(data, 'create'),
      });
      return this;
    }
    set<A, D extends DocumentData>(
      ref: DocumentReference<A, D>,
      data: PartialWithFieldValue<A>,
      options: SetOptions,
    ): this;
    set<A, D extends DocumentData>(ref: DocumentReference<A, D>, data: WithFieldValue<A>): this;
    set(ref: unknown, data: unknown, setOptions?: unknown): this {
      this.recorder.record({
        kind: 'set',
        path: pathOf(ref, 'set'),
        data: docOf(data, 'set'),
        merge: mergeOf(setOptions),
      });
      return this;
    }
    update<A, D extends DocumentData>(
      ref: DocumentReference<A, D>,
      data: UpdateData<D>,
      precondition?: Precondition,
    ): this;
    update(
      ref: DocumentReference,
      field: string | FieldPath,
      value: unknown,
      ...more: unknown[]
    ): this;
    update(ref: unknown, first: unknown, ...rest: unknown[]): this {
      this.recorder.record({
        kind: 'update',
        path: pathOf(ref, 'update'),
        data: updateDataOf(first, rest, 'update'),
      });
      return this;
    }
    delete(ref: DocumentReference): this {
      this.recorder.record({ kind: 'delete', path: pathOf(ref, 'delete') });
      return this;
    }
    execute = notInFake('Transaction.execute');
  }

  class StoredFirestore implements Firestore {
    get databaseId(): string {
      return '(default)';
    }
    get alwaysUseImplicitOrderBy(): boolean {
      return false;
    }
    collection(collectionPath: string): StoredCollectionReference {
      return new StoredCollectionReference(collectionPath);
    }
    doc(documentPath: string): StoredDocumentReference {
      return new StoredDocumentReference(documentPath);
    }
    collectionGroup(collectionId: string): StoredCollectionGroup {
      return new StoredCollectionGroup({
        source: collectionId,
        group: true,
        filters: [],
        orders: [],
        limit: Infinity,
      });
    }
    async getAll(...refs: Array<DocumentReference | ReadOptions>): Promise<DocumentSnapshot[]> {
      const paths = refs.map((ref) => pathOf(ref, 'getAll'));
      for (const path of paths) await runBeforeRead(path);
      const snaps = paths.map((path) => {
        assertReadable(path);
        return new StoredDocumentSnapshot(path);
      });
      for (const snap of snaps) await runAfterRead(snap.path);
      return snaps;
    }
    batch(): StoredWriteBatch {
      return new StoredWriteBatch();
    }
    async runTransaction<T>(updateFunction: (transaction: Transaction) => Promise<T>): Promise<T> {
      const MAX_ATTEMPTS = 10;
      if (nextTransactionFailure) {
        const error = nextTransactionFailure;
        nextTransactionFailure = null;
        throw error;
      }
      for (let attempt = 1; ; attempt++) {
        attempts++;
        const tx = new StoredTransaction();
        const result = await updateFunction(tx);
        const docConflict = [...tx.docReads].some(
          ([path, version]) => storedVersionOf(path) !== version,
        );
        const queryConflict =
          options.queryResultSetConflicts !== false &&
          tx.queryReads.some((q) => {
            const now = runQuery(q.shape);
            return (
              now.length !== q.paths.length ||
              now.some((path, i) => path !== q.paths[i] || storedVersionOf(path) !== q.versions[i])
            );
          });
        if (!docConflict && !queryConflict) {
          await commit(tx.recorder.ops);
          return result;
        }
        if (attempt >= MAX_ATTEMPTS)
          throw grpcError(10, 'ABORTED', 'too much contention on these documents');
      }
    }
    settings = notInFake('Firestore.settings');
    recursiveDelete = notInFake('Firestore.recursiveDelete');
    terminate = notInFake('Firestore.terminate');
    listCollections = notInFake('Firestore.listCollections');
    bulkWriter = notInFake('Firestore.bulkWriter');
    bundle = notInFake('Firestore.bundle');
    pipeline = notInFake('Firestore.pipeline');
  }

  const db = new StoredFirestore();

  return {
    db,
    seed: (path, data) => {
      docsByPath.set(path, docOf(stripSentinels(data), 'seed'));
      bumpStoredVersion(path);
    },
    reset: () => {
      docsByPath.clear();
      versions.clear();
      updateTimes.clear();
      afterReadHooks.clear();
      beforeReadHooks.clear();
      afterCommitHooks.length = 0;
      executedQueries.length = 0;
      committedWrites.length = 0;
      readFailure = null;
      queryFailure = null;
      commitFailure = null;
      nextTransactionFailure = null;
      attempts = 0;
    },
    remove: (path) => {
      docsByPath.delete(path);
      bumpStoredVersion(path);
    },
    read: (path) => cloneStoredValue(docsByPath.get(path)),
    paths: (prefix = '') => [...docsByPath.keys()].filter((path) => path.startsWith(prefix)).sort(),
    afterRead: (path, fn) => {
      afterReadHooks.set(path, [...(afterReadHooks.get(path) ?? []), fn]);
    },
    beforeRead: (path, fn) => {
      beforeReadHooks.set(path, [...(beforeReadHooks.get(path) ?? []), fn]);
    },
    failReads: (predicate, error) => {
      readFailure = { predicate, error };
    },
    failQueries: (predicate, error) => {
      queryFailure = { predicate, error };
    },
    failCommits: (predicate, count = 1) => {
      commitFailure = { predicate, remaining: count };
    },
    failNextTransaction: (error) => {
      nextTransactionFailure = error;
    },
    afterCommit: (fn, touches) => {
      afterCommitHooks.push({ fn, touches });
    },
    queries: () => [...executedQueries],
    writes: () => [...committedWrites],
    transactionAttempts: () => attempts,
    snapshotOf: (path) => new StoredDocumentSnapshot(path),
    queryDocumentSnapshotOf: (path) => new StoredQueryDocumentSnapshot(path),
    querySnapshotOf: (collectionPath, docPaths) =>
      new StoredQuerySnapshot(new StoredCollectionReference(collectionPath), docPaths),
  };
}

export interface InMemoryFirestoreOptions {
  queryResultSetConflicts?: boolean;
}

export function makeInMemoryFirestore(options: InMemoryFirestoreOptions = {}): InMemoryFirestore {
  return buildFakeFirestore(options);
}
