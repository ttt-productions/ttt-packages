import { describe, expect, it } from 'vitest';
import { makeInMemoryFirestore } from '@ttt-productions/firebase-helpers/server/testing';
import type { ServerFirestore } from '@ttt-productions/firebase-helpers/server';
import { ShortLinkIdExhaustedError, runShortLinkCreate } from '../src/server/short-link-create.js';
import { ShortLinkMalformedError, runShortLinkLookup } from '../src/server/short-link-lookup.js';
import { SHORT_LINK_ID_MAX_ATTEMPTS } from '../src/short-link-id.js';

const LINKS = 'links';

function createStore() {
  const store = makeInMemoryFirestore();
  const db: ServerFirestore = store.db;
  return { store, db };
}

function bytesFor(...ids: number[][]) {
  let call = 0;
  return () => Uint8Array.from(ids[call++] ?? ids[ids.length - 1]!);
}

const request = (db: ServerFirestore, overrides: object = {}) => ({
  links: db.collection(LINKS),
  destinationUrl: '/things/t1',
  type: 'thing',
  metadata: { thingId: 't1' },
  createdBy: 'u1',
  now: 100,
  randomBytes: bytesFor([0, 0, 0, 0, 0, 0]),
  ...overrides,
});

describe('runShortLinkCreate', () => {
  it('creates a link with no clicks for a destination that has none', async () => {
    const { store, db } = createStore();
    const result = await db.runTransaction((tx) => runShortLinkCreate(tx, request(db)));
    expect(result).toEqual({ shortId: 'AAAAAA', created: true });
    expect(store.read(`${LINKS}/AAAAAA`)).toEqual({
      shortId: 'AAAAAA',
      destinationUrl: '/things/t1',
      type: 'thing',
      metadata: { thingId: 't1' },
      createdAt: 100,
      createdBy: 'u1',
      clicks: 0,
    });
  });

  it("returns the destination's existing link and writes nothing", async () => {
    const { store, db } = createStore();
    store.seed(`${LINKS}/BBBBBB`, {
      shortId: 'BBBBBB',
      destinationUrl: '/things/t1',
      clicks: 3,
    });
    const result = await db.runTransaction((tx) =>
      runShortLinkCreate(tx, request(db, { createdBy: 'u2' })),
    );
    expect(result).toEqual({ shortId: 'BBBBBB', created: false });
    expect(store.paths(LINKS)).toEqual([`${LINKS}/BBBBBB`]);
  });

  it('draws another id when the first is taken', async () => {
    const { store, db } = createStore();
    store.seed(`${LINKS}/AAAAAA`, { destinationUrl: '/other', clicks: 0 });
    const result = await db.runTransaction((tx) =>
      runShortLinkCreate(
        tx,
        request(db, { randomBytes: bytesFor([0, 0, 0, 0, 0, 0], [1, 1, 1, 1, 1, 1]) }),
      ),
    );
    expect(result.shortId).toBe('BBBBBB');
    expect(store.read(`${LINKS}/AAAAAA`)).toEqual({ destinationUrl: '/other', clicks: 0 });
  });

  it('gives up after the attempt limit, writing nothing', async () => {
    const { store, db } = createStore();
    store.seed(`${LINKS}/AAAAAA`, { destinationUrl: '/other', clicks: 0 });
    let draws = 0;
    const always = () => {
      draws++;
      return Uint8Array.from([0, 0, 0, 0, 0, 0]);
    };
    await expect(
      db.runTransaction((tx) => runShortLinkCreate(tx, request(db, { randomBytes: always }))),
    ).rejects.toBeInstanceOf(ShortLinkIdExhaustedError);
    expect(draws).toBe(SHORT_LINK_ID_MAX_ATTEMPTS);
    expect(store.paths(LINKS)).toEqual([`${LINKS}/AAAAAA`]);
  });
});

describe('runShortLinkLookup', () => {
  it('answers the destination and counts the click', async () => {
    const { store, db } = createStore();
    store.seed(`${LINKS}/AAAAAA`, { destinationUrl: '/things/t1', clicks: 4 });
    const result = await db.runTransaction((tx) =>
      runShortLinkLookup(tx, db.collection(LINKS).doc('AAAAAA')),
    );
    expect(result).toEqual({ destinationUrl: '/things/t1' });
    expect(store.read(`${LINKS}/AAAAAA`)).toEqual({ destinationUrl: '/things/t1', clicks: 5 });
  });

  it('answers null for a link that does not exist, writing nothing', async () => {
    const { store, db } = createStore();
    const result = await db.runTransaction((tx) =>
      runShortLinkLookup(tx, db.collection(LINKS).doc('AAAAAA')),
    );
    expect(result).toBeNull();
    expect(store.paths(LINKS)).toEqual([]);
  });

  it('refuses a stored link with no destination, counting nothing', async () => {
    const { store, db } = createStore();
    store.seed(`${LINKS}/AAAAAA`, { clicks: 4 });
    await expect(
      db.runTransaction((tx) => runShortLinkLookup(tx, db.collection(LINKS).doc('AAAAAA'))),
    ).rejects.toBeInstanceOf(ShortLinkMalformedError);
    expect(store.read(`${LINKS}/AAAAAA`)).toEqual({ clicks: 4 });
  });
});
