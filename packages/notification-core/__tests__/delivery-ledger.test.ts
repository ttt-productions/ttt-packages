import { describe, it, expect } from 'vitest';
import {
  createDeliveryLedger,
  applyAggregation,
  type DeliveryRowInput,
} from '../src/server/delivery-ledger';
import type { NotificationSystemConfig } from '../src/types';
import type { ServerFirestore, ServerDocRef, ServerDocSnapshot } from '../src/server/types';

// ---- In-memory Firestore (create-if-absent + transactions) ----
function createMockFirestore() {
  const store = new Map<string, Map<string, Record<string, unknown>>>();
  const getCol = (p: string) => {
    if (!store.has(p)) store.set(p, new Map());
    return store.get(p)!;
  };
  const splitDoc = (path: string) => {
    const parts = path.split('/');
    return { colPath: parts.slice(0, -1).join('/'), id: parts[parts.length - 1] };
  };
  const makeDocRef = (colPath: string, id: string): ServerDocRef => ({
    id,
    set: async (data) => { getCol(colPath).set(id, { ...data }); },
    update: async (data) => { getCol(colPath).set(id, { ...(getCol(colPath).get(id) ?? {}), ...data }); },
    create: async (data) => {
      if (getCol(colPath).has(id)) throw Object.assign(new Error('already-exists'), { code: 6 });
      getCol(colPath).set(id, { ...data });
    },
    delete: async () => { getCol(colPath).delete(id); },
    get: async (): Promise<ServerDocSnapshot> => {
      const data = getCol(colPath).get(id);
      return { id, exists: !!data, data: () => (data ? { ...data } : undefined), ref: makeDocRef(colPath, id) };
    },
  });
  const makeColRef = (colPath: string) => ({
    doc: (id?: string) => makeDocRef(colPath, id ?? `auto_${getCol(colPath).size}`),
    where: () => { throw new Error('not used'); },
    orderBy: () => { throw new Error('not used'); },
    limit: () => { throw new Error('not used'); },
    add: async (data: Record<string, unknown>) => { const id = `auto_${getCol(colPath).size}`; getCol(colPath).set(id, { ...data }); return makeDocRef(colPath, id); },
  });
  const db: ServerFirestore = {
    collection: (p) => makeColRef(p) as never,
    doc: (path) => { const { colPath, id } = splitDoc(path); return makeDocRef(colPath, id); },
    batch: () => { throw new Error('not used'); },
    runTransaction: async (fn) => {
      // Single-threaded test executor: reads/writes hit the store directly.
      const tx = {
        get: (ref: ServerDocRef) => ref.get(),
        set: (ref: ServerDocRef, data: Record<string, unknown>) => { void ref.set(data); return tx; },
        update: (ref: ServerDocRef, data: Record<string, unknown>) => { void ref.update(data); return tx; },
        delete: (ref: ServerDocRef) => { void ref.delete(); return tx; },
      };
      return fn(tx);
    },
  };
  return { db, store, getCol };
}

const config: NotificationSystemConfig = {
  categories: {
    user: { activePath: 'activeUserNotifications', historyPath: (uid) => `userProfiles/${uid}/notificationHistory`, audienceType: 'personal' },
  },
  types: {
    test_increment: { category: 'user', delivery: 'queued', dedupKeyPattern: (m) => String(m.k), titlePattern: () => 'Title', messagePattern: (_m, c) => `count ${c}`, defaultTargetPath: '/x', countCap: 100, actorCap: 3 },
    test_static: { category: 'user', delivery: 'queued', dedupKeyPattern: (m) => String(m.k), titlePattern: () => 'Static', messagePattern: () => 'static', defaultTargetPath: '/y' },
  },
  deliveriesCollectionPath: 'notificationDeliveries',
  timestampFromMillis: (ms) => ({ __ts: ms }),
  deliveryTtlMs: 1000,
  maxDeliveryAttempts: 3,
};

function row(over: Partial<DeliveryRowInput> = {}): DeliveryRowInput {
  return {
    deliveryId: 'd1',
    notificationType: 'test_increment',
    eventId: 'e1',
    recipientUid: 'u1',
    aggregationKey: 'agg1',
    strategy: 'increment',
    payload: { actorId: 'actorA', metadata: { k: 'agg1' }, occurrenceAt: 1000 },
    payloadVersion: 1,
    materializationClass: 'directQueued',
    ...over,
  };
}

describe('applyAggregation (pure)', () => {
  const buildMessage = (c: number) => `count ${c}`;
  it('increment counts up to the cap and rotates generation', () => {
    const d = applyAggregation({ strategy: 'increment', existing: { count: 2, latestActorIds: ['x'] }, actorId: 'a', countCap: 100, actorCap: 3, buildMessage, now: 5, generation: 'gen2' });
    expect(d.count).toBe(3);
    expect(d.latestActorIds).toEqual(['a', 'x']);
    expect(d.activityGeneration).toBe('gen2');
    expect(d.seenAt).toBe(0);
  });
  it('increment respects the count cap', () => {
    const d = applyAggregation({ strategy: 'increment', existing: { count: 100, latestActorIds: [] }, actorId: 'a', countCap: 100, actorCap: 3, buildMessage, now: 5, generation: 'g' });
    expect(d.count).toBe(100);
  });
  it('staticRelight keeps count at 1', () => {
    const d = applyAggregation({ strategy: 'staticRelight', existing: { count: 1, latestActorIds: ['x'] }, actorId: 'a', countCap: 100, actorCap: 3, buildMessage, now: 5, generation: 'g' });
    expect(d.count).toBe(1);
  });
  it('creates at count 1 when there is no existing card', () => {
    const d = applyAggregation({ strategy: 'increment', existing: null, actorId: 'a', countCap: 100, actorCap: 3, buildMessage, now: 5, generation: 'g' });
    expect(d.count).toBe(1);
    expect(d.latestActorIds).toEqual(['a']);
  });
});

describe('createDeliveryLedger.enqueue', () => {
  it('creates new rows and treats an existing id as a duplicate no-op', async () => {
    const { db } = createMockFirestore();
    const ledger = createDeliveryLedger(db, config);
    const r1 = await ledger.enqueue([row({ deliveryId: 'a' })]);
    expect(r1.results[0].outcome).toBe('created');
    const r2 = await ledger.enqueue([row({ deliveryId: 'a' }), row({ deliveryId: 'b' })]);
    expect(r2.results.map((r) => r.outcome)).toEqual(['duplicate', 'created']);
    expect(r2.allResolved).toBe(true);
  });

  it('reports a non-already-exists failure and marks the page not fully resolved', async () => {
    const { db } = createMockFirestore();
    // Patch BEFORE constructing the ledger (it captures the deliveries collection ref).
    const orig = db.collection;
    db.collection = (p: string) => {
      const col = orig(p);
      return {
        ...col,
        doc: (id?: string) => ({
          ...col.doc(id),
          create: async () => { throw Object.assign(new Error('boom'), { code: 13 }); },
        }),
      } as never;
    };
    const ledger = createDeliveryLedger(db, config);
    const res = await ledger.enqueue([row({ deliveryId: 'x' })]);
    expect(res.results[0].outcome).toBe('failed');
    expect(res.allResolved).toBe(false);
  });

  it('throws when timestampFromMillis is missing', () => {
    const { db } = createMockFirestore();
    expect(() => createDeliveryLedger(db, { ...config, timestampFromMillis: undefined })).toThrow(/timestampFromMillis/);
  });
});

describe('createDeliveryLedger.materialize', () => {
  it('materializes a queued row into a new active card and flips state + expireAt', async () => {
    const { db, getCol } = createMockFirestore();
    const ledger = createDeliveryLedger(db, config);
    await ledger.enqueue([row({ deliveryId: 'd1' })]);
    const outcome = await ledger.materialize('d1');
    expect(outcome).toBe('materialized');

    const delivery = getCol('notificationDeliveries').get('d1')!;
    expect(delivery.state).toBe('materialized');
    expect(delivery.materializedAt).toBeTypeOf('number');
    expect(delivery.expireAt).toEqual({ __ts: expect.any(Number) });

    const active = [...getCol('activeUserNotifications').values()][0];
    expect(active.count).toBe(1);
    expect(active.seenAt).toBe(0);
    expect(active.activityGeneration).toBeTypeOf('string');
    expect(active.type).toBe('test_increment');
  });

  it('aggregates a second occurrence onto the same active card and rotates the generation', async () => {
    const { db, getCol } = createMockFirestore();
    const ledger = createDeliveryLedger(db, config);
    await ledger.enqueue([row({ deliveryId: 'd1', eventId: 'e1', payload: { actorId: 'a1', metadata: { k: 'agg1' }, occurrenceAt: 1 } })]);
    await ledger.materialize('d1');
    const gen1 = [...getCol('activeUserNotifications').values()][0].activityGeneration;

    await ledger.enqueue([row({ deliveryId: 'd2', eventId: 'e2', payload: { actorId: 'a2', metadata: { k: 'agg1' }, occurrenceAt: 2 } })]);
    await ledger.materialize('d2');

    const active = [...getCol('activeUserNotifications').values()][0];
    expect(active.count).toBe(2);
    expect(active.latestActorIds).toEqual(['a2', 'a1']);
    expect(active.activityGeneration).not.toBe(gen1);
  });

  it('staticRelight keeps count at 1 across occurrences', async () => {
    const { db, getCol } = createMockFirestore();
    const ledger = createDeliveryLedger(db, config);
    await ledger.enqueue([row({ deliveryId: 'd1', notificationType: 'test_static', strategy: 'staticRelight' })]);
    await ledger.materialize('d1');
    await ledger.enqueue([row({ deliveryId: 'd2', notificationType: 'test_static', strategy: 'staticRelight' })]);
    await ledger.materialize('d2');
    const active = [...getCol('activeUserNotifications').values()][0];
    expect(active.count).toBe(1);
  });

  it('is an idempotent no-op on a materialized row, and missing on an absent row', async () => {
    const { db } = createMockFirestore();
    const ledger = createDeliveryLedger(db, config);
    await ledger.enqueue([row({ deliveryId: 'd1' })]);
    expect(await ledger.materialize('d1')).toBe('materialized');
    expect(await ledger.materialize('d1')).toBe('already-materialized');
    expect(await ledger.materialize('nope')).toBe('missing');
  });
});

describe('createDeliveryLedger lifecycle', () => {
  it('records transient failures with backoff, then dead-letters at the attempt cap', async () => {
    const { db, getCol } = createMockFirestore();
    const ledger = createDeliveryLedger(db, config); // maxDeliveryAttempts: 3
    await ledger.enqueue([row({ deliveryId: 'd1' })]);
    await ledger.recordTransientFailure('d1', new Error('e1'));
    expect(getCol('notificationDeliveries').get('d1')!.state).toBe('queued');
    expect(getCol('notificationDeliveries').get('d1')!.attemptCount).toBe(1);
    await ledger.recordTransientFailure('d1', new Error('e2'));
    await ledger.recordTransientFailure('d1', new Error('e3'));
    const d = getCol('notificationDeliveries').get('d1')!;
    expect(d.state).toBe('deadLetter');
    expect(d.attemptCount).toBe(3);
    expect(d.deadLetteredAt).toBeTypeOf('number');
    expect(d.expireAt).toBeUndefined(); // never TTL a deadLetter (round-19)
  });

  it('replay returns a dead-letter to queued and clears terminal/TTL fields', async () => {
    const { db, getCol } = createMockFirestore();
    const ledger = createDeliveryLedger(db, config);
    await ledger.enqueue([row({ deliveryId: 'd1' })]);
    await ledger.deadLetter('d1', new Error('infra'));
    expect(getCol('notificationDeliveries').get('d1')!.state).toBe('deadLetter');
    await ledger.replay('d1');
    const d = getCol('notificationDeliveries').get('d1')!;
    expect(d.state).toBe('queued');
    expect(d.attemptCount).toBe(0);
    expect(d.lastError).toBeNull();
    expect(d.deadLetteredAt).toBeNull();
    expect(d.expireAt).toBeNull();
  });

  it('materializeMany tallies outcomes', async () => {
    const { db } = createMockFirestore();
    const ledger = createDeliveryLedger(db, config);
    await ledger.enqueue([row({ deliveryId: 'a' }), row({ deliveryId: 'b', aggregationKey: 'agg2', payload: { actorId: 'a', metadata: { k: 'agg2' }, occurrenceAt: 1 } })]);
    const tally = await ledger.materializeMany(['a', 'b', 'missing'], { concurrency: 2 });
    expect(tally.materialized).toBe(2);
    expect(tally.missing).toBe(1);
  });
});
