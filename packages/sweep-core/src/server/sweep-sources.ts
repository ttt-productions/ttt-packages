import type {
  ServerDocRef,
  ServerDocSnapshot,
  ServerFirestore,
  ServerQuery,
} from '@ttt-productions/firebase-helpers/server';
import type { SweepDeferredRow, SweepPosition } from '../sweep-state.js';

export interface SweepRow<Item> {
  readonly key: string;
  readonly position: SweepPosition;
  readonly item: Item;
}

export interface SweepSourcePage<Item> {
  readonly rows: readonly SweepRow<Item>[];
  readonly reachedEnd: boolean;
  readonly failure?: Error;
}

export interface SweepSource<Item> {
  pages(start: SweepPosition | null, pageSize: number): AsyncIterable<SweepSourcePage<Item>>;
}

const DOCUMENT_ID = '__name__';

export function firestoreIdSource(query: ServerQuery): SweepSource<ServerDocSnapshot> {
  return {
    async *pages(start, pageSize) {
      let after = start?.key;
      for (;;) {
        const ordered = query.orderBy(DOCUMENT_ID);
        const snapshot = await (after === undefined ? ordered : ordered.startAfter(after))
          .limit(pageSize)
          .get();
        const rows = snapshot.docs.map((doc) => ({
          key: doc.id,
          position: { key: doc.id },
          item: doc,
        }));
        const reachedEnd = snapshot.docs.length < pageSize;
        yield { rows, reachedEnd };
        if (reachedEnd) return;
        after = snapshot.docs[snapshot.docs.length - 1]?.id;
      }
    },
  };
}

export class SweepPositionValueError extends Error {
  readonly field: string;
  readonly key: string;

  constructor(field: string, key: string) {
    super(
      `a sweep ordered by ${field} met row ${key}, whose ${field} is neither a number nor null`,
    );
    this.name = 'SweepPositionValueError';
    this.field = field;
    this.key = key;
  }
}

function positionValue(value: unknown): value is number | null {
  return value === null || typeof value === 'number';
}

export function firestoreValueSource(
  query: ServerQuery,
  field: string,
): SweepSource<ServerDocSnapshot> {
  return {
    async *pages(start, pageSize) {
      let after: readonly [number | null, string] | undefined =
        start === null ? undefined : [start.value ?? null, start.key];
      for (;;) {
        const ordered = query.orderBy(field).orderBy(DOCUMENT_ID);
        const snapshot = await (after === undefined ? ordered : ordered.startAfter(...after))
          .limit(pageSize)
          .get();
        const rows: SweepRow<ServerDocSnapshot>[] = [];
        for (const doc of snapshot.docs) {
          const value = doc.data()?.[field];
          if (!positionValue(value)) {
            yield { rows, reachedEnd: false, failure: new SweepPositionValueError(field, doc.id) };
            return;
          }
          rows.push({ key: doc.id, position: { key: doc.id, value }, item: doc });
        }
        const reachedEnd = snapshot.docs.length < pageSize;
        yield { rows, reachedEnd };
        const last = rows[rows.length - 1]?.position;
        if (reachedEnd || last === undefined || last === null) return;
        after = [last.value ?? null, last.key];
      }
    },
  };
}

export interface SweepObjectListQuery {
  readonly prefix: string;
  readonly maxResults: number;
  readonly autoPaginate: false;
  readonly pageToken?: string;
  readonly startOffset?: string;
}

export interface SweepObjectLister<StoredObject extends { readonly name: string }> {
  getFiles(
    query: SweepObjectListQuery,
  ): Promise<readonly [StoredObject[], ({ pageToken?: string } | null)?, ...unknown[]]>;
}

export function storageListingSource<StoredObject extends { readonly name: string }>(
  lister: SweepObjectLister<StoredObject>,
  prefix: string,
): SweepSource<StoredObject> {
  return {
    async *pages(start, pageSize) {
      let pageToken: string | undefined;
      for (;;) {
        const [listed, next] = await lister.getFiles({
          prefix,
          maxResults: pageSize,
          autoPaginate: false,
          ...(pageToken !== undefined ? { pageToken } : {}),
          // `startOffset` is inclusive, so the object the lap stopped at is skipped below.
          ...(pageToken === undefined && start ? { startOffset: start.key } : {}),
        });
        const rows = listed
          .filter((object) => object.name !== start?.key)
          .map((object) => ({ key: object.name, position: { key: object.name }, item: object }));
        pageToken = next?.pageToken || undefined;
        yield { rows, reachedEnd: pageToken === undefined };
        if (pageToken === undefined) return;
      }
    },
  };
}

export function rereadDocuments(
  firestore: () => ServerFirestore,
  refOf: (key: string) => ServerDocRef,
): (rows: readonly SweepDeferredRow[]) => Promise<ReadonlyMap<string, ServerDocSnapshot>> {
  return async (rows) => {
    if (rows.length === 0) return new Map();
    const snapshots = await firestore().getAll(...rows.map((row) => refOf(row.key)));
    const found = new Map<string, ServerDocSnapshot>();
    snapshots.forEach((snapshot, index) => {
      const row = rows[index];
      if (row !== undefined && snapshot.exists) found.set(row.key, snapshot);
    });
    return found;
  };
}
