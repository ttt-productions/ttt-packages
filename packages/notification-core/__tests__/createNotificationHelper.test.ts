import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createNotificationHelper } from '../src/server/createNotificationHelper';
import { buildActiveNotificationDocId } from '../src/server/activeNotificationId';
import type { NotificationSystemConfig } from '../src/types';
import type { ServerFirestore, ServerDocRef, ServerTransaction } from '../src/server/types';

// ---- Mock Firestore builder ----
// Backed by real in-memory maps so deterministic-ID writes (tx.set/tx.update)
// land somewhere inspectable. Collections are cached so the same collection
// object is returned on repeated calls.

function createMockFirestore() {
  const collections = new Map<string, Map<string, Record<string, unknown>>>();
  const collectionObjects = new Map<string, ReturnType<ServerFirestore['collection']>>();
  let autoId = 0;
  let transactionCount = 0;

  const getCol = (path: string) => {
    if (!collections.has(path)) collections.set(path, new Map());
    return collections.get(path)!;
  };

  const makeDocRef = (colPath: string, id: string): ServerDocRef => ({
    id,
    set: vi.fn(async (data: Record<string, unknown>) => {
      getCol(colPath).set(id, { ...data });
    }),
    update: vi.fn(async (data: Record<string, unknown>) => {
      const col = getCol(colPath);
      const existing = col.get(id) ?? {};
      col.set(id, { ...existing, ...data });
    }),
    create: vi.fn(async (data: Record<string, unknown>) => {
      const col = getCol(colPath);
      if (col.has(id)) throw Object.assign(new Error('already-exists'), { code: 6 });
      col.set(id, { ...data });
    }),
    delete: vi.fn(async () => { getCol(colPath).delete(id); }),
    get: vi.fn(async () => {
      const data = getCol(colPath).get(id);
      return { id, exists: !!data, data: () => data ?? undefined, ref: makeDocRef(colPath, id) };
    }),
  });

  const makeColObj = (colPath: string) => {
    const addSpy = vi.fn(async (data: Record<string, unknown>) => {
      const id = `auto_${++autoId}`;
      getCol(colPath).set(id, { ...data, id });
      return makeDocRef(colPath, id);
    });

    const makeQuery = () => ({
      where: vi.fn().mockReturnThis(),
      orderBy: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      get: vi.fn(async () => ({ empty: true, docs: [], size: 0 })),
    });

    return {
      doc: (docId?: string) => makeDocRef(colPath, docId ?? `doc_${++autoId}`),
      add: addSpy,
      where: vi.fn(() => makeQuery()),
    };
  };

  const db: ServerFirestore = {
    collection: (colPath: string) => {
      if (!collectionObjects.has(colPath)) {
        collectionObjects.set(colPath, makeColObj(colPath) as any);
      }
      return collectionObjects.get(colPath)!;
    },
    doc: (path: string) => {
      const parts = path.split('/');
      const id = parts[parts.length - 1];
      const colPath = parts.slice(0, -1).join('/');
      return makeDocRef(colPath, id);
    },
    batch: () => ({
      set: vi.fn(() => ({} as any)),
      update: vi.fn(() => ({} as any)),
      delete: vi.fn(() => ({} as any)),
      commit: vi.fn(async () => {}),
    }),
    // Immediate-apply transaction: good enough for unit tests, which assert
    // deterministic-ID convergence rather than real contention semantics.
    runTransaction: async <T,>(fn: (tx: ServerTransaction) => Promise<T>): Promise<T> => {
      transactionCount++;
      const tx: ServerTransaction = {
        get: async (ref) => ref.get(),
        set: (ref, data, options) => {
          void ref.set(data, options);
          return tx;
        },
        update: (ref, data) => {
          void ref.update(data);
          return tx;
        },
        delete: (ref) => {
          void ref.delete();
          return tx;
        },
      };
      return fn(tx);
    },
  };

  return { db, collections, collectionObjects, getTransactionCount: () => transactionCount };
}

// ---- Test config ----

function makeConfig(): NotificationSystemConfig {
  return {
    categories: {
      user: {
        activePath: 'userNotifications',
        historyPath: (userId) => `userNotificationHistory/${userId}/items`,
        audienceType: 'personal',
      },
      admin: {
        activePath: 'adminNotifications',
        historyPath: () => 'adminNotificationHistory',
        audienceType: 'shared',
      },
    },
    types: {
      content_report: {
        category: 'admin',
        delivery: 'realtime',
        dedupKeyPattern: (meta) => `report_${meta.itemId}`,
        titlePattern: () => 'New Report',
        messagePattern: (_, count) => `${count} report(s)`,
        defaultTargetPath: '/admin/reports',
      },
      batch_notification: {
        category: 'user',
        delivery: 'queued',
        dedupKeyPattern: (meta) => `batch_${meta.itemId}`,
        titlePattern: () => 'Batch Notification',
        messagePattern: (_, count) => `${count} update(s)`,
        defaultTargetPath: '/dashboard',
      },
    },
    pendingCollectionPath: 'pendingNotifications',
  };
}

describe('createNotificationHelper', () => {
  let db: ServerFirestore;
  let collections: Map<string, Map<string, Record<string, unknown>>>;
  let collectionObjects: Map<string, any>;
  let getTransactionCount: () => number;
  let helper: ReturnType<typeof createNotificationHelper>;

  beforeEach(() => {
    const mock = createMockFirestore();
    db = mock.db;
    collections = mock.collections;
    collectionObjects = mock.collectionObjects;
    getTransactionCount = mock.getTransactionCount;
    helper = createNotificationHelper(db, makeConfig());
  });

  const activeDocs = (path: string) => Array.from((collections.get(path) ?? new Map()).values());

  it('returns an object with send, sendRealTime, queueForBatch methods', () => {
    expect(typeof helper.send).toBe('function');
    expect(typeof helper.sendRealTime).toBe('function');
    expect(typeof helper.queueForBatch).toBe('function');
  });

  describe('send()', () => {
    it('routes realtime delivery types to the active collection', async () => {
      // send() uses internal closures, so verify by checking side effects
      await helper.send({
        type: 'content_report',
        actorId: 'user1',
        metadata: { itemId: 'item123' },
      });
      expect(activeDocs('adminNotifications')).toHaveLength(1);
    });

    it('routes queued delivery types to the pending collection', async () => {
      await helper.send({
        type: 'batch_notification',
        actorId: 'user1',
        metadata: { itemId: 'item123' },
      });
      const pendingCol = collectionObjects.get('pendingNotifications');
      expect(pendingCol?.add).toHaveBeenCalledTimes(1);
    });

    it('throws for unknown notification type', async () => {
      await expect(
        helper.send({ type: 'unknown_type', actorId: 'u1', metadata: {} })
      ).rejects.toThrow('Unknown notification type: unknown_type');
    });
  });

  describe('sendRealTime()', () => {
    it('creates the active doc at its deterministic ID inside a transaction', async () => {
      await helper.sendRealTime({
        type: 'content_report',
        actorId: 'user1',
        metadata: { itemId: 'abc' },
      });

      expect(getTransactionCount()).toBe(1);

      const expectedId = buildActiveNotificationDocId({
        category: 'admin',
        audienceType: 'shared',
        targetUserId: null,
        dedupKey: 'report_abc',
      });
      const docData = collections.get('adminNotifications')?.get(expectedId);
      expect(docData).toBeDefined();
      expect(docData!.type).toBe('content_report');
      expect(docData!.dedupKey).toBe('report_abc');
      expect(docData!.count).toBe(1);
      expect(docData!.latestActorIds).toEqual(['user1']);
      // Active docs are created unseen so the unread count() predicate matches.
      expect(docData!.seenAt).toBe(0);
      // Identity is stored id-only — no persisted display names.
      expect(docData!.latestActorNames).toBeUndefined();
    });

    it('creates notification with correct title and message', async () => {
      await helper.sendRealTime({
        type: 'content_report',
        actorId: 'user1',
        metadata: { itemId: 'abc' },
      });

      const [docData] = activeDocs('adminNotifications');
      expect(docData.title).toBe('New Report');
      expect(docData.message).toBe('1 report(s)');
    });

    it('converges concurrent same-dedup sends onto ONE active doc', async () => {
      await helper.sendRealTime({ type: 'content_report', actorId: 'user1', metadata: { itemId: 'abc' } });
      await helper.sendRealTime({ type: 'content_report', actorId: 'user2', metadata: { itemId: 'abc' } });

      const docs = activeDocs('adminNotifications');
      expect(docs).toHaveLength(1);
      expect(docs[0].count).toBe(2);
      expect(docs[0].latestActorIds).toEqual(['user2', 'user1']);
      expect(docs[0].message).toBe('2 report(s)');
      // New activity re-lights the unread badge.
      expect(docs[0].seenAt).toBe(0);
    });

    it('keeps distinct dedup keys on distinct docs', async () => {
      await helper.sendRealTime({ type: 'content_report', actorId: 'user1', metadata: { itemId: 'abc' } });
      await helper.sendRealTime({ type: 'content_report', actorId: 'user1', metadata: { itemId: 'def' } });

      expect(activeDocs('adminNotifications')).toHaveLength(2);
    });

    it('throws for unknown category config', async () => {
      const badConfig: NotificationSystemConfig = {
        ...makeConfig(),
        types: {
          bad_type: {
            category: 'nonexistent',
            delivery: 'realtime',
            dedupKeyPattern: () => 'key',
            titlePattern: () => 'Title',
            messagePattern: () => 'msg',
            defaultTargetPath: '/path',
          },
        },
      };
      const badHelper = createNotificationHelper(db, badConfig);
      await expect(
        badHelper.sendRealTime({ type: 'bad_type', actorId: 'u1', metadata: {} })
      ).rejects.toThrow('Unknown category: nonexistent');
    });

    it('sets targetUserId to null when not provided', async () => {
      await helper.sendRealTime({
        type: 'content_report',
        actorId: 'user1',
        metadata: { itemId: 'abc' },
      });

      const [docData] = activeDocs('adminNotifications');
      expect(docData.targetUserId).toBeNull();
    });
  });

  describe('queueForBatch()', () => {
    it('adds document to pending collection', async () => {
      await helper.queueForBatch({
        type: 'batch_notification',
        actorId: 'user2',
        targetUserId: 'user3',
        metadata: { itemId: 'xyz' },
      });

      const pendingCol = collectionObjects.get('pendingNotifications');
      expect(pendingCol).toBeDefined();
      expect(pendingCol!.add).toHaveBeenCalledTimes(1);

      const docData = pendingCol!.add.mock.calls[0][0];
      expect(docData.type).toBe('batch_notification');
      expect(docData.actorId).toBe('user2');
      // Pending docs are id-only — no actorName persisted.
      expect(docData.actorName).toBeUndefined();
      expect(docData.targetUserId).toBe('user3');
      // Pending docs carry NO seenAt — that lives only on active docs.
      expect(docData.seenAt).toBeUndefined();
    });

    it('sets targetUserId to null when not provided', async () => {
      await helper.queueForBatch({
        type: 'batch_notification',
        actorId: 'user2',
        metadata: { itemId: 'xyz' },
      });

      const pendingCol = collectionObjects.get('pendingNotifications');
      expect(pendingCol!.add.mock.calls[0][0].targetUserId).toBeNull();
    });

    it('throws for unknown type', async () => {
      await expect(
        helper.queueForBatch({ type: 'unknown', actorId: 'u1', metadata: {} })
      ).rejects.toThrow('Unknown notification type: unknown');
    });
  });

  describe('queueManyForBatch()', () => {
    // A db mock that tracks every batch.set and batch.commit across chunks.
    function createBatchTrackingDb() {
      const setCalls: Array<{ data: Record<string, unknown> }> = [];
      let commits = 0;
      let autoId = 0;

      const db: ServerFirestore = {
        collection: vi.fn(() => ({
          doc: vi.fn(() => ({
            id: `auto_${++autoId}`,
            set: vi.fn(),
            update: vi.fn(),
            delete: vi.fn(),
            get: vi.fn(),
          })) as any,
          add: vi.fn(),
          where: vi.fn(),
        })) as any,
        doc: vi.fn(),
        batch: vi.fn(() => ({
          set: vi.fn((_ref: ServerDocRef, data: Record<string, unknown>) => {
            setCalls.push({ data });
            return {} as any;
          }),
          update: vi.fn(() => ({} as any)),
          delete: vi.fn(() => ({} as any)),
          commit: vi.fn(async () => { commits++; }),
        })),
        runTransaction: vi.fn(async (fn: any) => fn({
          get: vi.fn(), set: vi.fn(), update: vi.fn(), delete: vi.fn(),
        })),
      };

      return { db, setCalls, commitCount: () => commits };
    }

    it('writes one pending doc per input with no seenAt', async () => {
      const { db, setCalls } = createBatchTrackingDb();
      const h = createNotificationHelper(db, makeConfig());

      await h.queueManyForBatch([
        { type: 'batch_notification', actorId: 'a1', targetUserId: 'u1', metadata: { itemId: 'x' } },
        { type: 'batch_notification', actorId: 'a2', targetUserId: 'u2', metadata: { itemId: 'y' } },
      ]);

      expect(setCalls).toHaveLength(2);
      expect(setCalls[0].data.type).toBe('batch_notification');
      expect(setCalls[0].data.actorId).toBe('a1');
      expect(setCalls[0].data.targetUserId).toBe('u1');
      expect(setCalls[0].data.seenAt).toBeUndefined();
    });

    it('chunks writes at ≤500 per commit', async () => {
      const { db, setCalls, commitCount } = createBatchTrackingDb();
      const h = createNotificationHelper(db, makeConfig());

      const inputs = Array.from({ length: 501 }, (_v, i) => ({
        type: 'batch_notification',
        actorId: `a${i}`,
        targetUserId: `u${i}`,
        metadata: { itemId: `item${i}` },
      }));

      await h.queueManyForBatch(inputs);

      expect(setCalls).toHaveLength(501);
      // 501 inputs → two commits (500 + 1).
      expect(commitCount()).toBe(2);
    });

    it('does nothing for an empty input array', async () => {
      const { db, setCalls, commitCount } = createBatchTrackingDb();
      const h = createNotificationHelper(db, makeConfig());

      await h.queueManyForBatch([]);

      expect(setCalls).toHaveLength(0);
      expect(commitCount()).toBe(0);
    });

    it('throws for an unknown notification type', async () => {
      const { db } = createBatchTrackingDb();
      const h = createNotificationHelper(db, makeConfig());

      await expect(
        h.queueManyForBatch([{ type: 'unknown', actorId: 'a1', metadata: {} }])
      ).rejects.toThrow('Unknown notification type: unknown');
    });
  });
});

describe('buildActiveNotificationDocId', () => {
  it('is deterministic for identical inputs', () => {
    const a = buildActiveNotificationDocId({ category: 'user', audienceType: 'personal', targetUserId: 'u1', dedupKey: 'k1' });
    const b = buildActiveNotificationDocId({ category: 'user', audienceType: 'personal', targetUserId: 'u1', dedupKey: 'k1' });
    expect(a).toBe(b);
    expect(a).toMatch(/^[0-9a-f]{40}$/);
  });

  it('scopes personal notifications per recipient', () => {
    const a = buildActiveNotificationDocId({ category: 'user', audienceType: 'personal', targetUserId: 'userA', dedupKey: 'k1' });
    const b = buildActiveNotificationDocId({ category: 'user', audienceType: 'personal', targetUserId: 'userB', dedupKey: 'k1' });
    expect(a).not.toBe(b);
  });

  it('ignores targetUserId for shared notifications', () => {
    const a = buildActiveNotificationDocId({ category: 'admin', audienceType: 'shared', targetUserId: 'adminA', dedupKey: 'k1' });
    const b = buildActiveNotificationDocId({ category: 'admin', audienceType: 'shared', targetUserId: 'adminB', dedupKey: 'k1' });
    expect(a).toBe(b);
  });

  it('separates categories and dedup keys', () => {
    const base = { audienceType: 'shared' as const, targetUserId: null, dedupKey: 'k1' };
    expect(buildActiveNotificationDocId({ ...base, category: 'admin' }))
      .not.toBe(buildActiveNotificationDocId({ ...base, category: 'user' }));
    expect(buildActiveNotificationDocId({ ...base, category: 'admin', dedupKey: 'k2' }))
      .not.toBe(buildActiveNotificationDocId({ ...base, category: 'admin' }));
  });
});

describe('createNotificationHelper — sendRealTime personal recipient scoping', () => {
  function makePersonalRealtimeConfig(): NotificationSystemConfig {
    return {
      categories: {
        user: {
          activePath: 'userNotifications',
          historyPath: (userId) => `userNotificationHistory/${userId}/items`,
          audienceType: 'personal',
        },
      },
      types: {
        admin_dispatch_reply: {
          category: 'user',
          delivery: 'realtime',
          dedupKeyPattern: (meta) => `adminDispatchReply_${meta.dispatchId}`,
          titlePattern: () => 'Reply',
          messagePattern: (_, count) => `${count} reply(ies)`,
          defaultTargetPath: '/dispatch',
        },
      },
      pendingCollectionPath: 'pendingNotifications',
    };
  }

  it('does not re-light another recipient\'s active doc with the same dedupKey', async () => {
    const mock = createMockFirestore();
    const helper = createNotificationHelper(mock.db, makePersonalRealtimeConfig());

    // user A already has an active doc for this dedup key.
    await helper.sendRealTime({
      type: 'admin_dispatch_reply',
      actorId: 'x',
      targetUserId: 'userA',
      metadata: { dispatchId: 'd1' },
    });

    // user B's notification for the same dispatch must not collapse into A's doc.
    await helper.sendRealTime({
      type: 'admin_dispatch_reply',
      actorId: 'actor1',
      targetUserId: 'userB',
      metadata: { dispatchId: 'd1' },
    });

    const docs = mock.collections.get('userNotifications')!;
    expect(docs.size).toBe(2);

    const idA = buildActiveNotificationDocId({
      category: 'user', audienceType: 'personal', targetUserId: 'userA', dedupKey: 'adminDispatchReply_d1',
    });
    const idB = buildActiveNotificationDocId({
      category: 'user', audienceType: 'personal', targetUserId: 'userB', dedupKey: 'adminDispatchReply_d1',
    });
    expect(docs.get(idA)!.count).toBe(1);
    expect(docs.get(idA)!.latestActorIds).toEqual(['x']);
    expect(docs.get(idB)!.count).toBe(1);
    expect(docs.get(idB)!.targetUserId).toBe('userB');
  });
});
