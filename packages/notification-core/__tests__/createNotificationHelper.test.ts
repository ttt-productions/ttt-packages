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
        actorName: 'Alice',
        metadata: { itemId: 'item123' },
      });
      const adminCol = collectionObjects.get('adminNotifications');
      expect(adminCol?.add).toHaveBeenCalledTimes(1);
    });

    it('routes queued delivery types to the pending collection', async () => {
      await helper.send({
        type: 'batch_notification',
        actorId: 'user1',
        actorName: 'Alice',
        metadata: { itemId: 'item123' },
      });
      const pendingCol = collectionObjects.get('pendingNotifications');
      expect(pendingCol?.add).toHaveBeenCalledTimes(1);
    });

    it('throws for unknown notification type', async () => {
      await expect(
        helper.send({ type: 'unknown_type', actorId: 'u1', actorName: 'Alice', metadata: {} })
      ).rejects.toThrow('Unknown notification type: unknown_type');
    });
  });

  describe('sendRealTime()', () => {
    it('adds document to active collection when no existing doc', async () => {
      await helper.sendRealTime({
        type: 'content_report',
        actorId: 'user1',
        actorName: 'Alice',
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
      expect(docData.latestActorNames).toEqual(['Alice']);
    });

    it('creates notification with correct title and message', async () => {
      await helper.sendRealTime({
        type: 'content_report',
        actorId: 'user1',
        actorName: 'Alice',
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
        badHelper.sendRealTime({ type: 'bad_type', actorId: 'u1', actorName: 'Alice', metadata: {} })
      ).rejects.toThrow('Unknown category: nonexistent');
    });

    it('sets targetUserId to null when not provided', async () => {
      await helper.sendRealTime({
        type: 'content_report',
        actorId: 'user1',
        actorName: 'Alice',
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
        actorName: 'Bob',
        targetUserId: 'user3',
        metadata: { itemId: 'xyz' },
      });

      const pendingCol = collectionObjects.get('pendingNotifications');
      expect(pendingCol).toBeDefined();
      expect(pendingCol!.add).toHaveBeenCalledTimes(1);

      const docData = pendingCol!.add.mock.calls[0][0];
      expect(docData.type).toBe('batch_notification');
      expect(docData.actorId).toBe('user2');
      expect(docData.actorName).toBe('Bob');
      expect(docData.targetUserId).toBe('user3');
    });

    it('sets targetUserId to null when not provided', async () => {
      await helper.queueForBatch({
        type: 'batch_notification',
        actorId: 'user2',
        actorName: 'Bob',
        metadata: { itemId: 'xyz' },
      });

      const pendingCol = collectionObjects.get('pendingNotifications');
      expect(pendingCol!.add.mock.calls[0][0].targetUserId).toBeNull();
    });

    it('throws for unknown type', async () => {
      await expect(
        helper.queueForBatch({ type: 'unknown', actorId: 'u1', actorName: 'Alice', metadata: {} })
      ).rejects.toThrow('Unknown notification type: unknown');
    });
  });
});
