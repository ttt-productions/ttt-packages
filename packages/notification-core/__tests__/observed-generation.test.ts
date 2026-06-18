import { describe, it, expect, vi } from 'vitest';
import {
  markNotificationSeenWithGeneration,
  archiveNotificationWithGeneration,
} from '../src/server/observed-generation';
import type { ServerFirestore, ServerDocRef, ServerDocSnapshot, ServerTransaction } from '../src/server/types';

function createMockFirestore() {
  const store = new Map<string, Map<string, Record<string, unknown>>>();
  const getCol = (p: string) => {
    if (!store.has(p)) store.set(p, new Map());
    return store.get(p)!;
  };
  const makeDocRef = (colPath: string, id: string): ServerDocRef => ({
    id,
    set: async (data) => { getCol(colPath).set(id, { ...data }); },
    update: async (data) => { getCol(colPath).set(id, { ...(getCol(colPath).get(id) ?? {}), ...data }); },
    create: async (data) => { if (getCol(colPath).has(id)) throw Object.assign(new Error('already-exists'), { code: 6 }); getCol(colPath).set(id, { ...data }); },
    delete: async () => { getCol(colPath).delete(id); },
    get: async (): Promise<ServerDocSnapshot> => {
      const data = getCol(colPath).get(id);
      return { id, exists: !!data, data: () => (data ? { ...data } : undefined), ref: makeDocRef(colPath, id) };
    },
  });
  const db: ServerFirestore = {
    collection: () => { throw new Error('not used'); },
    doc: () => { throw new Error('not used'); },
    batch: () => { throw new Error('not used'); },
    runTransaction: async (fn) => {
      const tx = {
        get: (ref: ServerDocRef) => ref.get(),
        set: (ref: ServerDocRef, data: Record<string, unknown>) => { void ref.set(data); return tx; },
        update: (ref: ServerDocRef, data: Record<string, unknown>) => { void ref.update(data); return tx; },
        delete: (ref: ServerDocRef) => { void ref.delete(); return tx; },
      };
      return fn(tx);
    },
  };
  return { db, getCol, makeDocRef };
}

const ts = (ms: number) => ({ __ts: ms });

describe('markNotificationSeenWithGeneration', () => {
  it('stamps seenAt when the observed generation matches', async () => {
    const { db, getCol, makeDocRef } = createMockFirestore();
    getCol('active').set('c1', { activityGeneration: 'gen1', seenAt: 0 });
    const outcome = await markNotificationSeenWithGeneration(db, makeDocRef('active', 'c1'), { observedActivityGeneration: 'gen1', now: 50 });
    expect(outcome).toBe('seen');
    expect(getCol('active').get('c1')).toMatchObject({ seenAt: 50, seenAtGeneration: 'gen1' });
  });

  it('no-ops when the generation has rotated (newer activity not swallowed)', async () => {
    const { db, getCol, makeDocRef } = createMockFirestore();
    getCol('active').set('c1', { activityGeneration: 'gen2', seenAt: 0 });
    const outcome = await markNotificationSeenWithGeneration(db, makeDocRef('active', 'c1'), { observedActivityGeneration: 'gen1', now: 50 });
    expect(outcome).toBe('generation-mismatch');
    expect(getCol('active').get('c1')!.seenAt).toBe(0);
  });

  it('returns missing for an absent card', async () => {
    const { db, makeDocRef } = createMockFirestore();
    expect(await markNotificationSeenWithGeneration(db, makeDocRef('active', 'gone'), { observedActivityGeneration: 'g' })).toBe('missing');
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
    const { db, getCol, makeDocRef } = createMockFirestore();
    getCol('active').set('c1', { activityGeneration: 'gen1', count: 3 });
    const outcome = await archiveNotificationWithGeneration(db, baseParams(makeDocRef));
    expect(outcome).toBe('archived');
    expect(getCol('active').has('c1')).toBe(false);
    const h = getCol('history').get('h1')!;
    expect(h).toMatchObject({ archiveOccurrenceId: 'h1', requestId: 'req1', payloadHash: 'hashA', activeId: 'c1', observedActivityGeneration: 'gen1' });
    expect(h.expireAt).toEqual({ __ts: 9000 });
    expect((h.archivedSnapshot as Record<string, unknown>).count).toBe(3);
  });

  it('replays idempotently (same payloadHash) without touching anything', async () => {
    const { db, getCol, makeDocRef } = createMockFirestore();
    getCol('history').set('h1', { payloadHash: 'hashA', archiveOccurrenceId: 'h1' });
    getCol('active').set('c1', { activityGeneration: 'gen1' });
    const outcome = await archiveNotificationWithGeneration(db, baseParams(makeDocRef));
    expect(outcome).toBe('replayed');
    expect(getCol('active').has('c1')).toBe(true); // untouched
  });

  it('conflicts when the same history id carries a different payloadHash', async () => {
    const { db, getCol, makeDocRef } = createMockFirestore();
    getCol('history').set('h1', { payloadHash: 'DIFFERENT' });
    getCol('active').set('c1', { activityGeneration: 'gen1' });
    expect(await archiveNotificationWithGeneration(db, baseParams(makeDocRef))).toBe('conflict');
  });

  it('leaves the active card when its generation no longer matches', async () => {
    const { db, getCol, makeDocRef } = createMockFirestore();
    getCol('active').set('c1', { activityGeneration: 'gen2' }); // rotated since render
    const outcome = await archiveNotificationWithGeneration(db, baseParams(makeDocRef));
    expect(outcome).toBe('generation-mismatch');
    expect(getCol('active').has('c1')).toBe(true);
    expect(getCol('history').has('h1')).toBe(false);
  });

  it('returns missing when the active card is already gone', async () => {
    const { db, makeDocRef } = createMockFirestore();
    expect(await archiveNotificationWithGeneration(db, baseParams(makeDocRef))).toBe('missing');
  });

  it('runs the auditWrite hook INSIDE the archive transaction on success (audit commits atomically with the move)', async () => {
    const { db, getCol, makeDocRef } = createMockFirestore();
    getCol('active').set('c1', { activityGeneration: 'gen1', count: 3 });

    let txSeenByHook: ServerTransaction | undefined;
    const auditWrite = vi.fn((txn: ServerTransaction) => {
      txSeenByHook = txn;
      // The hook composes its own write into the SAME transaction.
      txn.set(makeDocRef('audit', 'a1'), { type: 'notification.adminArchived', handledBy: 'admin1' });
    });

    const outcome = await archiveNotificationWithGeneration(db, { ...baseParams(makeDocRef), auditWrite });

    expect(outcome).toBe('archived');
    expect(auditWrite).toHaveBeenCalledTimes(1);
    // The hook received a real transaction handle, and its write landed alongside
    // the active→history move — proving same-transaction composition.
    expect(txSeenByHook).toBeDefined();
    expect(typeof txSeenByHook!.set).toBe('function');
    expect(getCol('active').has('c1')).toBe(false);
    expect(getCol('history').has('h1')).toBe(true);
    expect(getCol('audit').get('a1')).toMatchObject({ type: 'notification.adminArchived', handledBy: 'admin1' });
  });

  it('does NOT call the auditWrite hook on a conflict (no audit written for a non-archiving outcome)', async () => {
    const { db, getCol, makeDocRef } = createMockFirestore();
    getCol('history').set('h1', { payloadHash: 'DIFFERENT' });
    getCol('active').set('c1', { activityGeneration: 'gen1' });

    const auditWrite = vi.fn();
    const outcome = await archiveNotificationWithGeneration(db, { ...baseParams(makeDocRef), auditWrite });

    expect(outcome).toBe('conflict');
    expect(auditWrite).not.toHaveBeenCalled();
    expect(getCol('audit').has('a1')).toBe(false);
  });
});
