import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createNotificationHelper } from '../src/server/createNotificationHelper';
import type { NotificationSystemConfig } from '../src/types';
import type { ServerFirestore, ServerDocRef } from '../src/server/types';

// ---- Mock Firestore builder ----
// Collections are cached so the same collection object is returned on repeated calls.

function createMockFirestore() {
  const collections = new Map<string, Map<string, Record<string, unknown>>>();
  const collectionObjects = new Map<string, ReturnType<ServerFirestore['collection']>>();
  let autoId = 0;

  const getCol = (path: string) => {
    if (!collections.has(path)) collections.set(path, new Map());
    return collections.get(path)!;
  };

  const makeDocRef = (colPath: string, id: string): ServerDocRef => ({
    id,
    set: vi.fn(async () => {}),
    update: vi.fn(async (data: Record<string, unknown>) => {
      const col = getCol(colPath);
      const existing = col.get(id) ?? {};
      col.set(id, { ...existing, ...data });
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
  };

  return { db, collectionObjects };
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
  let collectionObjects: Map<string, any>;
  let helper: ReturnType<typeof createNotificationHelper>;

  beforeEach(() => {
    const mock = createMockFirestore();
    db = mock.db;
    collectionObjects = mock.collectionObjects;
    helper = createNotificationHelper(db, makeConfig());
  });

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
      const adminCol = collectionObjects.get('adminNotifications');
      expect(adminCol?.add).toHaveBeenCalledTimes(1);
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
    it('adds document to active collection when no existing doc', async () => {
      await helper.sendRealTime({
        type: 'content_report',
        actorId: 'user1',
        metadata: { itemId: 'abc' },
      });

      const adminCol = collectionObjects.get('adminNotifications');
      expect(adminCol).toBeDefined();
      expect(adminCol!.add).toHaveBeenCalledTimes(1);

      const docData = adminCol!.add.mock.calls[0][0];
      expect(docData.type).toBe('content_report');
      expect(docData.dedupKey).toBe('report_abc');
      expect(docData.count).toBe(1);
      expect(docData.latestActorIds).toEqual(['user1']);
      // Active docs are created unseen so the unread count() predicate matches.
      expect(docData.seenAt).toBe(0);
      // Identity is stored id-only — no persisted display names.
      expect(docData.latestActorNames).toBeUndefined();
    });

    it('creates notification with correct title and message', async () => {
      await helper.sendRealTime({
        type: 'content_report',
        actorId: 'user1',
        metadata: { itemId: 'abc' },
      });

      const adminCol = collectionObjects.get('adminNotifications');
      const docData = adminCol!.add.mock.calls[0][0];
      expect(docData.title).toBe('New Report');
      expect(docData.message).toBe('1 report(s)');
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

      const adminCol = collectionObjects.get('adminNotifications');
      const docData = adminCol!.add.mock.calls[0][0];
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
    const existingForA = {
      id: 'active_A',
      data: {
        dedupKey: 'adminDispatchReply_d1',
        category: 'user',
        targetUserId: 'userA',
        count: 1,
        latestActorIds: ['x'],
      },
    };
    const added: Record<string, unknown>[] = [];
    const updated: Record<string, unknown>[] = [];

    const db: ServerFirestore = {
      collection: vi.fn(() => {
        let cDedup = '';
        let cTarget: unknown;
        let targetFiltered = false;
        return {
          where: vi.fn(function (this: any, field: string, _op: string, val: unknown) {
            if (field === 'dedupKey') cDedup = val as string;
            if (field === 'targetUserId') {
              cTarget = val;
              targetFiltered = true;
            }
            return this;
          }),
          limit: vi.fn().mockReturnThis(),
          get: vi.fn(async () => {
            const dedupMatch = cDedup === existingForA.data.dedupKey;
            // Without a targetUserId filter, A's doc matches (real Firestore).
            const targetMatch = !targetFiltered || cTarget === existingForA.data.targetUserId;
            if (dedupMatch && targetMatch) {
              return {
                empty: false,
                size: 1,
                docs: [{
                  id: existingForA.id,
                  data: () => existingForA.data,
                  ref: { id: existingForA.id, update: vi.fn(async (d: Record<string, unknown>) => { updated.push(d); }) },
                }],
              };
            }
            return { empty: true, size: 0, docs: [] };
          }),
          add: vi.fn(async (data: Record<string, unknown>) => {
            added.push(data);
            return { id: 'new' };
          }),
          doc: vi.fn(),
        } as any;
      }),
      doc: vi.fn(),
      batch: vi.fn(),
    };

    const helper = createNotificationHelper(db, makePersonalRealtimeConfig());
    await helper.sendRealTime({
      type: 'admin_dispatch_reply',
      actorId: 'actor1',
      targetUserId: 'userB',
      metadata: { dispatchId: 'd1' },
    });

    // user B gets a fresh active doc; user A's doc is never touched.
    expect(added).toHaveLength(1);
    expect(added[0].targetUserId).toBe('userB');
    expect(updated).toHaveLength(0);
  });
});
