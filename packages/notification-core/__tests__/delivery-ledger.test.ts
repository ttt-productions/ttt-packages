import { describe, it, expect, vi } from 'vitest';
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
  // Doc ids whose transactional reads fail, as an unavailable backend would.
  const failingReads = new Set<string>();
  const db: ServerFirestore = {
    collection: (p) => makeColRef(p) as never,
    doc: (path) => { const { colPath, id } = splitDoc(path); return makeDocRef(colPath, id); },
    batch: () => { throw new Error('not used'); },
    runTransaction: async (fn) => {
      // Single-threaded test executor: reads hit the store directly; writes are buffered and
      // applied only once the transaction function resolves, so a throw commits nothing.
      const writes: Array<() => Promise<unknown>> = [];
      const tx = {
        get: (ref: ServerDocRef) =>
          failingReads.has(ref.id) ? Promise.reject(new Error(`read of ${ref.id} failed`)) : ref.get(),
        set: (ref: ServerDocRef, data: Record<string, unknown>) => { writes.push(() => ref.set(data)); return tx; },
        update: (ref: ServerDocRef, data: Record<string, unknown>) => { writes.push(() => ref.update(data)); return tx; },
        delete: (ref: ServerDocRef) => { writes.push(() => ref.delete()); return tx; },
      };
      const result = await fn(tx);
      for (const write of writes) await write();
      return result;
    },
  };
  return { db, store, getCol, failingReads };
}

const config: NotificationSystemConfig = {
  categories: {
    user: { activePath: 'activeUserNotifications', historyPath: (uid) => `userProfiles/${uid}/notificationHistory`, audienceType: 'personal' },
  },
  types: {
    test_increment: { category: 'user', delivery: 'queued', dedupKeyPattern: (m) => String(m.k), titlePattern: () => 'Title', messagePattern: (_m, c) => `count ${c}`, defaultTargetPath: '/x', countCap: 100, actorCap: 3 },
    test_static: { category: 'user', delivery: 'queued', dedupKeyPattern: (m) => String(m.k), titlePattern: () => 'Static', messagePattern: () => 'static', defaultTargetPath: '/y' },
    // Title + targetPath derived from the occurrence metadata — exercises the N-I4 refresh.
    test_refresh: { category: 'user', delivery: 'queued', dedupKeyPattern: (m) => String(m.k), titlePattern: (m) => `Title ${m.title}`, messagePattern: (_m, c) => `count ${c}`, defaultTargetPath: (m) => `/item/${m.id}`, countCap: 100, actorCap: 3 },
    // No defaultTargetPath — a linkless, clear-only type; the doc must OMIT targetPath.
    test_linkless: { category: 'user', delivery: 'queued', dedupKeyPattern: (m) => String(m.k), titlePattern: () => 'Linkless', messagePattern: () => 'linkless', countCap: 1, actorCap: 1 },
  },
  deliveriesCollectionPath: 'notificationDeliveries',
  timestampFromMillis: (ms) => ({ __ts: ms }),
  deliveryTtlMs: 1000,
  maxDeliveryAttempts: 3,
};

/** A ledger whose consumer has no eligibility rule: every recipient may receive. */
const ELIGIBLE = { isRecipientEligible: async () => true };

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
  it('does not inject a null actor into latestActorIds (N-M2)', () => {
    const d = applyAggregation({ strategy: 'increment', existing: { count: 1, latestActorIds: ['x'] }, actorId: null, countCap: 100, actorCap: 3, buildMessage, now: 5, generation: 'g' });
    expect(d.latestActorIds).toEqual(['x']);
  });
  it('does not inject an empty-string actor into latestActorIds (N-M2)', () => {
    const d = applyAggregation({ strategy: 'increment', existing: null, actorId: '', countCap: 100, actorCap: 3, buildMessage, now: 5, generation: 'g' });
    expect(d.latestActorIds).toEqual([]);
  });
});

describe('createDeliveryLedger.enqueue', () => {
  it('creates new rows and treats an existing id as a duplicate no-op', async () => {
    const { db } = createMockFirestore();
    const ledger = createDeliveryLedger(db, config, ELIGIBLE);
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
    const ledger = createDeliveryLedger(db, config, ELIGIBLE);
    const res = await ledger.enqueue([row({ deliveryId: 'x' })]);
    expect(res.results[0].outcome).toBe('failed');
    expect(res.allResolved).toBe(false);
  });

  it('throws when timestampFromMillis is missing', () => {
    const { db } = createMockFirestore();
    expect(() => createDeliveryLedger(db, { ...config, timestampFromMillis: undefined }, ELIGIBLE)).toThrow(/timestampFromMillis/);
  });
});

describe('createDeliveryLedger.materialize', () => {
  it('materializes a queued row into a new active card and flips state + expireAt', async () => {
    const { db, getCol } = createMockFirestore();
    const ledger = createDeliveryLedger(db, config, ELIGIBLE);
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
    const ledger = createDeliveryLedger(db, config, ELIGIBLE);
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
    const ledger = createDeliveryLedger(db, config, ELIGIBLE);
    await ledger.enqueue([row({ deliveryId: 'd1', notificationType: 'test_static', strategy: 'staticRelight' })]);
    await ledger.materialize('d1');
    await ledger.enqueue([row({ deliveryId: 'd2', notificationType: 'test_static', strategy: 'staticRelight' })]);
    await ledger.materialize('d2');
    const active = [...getCol('activeUserNotifications').values()][0];
    expect(active.count).toBe(1);
  });

  it('is an idempotent no-op on a materialized row, and missing on an absent row', async () => {
    const { db } = createMockFirestore();
    const ledger = createDeliveryLedger(db, config, ELIGIBLE);
    await ledger.enqueue([row({ deliveryId: 'd1' })]);
    expect(await ledger.materialize('d1')).toBe('materialized');
    expect(await ledger.materialize('d1')).toBe('already-materialized');
    expect(await ledger.materialize('nope')).toBe('missing');
  });

  it('refreshes title / targetPath / metadata from the latest occurrence on an existing card (N-I4)', async () => {
    const { db, getCol } = createMockFirestore();
    const ledger = createDeliveryLedger(db, config, ELIGIBLE);
    await ledger.enqueue([
      row({ deliveryId: 'd1', notificationType: 'test_refresh', aggregationKey: 'agg', payload: { actorId: 'a1', metadata: { k: 'agg', title: 'First', id: '1' }, occurrenceAt: 1 } }),
    ]);
    await ledger.materialize('d1');
    await ledger.enqueue([
      row({ deliveryId: 'd2', notificationType: 'test_refresh', aggregationKey: 'agg', payload: { actorId: 'a2', metadata: { k: 'agg', title: 'Second', id: '2' }, occurrenceAt: 2 } }),
    ]);
    await ledger.materialize('d2');

    const active = [...getCol('activeUserNotifications').values()][0];
    expect(active.count).toBe(2);
    // N-I4: the aggregated card reflects the NEWEST occurrence, not the first.
    expect(active.title).toBe('Title Second');
    expect(active.targetPath).toBe('/item/2');
    expect((active.metadata as { title: string }).title).toBe('Second');
  });

  it('omits targetPath entirely for a type with no defaultTargetPath (linkless)', async () => {
    const { db, getCol } = createMockFirestore();
    const ledger = createDeliveryLedger(db, config, ELIGIBLE);
    await ledger.enqueue([row({ deliveryId: 'd1', notificationType: 'test_linkless' })]);
    await ledger.materialize('d1');

    const active = [...getCol('activeUserNotifications').values()][0];
    // The KEY must be absent (a Firestore write with an `undefined` value throws),
    // so the consumer's `targetPath ?` check renders a clear-only row.
    expect(Object.keys(active)).not.toContain('targetPath');

    // An aggregate update on the existing card must not introduce the field either.
    await ledger.enqueue([row({ deliveryId: 'd2', eventId: 'e2', notificationType: 'test_linkless' })]);
    await ledger.materialize('d2');
    const relit = [...getCol('activeUserNotifications').values()][0];
    expect(Object.keys(relit)).not.toContain('targetPath');
  });
});

describe('createDeliveryLedger lifecycle', () => {
  it('records transient failures with backoff, then dead-letters at the attempt cap', async () => {
    const { db, getCol } = createMockFirestore();
    const ledger = createDeliveryLedger(db, config, ELIGIBLE); // maxDeliveryAttempts: 3
    await ledger.enqueue([row({ deliveryId: 'd1' })]);
    expect(getCol('notificationDeliveries').get('d1')!.materializationClass).toBe('directQueued');
    await ledger.recordTransientFailure('d1', new Error('e1'));
    expect(getCol('notificationDeliveries').get('d1')!.state).toBe('queued');
    expect(getCol('notificationDeliveries').get('d1')!.attemptCount).toBe(1);
    // n1: a backed-off row is re-stamped into the reserved `retry` lane so it drains there
    // (separate capacity) instead of competing in its original `directQueued` lane.
    expect(getCol('notificationDeliveries').get('d1')!.materializationClass).toBe('retry');
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
    const ledger = createDeliveryLedger(db, config, ELIGIBLE);
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
    const ledger = createDeliveryLedger(db, config, ELIGIBLE);
    await ledger.enqueue([row({ deliveryId: 'a' }), row({ deliveryId: 'b', aggregationKey: 'agg2', payload: { actorId: 'a', metadata: { k: 'agg2' }, occurrenceAt: 1 } })]);
    const tally = await ledger.materializeMany(['a', 'b', 'missing'], { concurrency: 2 });
    expect(tally.materialized).toBe(2);
    expect(tally.missing).toBe(1);
  });
});

describe('materializeMany isolates each row', () => {
  it('a row whose failure cannot be recorded is reported, and the rest of the batch proceeds', async () => {
    const { db, getCol, failingReads } = createMockFirestore();
    const ledger = createDeliveryLedger(db, config, ELIGIBLE);
    await ledger.enqueue([
      row({ deliveryId: 'a' }),
      row({ deliveryId: 'bad', aggregationKey: 'agg-bad', payload: { actorId: 'a', metadata: { k: 'agg-bad' }, occurrenceAt: 1 } }),
      row({ deliveryId: 'b', aggregationKey: 'agg2', payload: { actorId: 'a', metadata: { k: 'agg2' }, occurrenceAt: 1 } }),
    ]);
    failingReads.add('bad');
    const onUnrecordedFailure = vi.fn();

    const tally = await ledger.materializeMany(['a', 'bad', 'b'], { concurrency: 1, onUnrecordedFailure });

    expect(tally.materialized).toBe(2);
    expect(onUnrecordedFailure).toHaveBeenCalledTimes(1);
    const [failedId, recordError, details] = onUnrecordedFailure.mock.calls[0];
    expect(failedId).toBe('bad');
    expect(recordError).toBeInstanceOf(Error);
    expect(details.cause).toBeInstanceOf(Error);
    const bad = getCol('notificationDeliveries').get('bad')!;
    expect(bad.state).toBe('queued');
    expect(bad.attemptCount).toBe(0);
  });

  it('hands over the recording failure with the materialize failure it was recording as its cause', async () => {
    const { db } = createMockFirestore();
    const ledger = createDeliveryLedger(db, config, ELIGIBLE);
    await ledger.enqueue([row({ deliveryId: 'bad' })]);
    const materializeFailure = new Error('materialize failed');
    const recordFailure = new Error('record failed');
    const failures = [materializeFailure, recordFailure];
    db.runTransaction = async () => {
      throw failures.shift();
    };
    const onUnrecordedFailure = vi.fn();

    await ledger.materializeMany(['bad'], { onUnrecordedFailure });

    expect(onUnrecordedFailure).toHaveBeenCalledWith('bad', recordFailure, { cause: materializeFailure });
  });

  it('without a handler the unrecorded failure goes to the console, and a throwing handler does not fail the batch', async () => {
    const errors = vi.spyOn(console, 'error').mockImplementation(() => {});
    try {
      const { db, failingReads } = createMockFirestore();
      const ledger = createDeliveryLedger(db, config, ELIGIBLE);
      await ledger.enqueue([row({ deliveryId: 'bad' }), row({ deliveryId: 'a', aggregationKey: 'agg2', payload: { actorId: 'a', metadata: { k: 'agg2' }, occurrenceAt: 1 } })]);
      failingReads.add('bad');

      await expect(ledger.materializeMany(['bad', 'a'], { concurrency: 1 })).resolves.toMatchObject({ materialized: 1 });
      expect(errors).toHaveBeenCalled();

      errors.mockClear();
      const tally = await ledger.materializeMany(['bad'], {
        onUnrecordedFailure: () => {
          throw new Error('capture failed');
        },
      });
      expect(tally.materialized).toBe(0);
      expect(errors).toHaveBeenCalled();
    } finally {
      errors.mockRestore();
    }
  });
});

describe('recipient eligibility', () => {
  function ledgerRejecting(ineligible: Set<string>, seen: Array<{ uid: string; inTransaction: boolean }> = []) {
    const { db, getCol } = createMockFirestore();
    const ledger = createDeliveryLedger(db, config, {
      isRecipientEligible: async (uid, tx) => {
        seen.push({ uid, inTransaction: typeof tx.get === 'function' });
        return !ineligible.has(uid);
      },
    });
    return { ledger, getCol, seen };
  }

  it('an ineligible recipient gets no card and the row is skipped, not retried', async () => {
    const { ledger, getCol, seen } = ledgerRejecting(new Set(['erased']));
    await ledger.enqueue([row({ deliveryId: 'dx', recipientUid: 'erased' })]);

    expect(await ledger.materialize('dx')).toBe('skipped-ineligible-recipient');

    expect(getCol('activeUserNotifications').size).toBe(0);
    const d = getCol('notificationDeliveries').get('dx')!;
    expect(d.state).toBe('skipped');
    expect(d.skipReason).toBe('recipientIneligible');
    expect(d.expireAt).toEqual({ __ts: (d.skippedAt as number) + 1000 });
    expect(seen).toEqual([{ uid: 'erased', inTransaction: true }]);
  });

  it('eligible recipients in the same batch still get their cards', async () => {
    const { ledger, getCol } = ledgerRejecting(new Set(['erased']));
    await ledger.enqueue([
      row({ deliveryId: 'd-a', recipientUid: 'alice' }),
      row({ deliveryId: 'd-x', recipientUid: 'erased' }),
      row({ deliveryId: 'd-b', recipientUid: 'bob' }),
    ]);

    const tally = await ledger.materializeMany(['d-a', 'd-x', 'd-b']);

    expect(tally.materialized).toBe(2);
    expect(tally['skipped-ineligible-recipient']).toBe(1);
    const targets = [...getCol('activeUserNotifications').values()].map((c) => c.targetUserId).sort();
    expect(targets).toEqual(['alice', 'bob']);
  });

  it('a re-run of a skipped row is a no-op', async () => {
    const seen: Array<{ uid: string; inTransaction: boolean }> = [];
    const { ledger, getCol } = ledgerRejecting(new Set(['erased']), seen);
    await ledger.enqueue([row({ deliveryId: 'dx', recipientUid: 'erased' })]);
    await ledger.materialize('dx');
    const afterFirst = { ...getCol('notificationDeliveries').get('dx')! };

    expect(await ledger.materialize('dx')).toBe('skipped-ineligible-recipient');
    await ledger.replay('dx');

    expect(getCol('notificationDeliveries').get('dx')).toEqual(afterFirst);
    expect(getCol('activeUserNotifications').size).toBe(0);
    expect(seen).toHaveLength(1);
  });

  it('a shared (recipient-less) row is never checked', async () => {
    const seen: Array<{ uid: string; inTransaction: boolean }> = [];
    const { ledger } = ledgerRejecting(new Set(), seen);
    await ledger.enqueue([row({ deliveryId: 'ds', recipientUid: null })]);

    expect(await ledger.materialize('ds')).toBe('materialized');
    expect(seen).toHaveLength(0);
  });

  it('a failing eligibility read leaves the row queued for a retry, never skipped', async () => {
    const { db, getCol } = createMockFirestore();
    const ledger = createDeliveryLedger(db, config, {
      isRecipientEligible: async () => { throw new Error('profile read failed'); },
    });
    await ledger.enqueue([row({ deliveryId: 'dr', recipientUid: 'alice' })]);

    await ledger.materializeMany(['dr']);

    const d = getCol('notificationDeliveries').get('dr')!;
    expect(d.state).toBe('queued');
    expect(d.attemptCount).toBe(1);
    expect(getCol('activeUserNotifications').size).toBe(0);
  });
});
