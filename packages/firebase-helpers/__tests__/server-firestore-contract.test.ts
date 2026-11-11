import { describe, expect, it, vi } from 'vitest';
import { FieldPath, Firestore } from 'firebase-admin/firestore';
import type {
  Timestamp,
  DocumentReference,
  DocumentSnapshot,
  Query,
  Firestore as AdminFirestore,
} from 'firebase-admin/firestore';
import { makeInMemoryFirestore } from '../src/server/testing/in-memory-firestore.js';
import type {
  ServerDocRef,
  ServerDocSnapshot,
  ServerFirestore,
  ServerQuery,
  ServerUpdateTime,
} from '../src/server/firestore-types.js';

// Checked by the type checker: each Admin SDK type is assignable to its contract type.
const adminFits: [
  AdminFirestore extends ServerFirestore ? true : never,
  Query extends ServerQuery ? true : never,
  DocumentSnapshot extends ServerDocSnapshot ? true : never,
  DocumentReference extends ServerDocRef ? true : never,
  Timestamp extends ServerUpdateTime ? true : never,
] = [true, true, true, true, true];

// gRPC FAILED_PRECONDITION: the code the Admin SDK gives a write whose precondition no longer holds.
const FAILED_PRECONDITION = 9;

function seeded() {
  const store = makeInMemoryFirestore();
  for (const id of ['c', 'a', 'd', 'b']) store.seed(`rows/${id}`, { n: 1 });
  return store;
}

describe('the server Firestore contract', () => {
  it("is satisfied by the Admin SDK's Firestore, query, snapshot and reference", () => {
    expect(adminFits).toEqual([true, true, true, true, true]);
  });

  it('reads several documents in one getAll, in the order asked, a missing one as missing', async () => {
    const db: ServerFirestore = seeded().db;
    const snapshots = await db.getAll(db.doc('rows/b'), db.doc('rows/zz'), db.doc('rows/a'));
    expect(snapshots.map((snapshot) => [snapshot.id, snapshot.exists])).toEqual([
      ['b', true],
      ['zz', false],
      ['a', true],
    ]);
  });

  it('resumes a query after field values with the field-value form of startAfter', async () => {
    const store = makeInMemoryFirestore();
    store.seed('rows/x', { n: 1 });
    store.seed('rows/y', { n: 1 });
    store.seed('rows/z', { n: 2 });
    const db: ServerFirestore = store.db;
    const page = await db
      .collection('rows')
      .orderBy('n')
      .orderBy('__name__')
      .startAfter(1, 'x')
      .get();
    expect(page.docs.map((doc) => doc.id)).toEqual(['y', 'z']);
  });

  it('gives a snapshot its update time, and deletes only while that time is current', async () => {
    const store = makeInMemoryFirestore();
    store.seed('rows/a', { n: 1 });
    const db: ServerFirestore = store.db;
    const read = await db.doc('rows/a').get();
    expect(typeof read.updateTime?.toMillis()).toBe('number');
    await db.doc('rows/a').update({ n: 2 });
    await expect(
      db.doc('rows/a').delete({ lastUpdateTime: read.updateTime }),
    ).rejects.toMatchObject({
      code: FAILED_PRECONDITION,
    });
    expect(store.read('rows/a')).toEqual({ n: 2 });
    const current = await db.doc('rows/a').get();
    await db.doc('rows/a').delete({ lastUpdateTime: current.updateTime });
    expect(store.read('rows/a')).toBeUndefined();
  });
});

describe('the update time', () => {
  it('compares equal between two reads of an unchanged document', async () => {
    const store = makeInMemoryFirestore();
    store.seed('rows/a', { n: 1 });
    const db: ServerFirestore = store.db;
    const first = (await db.doc('rows/a').get()).updateTime;
    const second = (await db.doc('rows/a').get()).updateTime;
    expect(first && second && first.isEqual(second)).toBe(true);
  });

  it('compares unequal after a rewrite in the same millisecond, though its milliseconds match', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    try {
      const store = makeInMemoryFirestore();
      const db: ServerFirestore = store.db;
      await db.doc('rows/a').set({ n: 1 });
      const before = (await db.doc('rows/a').get()).updateTime;
      await db.doc('rows/a').set({ n: 2 });
      const after = (await db.doc('rows/a').get()).updateTime;
      expect(before?.toMillis()).toBe(after?.toMillis());
      expect(before && after && before.isEqual(after)).toBe(false);
    } finally {
      vi.useRealTimers();
    }
  });
});

describe("ordering by '__name__'", () => {
  it("is the Admin SDK's document-id order", () => {
    const db = new Firestore({ projectId: 'demo-contract' });
    const byName = db.collection('rows').orderBy('__name__').startAfter('b').limit(2);
    const byDocumentId = db
      .collection('rows')
      .orderBy(FieldPath.documentId())
      .startAfter('b')
      .limit(2);
    expect(byName.isEqual(byDocumentId)).toBe(true);
  });

  it('orders the in-memory kit by document id and resumes after an id, as the Admin SDK does', async () => {
    const db: ServerFirestore = seeded().db;
    const all = await db.collection('rows').orderBy('__name__').get();
    expect(all.docs.map((doc) => doc.id)).toEqual(['a', 'b', 'c', 'd']);
    const resumed = await db.collection('rows').orderBy('__name__').startAfter('b').limit(1).get();
    expect(resumed.docs.map((doc) => doc.id)).toEqual(['c']);
  });
});
