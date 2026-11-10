import { describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import { makeInMemoryFirestore } from '@ttt-productions/firebase-helpers/server/testing';
import { createBeaconStampSchema } from '../src/beacon-stamp.js';
import { writeBeaconStamp } from '../src/server/write-beacon-stamp.js';
import type { BeaconStampWriter } from '../src/server/write-beacon-stamp.js';
import { anyInstanceOf } from '../../../test/matchers.js';

const BEACON = 'signals/page1';
const IDS = 'signals';
const ITEM = 'items/i1';

const schema = createBeaconStampSchema({
  section: z.enum(['list', 'summary']),
  itemId: z.string().min(1).optional(),
});

// `store.db` is typed as the Admin SDK's Firestore, so each case that hands the writer a transaction
// or a batch from it also proves the Admin SDK's own types satisfy the writer's contract.
function createStore() {
  const store = makeInMemoryFirestore();
  const request = (
    fields: { section: 'list' | 'summary'; itemId?: string },
    now = 1_700_000_000_000,
  ) => ({
    beacon: store.db.doc(BEACON),
    ids: store.db.collection(IDS),
    schema,
    fields,
    now,
  });
  return { store, db: store.db, request };
}

describe('writeBeaconStamp', () => {
  it("commits the stamp with the caller's own write in one transaction", async () => {
    const { store, db, request } = createStore();
    const stamp = await db.runTransaction((transaction) => {
      transaction.set(db.doc(ITEM), { title: 'one' });
      return Promise.resolve(
        writeBeaconStamp(transaction, request({ section: 'list', itemId: 'i1' })),
      );
    });

    expect(stamp).toEqual({
      updatedAt: 1_700_000_000_000,
      changeId: anyInstanceOf(String),
      section: 'list',
      itemId: 'i1',
    });
    expect(stamp.changeId).not.toBe('');
    expect(store.read(BEACON)).toEqual(stamp);
    expect(store.read(ITEM)).toEqual({ title: 'one' });
  });

  it('writes nothing when the transaction it rides fails', async () => {
    const { store, db, request } = createStore();
    await expect(
      db.runTransaction((transaction) => {
        writeBeaconStamp(transaction, request({ section: 'list' }));
        return Promise.reject(new Error('the change failed'));
      }),
    ).rejects.toThrow('the change failed');

    expect(store.read(BEACON)).toBeUndefined();
  });

  it("rides the caller's batch, and is stored only when the batch commits", async () => {
    const { store, db, request } = createStore();
    const batch = db.batch();
    batch.set(db.doc(ITEM), { title: 'one' });
    const stamp = writeBeaconStamp(batch, request({ section: 'summary' }));
    expect(store.read(BEACON)).toBeUndefined();

    await batch.commit();
    expect(store.read(BEACON)).toEqual(stamp);
    expect(store.read(ITEM)).toEqual({ title: 'one' });
  });

  it('replaces the document whole, so an earlier stamp leaves none of its fields behind', async () => {
    const { store, db, request } = createStore();
    await db.runTransaction((transaction) =>
      Promise.resolve(writeBeaconStamp(transaction, request({ section: 'list', itemId: 'i1' }))),
    );
    await db.runTransaction((transaction) =>
      Promise.resolve(writeBeaconStamp(transaction, request({ section: 'summary' }, 5))),
    );

    expect(store.read(BEACON)).toEqual({
      updatedAt: 5,
      changeId: anyInstanceOf(String),
      section: 'summary',
    });
  });

  it('gives every write its own change id, even two writes stamped with the same time', () => {
    const { request } = createStore();
    const writer = { set: vi.fn<BeaconStampWriter['set']>() };
    const first = writeBeaconStamp(writer, request({ section: 'list' }, 5));
    const second = writeBeaconStamp(writer, request({ section: 'list' }, 5));

    expect(first.updatedAt).toBe(second.updatedAt);
    expect(first.changeId).not.toBe(second.changeId);
  });

  it('mints the change id with no write of its own', async () => {
    const { store, db, request } = createStore();
    await db.runTransaction((transaction) =>
      Promise.resolve(writeBeaconStamp(transaction, request({ section: 'list' }))),
    );

    expect(store.paths()).toEqual([BEACON]);
    expect(store.writes()).toHaveLength(1);
  });

  it("refuses, before writing, a stamp the app's schema does not accept", () => {
    const { request } = createStore();
    const writer = { set: vi.fn<BeaconStampWriter['set']>() };

    expect(() => writeBeaconStamp(writer, request({ section: 'list', itemId: '' }))).toThrow();
    expect(() => writeBeaconStamp(writer, request({ section: 'list' }, -1))).toThrow();
    expect(writer.set).not.toHaveBeenCalled();
  });

  it("stores only the fields the app's schema declares (RULE-STD-BACKEND-115)", async () => {
    const { store, db, request } = createStore();
    const undeclared = { section: 'list' as const, note: 'kept nowhere' };
    await db.runTransaction((transaction) =>
      Promise.resolve(writeBeaconStamp(transaction, request(undeclared))),
    );

    expect(store.read(BEACON)).toEqual({
      updatedAt: 1_700_000_000_000,
      changeId: anyInstanceOf(String),
      section: 'list',
    });
  });

  it("stamps the time and the id itself, whatever the caller's fields carry", async () => {
    const { store, db } = createStore();
    const fields: { section: 'list' } = Object.assign(
      { section: 'list' as const },
      { updatedAt: 1, changeId: 'chosen-by-the-caller' },
    );
    const stamp = await db.runTransaction((transaction) =>
      Promise.resolve(
        writeBeaconStamp(transaction, {
          beacon: db.doc(BEACON),
          ids: db.collection(IDS),
          schema,
          fields,
          now: 9,
        }),
      ),
    );

    expect(stamp.updatedAt).toBe(9);
    expect(stamp.changeId).not.toBe('chosen-by-the-caller');
    expect(store.read(BEACON)).toEqual(stamp);
  });
});
