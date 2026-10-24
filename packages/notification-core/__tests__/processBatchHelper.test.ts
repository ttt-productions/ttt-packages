import { describe, it, expect, vi } from 'vitest';
import { processBatchHelper } from '../src/server/processBatchHelper.js';
import { buildActiveNotificationDocId } from '../src/server/activeNotificationId.js';
import type { NotificationSystemConfig, PendingNotification } from '../src/types.js';
import type {
  ServerCollectionRef,
  ServerDocRef,
  ServerDocSnapshot,
  ServerFirestore,
  ServerQuery,
  ServerQuerySnapshot,
  ServerTransaction,
  ServerWriteBatch,
} from '@ttt-productions/firebase-helpers/server';

function makeConfig(): NotificationSystemConfig {
  return {
    categories: {
      admin: {
        activePath: 'adminNotifications',
        historyPath: () => 'adminNotificationHistory',
        audienceType: 'shared',
      },
    },
    types: {
      content_report: {
        category: 'admin',
        delivery: 'queued',
        dedupKeyPattern: (meta) => `report_${meta.itemId}`,
        titlePattern: () => 'New Report',
        messagePattern: (_, count) => `${count} report(s)`,
        defaultTargetPath: '/admin/reports',
      },
      linkless_note: {
        category: 'admin',
        delivery: 'queued',
        dedupKeyPattern: (meta) => `linkless_${meta.itemId}`,
        titlePattern: () => 'Linkless',
        messagePattern: () => 'linkless',
      },
    },
    pendingCollectionPath: 'pendingNotifications',
  };
}

interface BobDoc {
  id: string;
  data: PendingNotification;
}

interface SeedActiveDoc {
  category: string;
  audienceType: 'personal' | 'shared';
  targetUserId: string | null;
  dedupKey: string;
  data: Record<string, unknown>;
}

function createMockDb({
  pendingDocs = [],
  seedActiveDocs = [],
}: {
  pendingDocs?: BobDoc[];
  seedActiveDocs?: SeedActiveDoc[];
} = {}) {
  const collections = new Map<string, Map<string, Record<string, unknown>>>();
  const updatedDocs: Array<{ id: string; data: Record<string, unknown> }> = [];
  const createdIds: string[] = [];
  const batchDeletedIds: string[] = [];

  const getCol = (path: string) => {
    if (!collections.has(path)) collections.set(path, new Map());
    return collections.get(path)!;
  };

  for (const seed of seedActiveDocs) {
    const id = buildActiveNotificationDocId({
      category: seed.category,
      audienceType: seed.audienceType,
      targetUserId: seed.targetUserId,
      dedupKey: seed.dedupKey,
    });
    getCol(seed.category === 'user' ? 'userNotifications' : 'adminNotifications').set(id, {
      ...seed.data,
    });
  }

  const makeDocRef = (colPath: string, id: string): ServerDocRef => ({
    id,
    set: vi.fn(async (data: Record<string, unknown>) => {
      createdIds.push(id);
      getCol(colPath).set(id, { ...data });
    }),
    update: vi.fn(async (data: Record<string, unknown>) => {
      const col = getCol(colPath);
      updatedDocs.push({ id, data });
      col.set(id, { ...(col.get(id) ?? {}), ...data });
    }),
    create: vi.fn(async (data: Record<string, unknown>) => {
      if (getCol(colPath).has(id)) throw new Error(`document ${colPath}/${id} already exists`);
      createdIds.push(id);
      getCol(colPath).set(id, { ...data });
    }),
    delete: vi.fn(async () => {
      getCol(colPath).delete(id);
    }),
    get: vi.fn(async (): Promise<ServerDocSnapshot> => {
      const data = getCol(colPath).get(id);
      return { id, exists: !!data, data: () => data ?? undefined, ref: makeDocRef(colPath, id) };
    }),
  });

  const pendingSnapDocs: ServerDocSnapshot[] = pendingDocs.map((pd) => ({
    id: pd.id,
    exists: true,
    data: () => ({ ...pd.data }),
    ref: makeDocRef('pendingNotifications', pd.id),
  }));

  let pendingCallCount = 0;

  const db: ServerFirestore = {
    collection: vi.fn((colPath: string): ServerCollectionRef => {
      if (colPath === 'pendingNotifications') {
        const pendingQuery: ServerCollectionRef & ServerQuery = {
          where: () => pendingQuery,
          orderBy: () => pendingQuery,
          limit: () => pendingQuery,
          startAfter: () => pendingQuery,
          get: vi.fn(async (): Promise<ServerQuerySnapshot> => {
            if (pendingCallCount === 0) {
              pendingCallCount++;
              return {
                empty: pendingSnapDocs.length === 0,
                size: pendingSnapDocs.length,
                docs: pendingSnapDocs,
              };
            }
            return { empty: true, size: 0, docs: [] };
          }),
          add: vi.fn<ServerCollectionRef['add']>(),
          doc: vi.fn<ServerCollectionRef['doc']>(),
        };
        return pendingQuery;
      }

      return {
        doc: (id?: string) => makeDocRef(colPath, id ?? 'auto'),
        add: vi.fn<ServerCollectionRef['add']>(),
        where: vi.fn<ServerCollectionRef['where']>(),
        orderBy: vi.fn<ServerCollectionRef['orderBy']>(),
        limit: vi.fn<ServerCollectionRef['limit']>(),
      };
    }),
    batch: vi.fn(() => {
      const batch: ServerWriteBatch = {
        set: (ref, data, options) => {
          void ref.set(data, options);
          return batch;
        },
        update: (ref, data) => {
          void ref.update(data);
          return batch;
        },
        delete: vi.fn((ref: ServerDocRef) => {
          batchDeletedIds.push(ref.id);
          return batch;
        }),
        commit: vi.fn<ServerWriteBatch['commit']>().mockResolvedValue(undefined),
      };
      return batch;
    }),
    doc: vi.fn<ServerFirestore['doc']>(),
    runTransaction: async <T>(fn: (tx: ServerTransaction) => Promise<T>): Promise<T> => {
      function get(ref: ServerDocRef): Promise<ServerDocSnapshot>;
      function get(query: ServerQuery): Promise<ServerQuerySnapshot>;
      function get(target: ServerDocRef | ServerQuery) {
        return target.get();
      }
      const tx: ServerTransaction = {
        get,
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

  const activeDocs = (path: string) => Array.from(getCol(path).values());

  return { db, collections, activeDocs, updatedDocs, createdIds, batchDeletedIds };
}

function makePendingDoc(
  overrides: Partial<PendingNotification> & {
    type: string;
    actorId: string;
    metadata: Record<string, unknown>;
  },
): BobDoc {
  const id = `pending_${Math.random().toString(36).slice(2)}`;
  return {
    id,
    data: {
      id,
      category: 'admin',
      targetUserId: null,
      createdAt: Date.now() - 60_000,
      ...overrides,
    },
  };
}

describe('processBatchHelper', () => {
  it('returns totals of 0 when pending queue is empty', async () => {
    const { db } = createMockDb({ pendingDocs: [] });
    const result = await processBatchHelper(db, makeConfig());
    expect(result).toEqual({ totalProcessed: 0, notificationsCreated: 0, notificationsUpdated: 0 });
  });

  it('creates new active notification at its deterministic ID when none exists', async () => {
    const pending = makePendingDoc({
      type: 'content_report',
      actorId: 'user1',
      metadata: { itemId: 'item1' },
    });
    const { db, collections } = createMockDb({ pendingDocs: [pending] });

    const result = await processBatchHelper(db, makeConfig());

    expect(result.notificationsCreated).toBe(1);
    expect(result.notificationsUpdated).toBe(0);

    const expectedId = buildActiveNotificationDocId({
      category: 'admin',
      audienceType: 'shared',
      targetUserId: null,
      dedupKey: 'report_item1',
    });
    const doc = collections.get('adminNotifications')?.get(expectedId);
    expect(doc).toBeDefined();
    expect(doc!.type).toBe('content_report');
    expect(doc!.dedupKey).toBe('report_item1');
    expect(doc!.count).toBe(1);
    expect(doc!.latestActorIds).toEqual(['user1']);
    expect(doc!.seenAt).toBe(0);
    expect(doc!.latestActorNames).toBeUndefined();
  });

  it('omits targetPath entirely for a type with no defaultTargetPath (linkless)', async () => {
    const pending = makePendingDoc({
      type: 'linkless_note',
      actorId: 'user1',
      metadata: { itemId: 'item1' },
    });
    const { db, activeDocs } = createMockDb({ pendingDocs: [pending] });

    await processBatchHelper(db, makeConfig());

    const [doc] = activeDocs('adminNotifications');
    expect(doc).toBeDefined();
    expect(Object.keys(doc)).not.toContain('targetPath');
  });

  it('sets title and message on created notification', async () => {
    const pending = makePendingDoc({
      type: 'content_report',
      actorId: 'user1',
      metadata: { itemId: 'item1' },
    });
    const { db, activeDocs } = createMockDb({ pendingDocs: [pending] });

    await processBatchHelper(db, makeConfig());

    const [doc] = activeDocs('adminNotifications');
    expect(doc.title).toBe('New Report');
    expect(doc.message).toBe('1 report(s)');
  });

  it('increments existing notification count when dedup matches', async () => {
    const pending = makePendingDoc({
      type: 'content_report',
      actorId: 'user2',
      metadata: { itemId: 'item1' },
    });
    const { db, updatedDocs } = createMockDb({
      pendingDocs: [pending],
      seedActiveDocs: [
        {
          category: 'admin',
          audienceType: 'shared',
          targetUserId: null,
          dedupKey: 'report_item1',
          data: {
            dedupKey: 'report_item1',
            category: 'admin',
            count: 3,
            latestActorIds: ['user1'],
          },
        },
      ],
    });

    const result = await processBatchHelper(db, makeConfig());

    expect(result.notificationsUpdated).toBe(1);
    expect(result.notificationsCreated).toBe(0);
    expect(updatedDocs).toHaveLength(1);
    expect(updatedDocs[0].data.count).toBe(4);
    expect(updatedDocs[0].data.seenAt).toBe(0);
  });

  it('merges actor id lists (new first, deduped)', async () => {
    const pending = makePendingDoc({
      type: 'content_report',
      actorId: 'user2',
      metadata: { itemId: 'item1' },
    });
    const { db, updatedDocs } = createMockDb({
      pendingDocs: [pending],
      seedActiveDocs: [
        {
          category: 'admin',
          audienceType: 'shared',
          targetUserId: null,
          dedupKey: 'report_item1',
          data: {
            dedupKey: 'report_item1',
            category: 'admin',
            count: 1,
            latestActorIds: ['user1'],
          },
        },
      ],
    });

    await processBatchHelper(db, makeConfig());

    expect(updatedDocs[0].data.latestActorIds).toEqual(['user2', 'user1']);
    expect(updatedDocs[0].data.latestActorNames).toBeUndefined();
  });

  it('deduplicates actors that already exist in the list', async () => {
    const pending = makePendingDoc({
      type: 'content_report',
      actorId: 'user1',
      metadata: { itemId: 'item1' },
    });
    const { db, updatedDocs } = createMockDb({
      pendingDocs: [pending],
      seedActiveDocs: [
        {
          category: 'admin',
          audienceType: 'shared',
          targetUserId: null,
          dedupKey: 'report_item1',
          data: {
            dedupKey: 'report_item1',
            category: 'admin',
            count: 1,
            latestActorIds: ['user1'],
          },
        },
      ],
    });

    await processBatchHelper(db, makeConfig());

    expect(updatedDocs[0].data.latestActorIds).toEqual(['user1']);
  });

  it('caps count at countCap', async () => {
    const pending = makePendingDoc({
      type: 'content_report',
      actorId: 'user2',
      metadata: { itemId: 'item1' },
    });

    const config: NotificationSystemConfig = {
      ...makeConfig(),
      types: {
        content_report: {
          ...makeConfig().types.content_report,
          countCap: 5000,
        },
      },
    };

    const { db, updatedDocs } = createMockDb({
      pendingDocs: [pending],
      seedActiveDocs: [
        {
          category: 'admin',
          audienceType: 'shared',
          targetUserId: null,
          dedupKey: 'report_item1',
          data: {
            dedupKey: 'report_item1',
            category: 'admin',
            count: 4999,
            latestActorIds: ['user1'],
          },
        },
      ],
    });

    await processBatchHelper(db, config);

    expect(updatedDocs[0].data.count).toBe(5000);
  });

  it('deletes processed pending docs', async () => {
    const pending = makePendingDoc({
      type: 'content_report',
      actorId: 'user1',
      metadata: { itemId: 'item1' },
    });
    const { db, batchDeletedIds } = createMockDb({ pendingDocs: [pending] });

    await processBatchHelper(db, makeConfig());

    expect(batchDeletedIds).toContain(pending.id);
  });

  it('groups multiple pending notifications by dedupKey', async () => {
    const pending1 = makePendingDoc({
      type: 'content_report',
      actorId: 'user1',
      metadata: { itemId: 'item1' },
    });
    const pending2 = makePendingDoc({
      type: 'content_report',
      actorId: 'user2',
      metadata: { itemId: 'item1' },
    });
    const { db, activeDocs } = createMockDb({ pendingDocs: [pending1, pending2] });

    const result = await processBatchHelper(db, makeConfig());

    expect(result.notificationsCreated).toBe(1);
    const docs = activeDocs('adminNotifications');
    expect(docs).toHaveLength(1);
    expect(docs[0].count).toBe(2);
  });

  it('creates separate notifications for different dedupKeys', async () => {
    const pending1 = makePendingDoc({
      type: 'content_report',
      actorId: 'user1',
      metadata: { itemId: 'item1' },
    });
    const pending2 = makePendingDoc({
      type: 'content_report',
      actorId: 'user2',
      metadata: { itemId: 'item2' },
    });
    const { db, activeDocs } = createMockDb({ pendingDocs: [pending1, pending2] });

    const result = await processBatchHelper(db, makeConfig());

    expect(result.notificationsCreated).toBe(2);
    expect(activeDocs('adminNotifications')).toHaveLength(2);
  });

  it('tracks totalProcessed correctly', async () => {
    const pending1 = makePendingDoc({
      type: 'content_report',
      actorId: 'user1',
      metadata: { itemId: 'item1' },
    });
    const pending2 = makePendingDoc({
      type: 'content_report',
      actorId: 'user2',
      metadata: { itemId: 'item2' },
    });
    const { db } = createMockDb({ pendingDocs: [pending1, pending2] });

    const result = await processBatchHelper(db, makeConfig());

    expect(result.totalProcessed).toBe(2);
  });

  it('is idempotent-converged: re-processing the same group targets the SAME doc', async () => {
    const mkPending = () =>
      makePendingDoc({
        type: 'content_report',
        actorId: 'user1',
        metadata: { itemId: 'item1' },
      });

    const first = createMockDb({ pendingDocs: [mkPending()] });
    await processBatchHelper(first.db, makeConfig());
    expect(first.activeDocs('adminNotifications')).toHaveLength(1);

    const second = createMockDb({
      pendingDocs: [mkPending()],
      seedActiveDocs: [
        {
          category: 'admin',
          audienceType: 'shared',
          targetUserId: null,
          dedupKey: 'report_item1',
          data: first.activeDocs('adminNotifications')[0],
        },
      ],
    });
    const result = await processBatchHelper(second.db, makeConfig());

    expect(result.notificationsCreated).toBe(0);
    expect(result.notificationsUpdated).toBe(1);
    expect(second.activeDocs('adminNotifications')).toHaveLength(1);
  });
});

function makePersonalConfig(): NotificationSystemConfig {
  return {
    categories: {
      user: {
        activePath: 'userNotifications',
        historyPath: (userId) => `userNotificationHistory/${userId}/items`,
        audienceType: 'personal',
      },
    },
    types: {
      admin_announcement: {
        category: 'user',
        delivery: 'queued',
        dedupKeyPattern: (meta) => `announcement_${meta.title}`,
        titlePattern: (meta) => String(meta.title),
        messagePattern: (_, count) => `${count} update(s)`,
        defaultTargetPath: '/dashboard',
      },
    },
    pendingCollectionPath: 'pendingNotifications',
  };
}

function makePersonalPendingDoc(
  overrides: Partial<PendingNotification> & {
    type: string;
    actorId: string;
    targetUserId: string;
    metadata: Record<string, unknown>;
  },
): BobDoc {
  const id = `pending_${Math.random().toString(36).slice(2)}`;
  return {
    id,
    data: {
      id,
      category: 'user',
      createdAt: Date.now() - 60_000,
      ...overrides,
    },
  };
}

describe('processBatchHelper — personal recipient scoping', () => {
  it('materializes one active doc per recipient for a multi-recipient fan-out', async () => {
    const p1 = makePersonalPendingDoc({
      type: 'admin_announcement',
      actorId: 'admin',
      targetUserId: 'userA',
      metadata: { title: 'Launch' },
    });
    const p2 = makePersonalPendingDoc({
      type: 'admin_announcement',
      actorId: 'admin',
      targetUserId: 'userB',
      metadata: { title: 'Launch' },
    });
    const { db, activeDocs } = createMockDb({ pendingDocs: [p1, p2] });

    const result = await processBatchHelper(db, makePersonalConfig());

    expect(result.notificationsCreated).toBe(2);
    const docs = activeDocs('userNotifications');
    expect(docs).toHaveLength(2);
    const targets = docs.map((d) => d.targetUserId).sort();
    expect(targets).toEqual(['userA', 'userB']);
  });

  it("does not increment another recipient's active doc on a dedupKey match", async () => {
    const pendingForB = makePersonalPendingDoc({
      type: 'admin_announcement',
      actorId: 'admin',
      targetUserId: 'userB',
      metadata: { title: 'Launch' },
    });
    const { db, activeDocs, updatedDocs } = createMockDb({
      pendingDocs: [pendingForB],
      seedActiveDocs: [
        {
          category: 'user',
          audienceType: 'personal',
          targetUserId: 'userA',
          dedupKey: 'announcement_Launch',
          data: {
            dedupKey: 'announcement_Launch',
            category: 'user',
            targetUserId: 'userA',
            count: 1,
            latestActorIds: ['admin'],
          },
        },
      ],
    });

    const result = await processBatchHelper(db, makePersonalConfig());

    expect(result.notificationsCreated).toBe(1);
    expect(result.notificationsUpdated).toBe(0);
    expect(updatedDocs).toHaveLength(0);
    const docs = activeDocs('userNotifications');
    expect(docs).toHaveLength(2);
    const docForA = docs.find((d) => d.targetUserId === 'userA');
    expect(docForA!.count).toBe(1);
  });

  it('still dedups repeat notifications for the same recipient', async () => {
    const pendingForA = makePersonalPendingDoc({
      type: 'admin_announcement',
      actorId: 'admin2',
      targetUserId: 'userA',
      metadata: { title: 'Launch' },
    });
    const { db, activeDocs, updatedDocs } = createMockDb({
      pendingDocs: [pendingForA],
      seedActiveDocs: [
        {
          category: 'user',
          audienceType: 'personal',
          targetUserId: 'userA',
          dedupKey: 'announcement_Launch',
          data: {
            dedupKey: 'announcement_Launch',
            category: 'user',
            targetUserId: 'userA',
            count: 1,
            latestActorIds: ['admin'],
          },
        },
      ],
    });

    const result = await processBatchHelper(db, makePersonalConfig());

    expect(result.notificationsCreated).toBe(0);
    expect(result.notificationsUpdated).toBe(1);
    expect(activeDocs('userNotifications')).toHaveLength(1);
    expect(updatedDocs[0].data.count).toBe(2);
  });
});
