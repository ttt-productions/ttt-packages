import { describe, it, expect, vi } from 'vitest';
import {
  markNotificationSeenWithGeneration,
  archiveNotificationWithGeneration,
} from '../src/server/observed-generation.js';
import { makeInMemoryFirestore } from '@ttt-productions/firebase-helpers/server/testing';
import type {
  ServerDocRef,
  ServerFirestore,
  ServerTransaction,
} from '@ttt-productions/firebase-helpers/server';

function createStore() {
  const store = makeInMemoryFirestore();
  const db: ServerFirestore = store.db;
  const makeDocRef = (collection: string, id: string): ServerDocRef =>
    db.collection(collection).doc(id);
  return { db, store, makeDocRef };
}

const ts = (ms: number) => ({ __ts: ms });

describe('markNotificationSeenWithGeneration', () => {
  it('stamps seenAt when the observed generation matches', async () => {
    const { db, store, makeDocRef } = createStore();
    store.seed('active/c1', { activityGeneration: 'gen1', seenAt: 0 });
    const outcome = await markNotificationSeenWithGeneration(db, makeDocRef('active', 'c1'), {
      observedActivityGeneration: 'gen1',
      now: 50,
    });
    expect(outcome).toBe('seen');
    expect(store.read('active/c1')).toMatchObject({ seenAt: 50, seenAtGeneration: 'gen1' });
  });

  it('no-ops when the generation has rotated (newer activity not swallowed)', async () => {
    const { db, store, makeDocRef } = createStore();
    store.seed('active/c1', { activityGeneration: 'gen2', seenAt: 0 });
    const outcome = await markNotificationSeenWithGeneration(db, makeDocRef('active', 'c1'), {
      observedActivityGeneration: 'gen1',
      now: 50,
    });
    expect(outcome).toBe('generation-mismatch');
    expect(store.read('active/c1')!.seenAt).toBe(0);
  });

  it('returns missing for an absent card', async () => {
    const { db, makeDocRef } = createStore();
    expect(
      await markNotificationSeenWithGeneration(db, makeDocRef('active', 'gone'), {
        observedActivityGeneration: 'g',
      }),
    ).toBe('missing');
  });
});

describe('archiveNotificationWithGeneration', () => {
  const baseParams = (makeDocRef: (c: string, id: string) => ServerDocRef) => ({
    activeRef: makeDocRef('active', 'c1'),
    historyRef: makeDocRef('history', 'h1'),
    requestId: 'req1',
    observedActivityGeneration: 'gen1',
    payloadHash: 'hashA',
    category: 'user',
    audienceScope: 'user:u1',
    expireAtMs: 9000,
    timestampFromMillis: ts,
  });

  it('archives once: creates the history doc and removes the active card', async () => {
    const { db, store, makeDocRef } = createStore();
    store.seed('active/c1', { activityGeneration: 'gen1', count: 3 });
    const outcome = await archiveNotificationWithGeneration(db, baseParams(makeDocRef));
    expect(outcome).toBe('archived');
    expect(store.read('active/c1') !== undefined).toBe(false);
    const h = store.read('history/h1')!;
    expect(h).toMatchObject({
      archiveOccurrenceId: 'h1',
      requestId: 'req1',
      payloadHash: 'hashA',
      activeId: 'c1',
      observedActivityGeneration: 'gen1',
    });
    expect(h.expireAt).toEqual({ __ts: 9000 });
    expect((h.archivedSnapshot as Record<string, unknown>).count).toBe(3);
  });

  it('replays idempotently (same payloadHash) without touching anything', async () => {
    const { db, store, makeDocRef } = createStore();
    store.seed('history/h1', { payloadHash: 'hashA', archiveOccurrenceId: 'h1' });
    store.seed('active/c1', { activityGeneration: 'gen1' });
    const outcome = await archiveNotificationWithGeneration(db, baseParams(makeDocRef));
    expect(outcome).toBe('replayed');
    expect(store.read('active/c1') !== undefined).toBe(true);
  });

  it('conflicts when the same history id carries a different payloadHash', async () => {
    const { db, store, makeDocRef } = createStore();
    store.seed('history/h1', { payloadHash: 'DIFFERENT' });
    store.seed('active/c1', { activityGeneration: 'gen1' });
    expect(await archiveNotificationWithGeneration(db, baseParams(makeDocRef))).toBe('conflict');
  });

  it('leaves the active card when its generation no longer matches', async () => {
    const { db, store, makeDocRef } = createStore();
    store.seed('active/c1', { activityGeneration: 'gen2' });
    const outcome = await archiveNotificationWithGeneration(db, baseParams(makeDocRef));
    expect(outcome).toBe('generation-mismatch');
    expect(store.read('active/c1') !== undefined).toBe(true);
    expect(store.read('history/h1') !== undefined).toBe(false);
  });

  it('returns missing when the active card is already gone', async () => {
    const { db, makeDocRef } = createStore();
    expect(await archiveNotificationWithGeneration(db, baseParams(makeDocRef))).toBe('missing');
  });

  it('runs the auditWrite hook INSIDE the archive transaction on success (audit commits atomically with the move)', async () => {
    const { db, store, makeDocRef } = createStore();
    store.seed('active/c1', { activityGeneration: 'gen1', count: 3 });

    let txSeenByHook: ServerTransaction | undefined;
    const auditWrite = vi.fn((txn: ServerTransaction) => {
      txSeenByHook = txn;
      txn.set(makeDocRef('audit', 'a1'), {
        type: 'notification.adminArchived',
        handledBy: 'admin1',
      });
    });

    const outcome = await archiveNotificationWithGeneration(db, {
      ...baseParams(makeDocRef),
      auditWrite,
    });

    expect(outcome).toBe('archived');
    expect(auditWrite).toHaveBeenCalledTimes(1);
    expect(txSeenByHook).toBeDefined();
    expect(typeof txSeenByHook!.set).toBe('function');
    expect(store.read('active/c1') !== undefined).toBe(false);
    expect(store.read('history/h1') !== undefined).toBe(true);
    expect(store.read('audit/a1')).toMatchObject({
      type: 'notification.adminArchived',
      handledBy: 'admin1',
    });
  });

  it('awaits an async auditWrite hook before the archive resolves', async () => {
    const { db, store, makeDocRef } = createStore();
    store.seed('active/c1', { activityGeneration: 'gen1' });

    const auditWrite = async (txn: ServerTransaction) => {
      await Promise.resolve();
      txn.set(makeDocRef('audit', 'a1'), { type: 'notification.adminArchived' });
    };

    const outcome = await archiveNotificationWithGeneration(db, {
      ...baseParams(makeDocRef),
      auditWrite,
    });

    expect(outcome).toBe('archived');
    expect(store.read('audit/a1') !== undefined).toBe(true);
  });

  it('fails the archive transaction when the auditWrite hook rejects, so the archive never commits without its write', async () => {
    const { db, store, makeDocRef } = createStore();
    store.seed('active/c1', { activityGeneration: 'gen1', count: 3 });
    const failure = new Error('Cannot use "undefined" as a Firestore value');

    await expect(
      archiveNotificationWithGeneration(db, {
        ...baseParams(makeDocRef),
        auditWrite: async (txn) => {
          txn.set(makeDocRef('audit', 'a1'), { type: 'notification.adminArchived' });
          await Promise.resolve();
          throw failure;
        },
      }),
    ).rejects.toBe(failure);
    expect(store.read('active/c1')).toEqual({ activityGeneration: 'gen1', count: 3 });
    expect(store.read('history/h1')).toBeUndefined();
    expect(store.read('audit/a1')).toBeUndefined();
  });

  it('fails the archive transaction when the auditWrite hook throws synchronously', async () => {
    const { db, store, makeDocRef } = createStore();
    store.seed('active/c1', { activityGeneration: 'gen1', count: 3 });
    const failure = new Error('Cannot use "undefined" as a Firestore value');

    await expect(
      archiveNotificationWithGeneration(db, {
        ...baseParams(makeDocRef),
        auditWrite: (txn) => {
          txn.set(makeDocRef('audit', 'a1'), { type: 'notification.adminArchived' });
          throw failure;
        },
      }),
    ).rejects.toBe(failure);
    expect(store.read('active/c1')).toEqual({ activityGeneration: 'gen1', count: 3 });
    expect(store.read('history/h1')).toBeUndefined();
    expect(store.read('audit/a1')).toBeUndefined();
  });

  it('does NOT call the auditWrite hook on a conflict (no audit written for a non-archiving outcome)', async () => {
    const { db, store, makeDocRef } = createStore();
    store.seed('history/h1', { payloadHash: 'DIFFERENT' });
    store.seed('active/c1', { activityGeneration: 'gen1' });

    const auditWrite = vi.fn();
    const outcome = await archiveNotificationWithGeneration(db, {
      ...baseParams(makeDocRef),
      auditWrite,
    });

    expect(outcome).toBe('conflict');
    expect(auditWrite).not.toHaveBeenCalled();
    expect(store.read('audit/a1') !== undefined).toBe(false);
  });
});
