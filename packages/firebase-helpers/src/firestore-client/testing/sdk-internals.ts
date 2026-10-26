// SANCTIONED EXCEPTION: the one module that reads the client SDK's internal query and snapshot
// shapes. The SDK publishes no reader of a built query's path, filters, order, limit, or cursors,
// and no constructor of a missing-document or count snapshot; the double reads both here, and its
// own test fails the moment an SDK upgrade changes them.
import { vi } from 'vitest';
import type {
  AggregateField,
  AggregateQuerySnapshot,
  DocumentData,
  DocumentSnapshot,
  FirestoreDataConverter,
  Query,
  SnapshotMetadata,
} from 'firebase/firestore';
import { fromSdkValue, type ComparableValue } from './client-values.js';

// The real SDK, though suites mock 'firebase/firestore': a mock's factory loads this module.
const sdk = await vi.importActual<typeof import('firebase/firestore')>('firebase/firestore');

type CountSnapshot<A, D extends DocumentData> = AggregateQuerySnapshot<
  { count: AggregateField<number> },
  A,
  D
>;

const isCountSnapshotOf = <A, D extends DocumentData>(
  value: unknown,
  query: Query<A, D>,
): value is CountSnapshot<A, D> =>
  value instanceof sdk.AggregateQuerySnapshot && value.query === query;

export const isDocumentSnapshotOf = <A, D extends DocumentData>(
  value: unknown,
  converter: FirestoreDataConverter<A, D> | null,
): value is DocumentSnapshot<A, D> =>
  value instanceof sdk.DocumentSnapshot && value.ref.converter === converter;

export type DescribedPredicate =
  | { kind: 'field'; field: string; op: string; value: ComparableValue }
  | { kind: 'and' | 'or'; filters: DescribedPredicate[] };

export interface DescribedBound {
  position: ComparableValue[];
  inclusive: boolean;
}

export interface DescribedOrder {
  field: string;
  direction: 'asc' | 'desc';
}

export interface DescribedQuery {
  path: string;
  collectionGroup: string | null;
  filters: DescribedPredicate[];
  orders: DescribedOrder[];
  limit: number | null;
  limitToLast: boolean;
  startAt: DescribedBound | null;
  endAt: DescribedBound | null;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

function unreadable(what: string): never {
  throw new Error(
    `in-memory client Firestore: the installed firebase SDK no longer carries ${what} where this double reads it`,
  );
}

function canonical(value: unknown, what: string): string {
  if (!isRecord(value)) return unreadable(what);
  const method: unknown = Reflect.get(value, 'canonicalString');
  const read: unknown = typeof method === 'function' ? Reflect.apply(method, value, []) : undefined;
  return typeof read === 'string' ? read : unreadable(what);
}

function predicateOf(filter: unknown): DescribedPredicate {
  if (!isRecord(filter)) return unreadable('a query filter');
  if ('field' in filter) {
    const op = filter.op;
    if (typeof op !== 'string') return unreadable("a filter's operator");
    return {
      kind: 'field',
      field: canonical(filter.field, "a filter's field"),
      op,
      value: fromSdkValue(filter.value),
    };
  }
  const op = filter.op;
  const filters = filter.filters;
  if ((op === 'and' || op === 'or') && Array.isArray(filters))
    return { kind: op, filters: filters.map(predicateOf) };
  return unreadable('a composite filter');
}

function boundOf(bound: unknown): DescribedBound | null {
  if (bound === null || bound === undefined) return null;
  if (!isRecord(bound) || !Array.isArray(bound.position) || typeof bound.inclusive !== 'boolean')
    return unreadable('a query cursor');
  return { position: bound.position.map(fromSdkValue), inclusive: bound.inclusive };
}

export function describeQuery<A, D extends DocumentData>(query: Query<A, D>): DescribedQuery {
  const internal: unknown = Reflect.get(query, '_query');
  if (!isRecord(internal)) return unreadable('the query description');
  const { filters, explicitOrderBy, limit, limitType, collectionGroup } = internal;
  if (!Array.isArray(filters) || !Array.isArray(explicitOrderBy)) return unreadable('query parts');
  return {
    path: canonical(internal.path, "the query's path"),
    collectionGroup: typeof collectionGroup === 'string' ? collectionGroup : null,
    filters: filters.map(predicateOf),
    orders: explicitOrderBy.map((order: unknown) => {
      if (!isRecord(order)) return unreadable('a query order');
      return {
        field: canonical(order.field, "an order's field"),
        direction: order.dir === 'desc' ? 'desc' : 'asc',
      };
    }),
    limit: typeof limit === 'number' ? limit : null,
    limitToLast: limitType === 'L',
    startAt: boundOf(internal.startAt),
    endAt: boundOf(internal.endAt),
  };
}

export function missingDocumentSnapshot<A, D extends DocumentData>(
  template: DocumentSnapshot,
  path: string,
  converter: FirestoreDataConverter<A, D> | null,
): DocumentSnapshot<A, D> {
  const key: unknown = Reflect.get(template, '_key');
  if (!isRecord(key)) return unreadable('a snapshot key');
  const keyClass: unknown = Reflect.get(key, 'constructor');
  if (typeof keyClass !== 'function') return unreadable('the document key class');
  const fromPath: unknown = Reflect.get(keyClass, 'fromPath');
  if (typeof fromPath !== 'function') return unreadable('the document key builder');
  const missingKey: unknown = Reflect.apply(fromPath, keyClass, [path]);
  const snapshot: unknown = Reflect.construct(sdk.DocumentSnapshot, [
    template.ref.firestore,
    Reflect.get(template, '_userDataWriter'),
    missingKey,
    null,
    template.metadata,
    converter,
  ]);
  return isDocumentSnapshotOf(snapshot, converter)
    ? snapshot
    : unreadable('the snapshot constructor');
}

export function answeredFromCache<S extends { metadata: SnapshotMetadata }>(snapshot: S): S {
  const metadata: unknown = Reflect.construct(sdk.SnapshotMetadata, [
    snapshot.metadata.hasPendingWrites,
    true,
  ]);
  if (!(metadata instanceof sdk.SnapshotMetadata))
    return unreadable('the snapshot metadata constructor');
  Object.defineProperty(snapshot, 'metadata', { value: metadata, enumerable: true });
  return snapshot;
}

export function countSnapshot<A, D extends DocumentData>(
  query: Query<A, D>,
  template: DocumentSnapshot,
  count: number,
): CountSnapshot<A, D> {
  const snapshot: unknown = Reflect.construct(sdk.AggregateQuerySnapshot, [
    query,
    Reflect.get(template, '_userDataWriter'),
    { count: { integerValue: String(count) } },
  ]);
  return isCountSnapshotOf(snapshot, query) ? snapshot : unreadable('the count snapshot');
}
