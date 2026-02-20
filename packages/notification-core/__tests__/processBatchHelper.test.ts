import { describe, it, expect, vi } from 'vitest';
import { processBatchHelper } from '../src/server/processBatchHelper';
import type { NotificationSystemConfig, PendingNotification } from '../src/types';
import type { ServerFirestore } from '../src/server/types';

// ---- Config ----

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
    },
    pendingCollectionPath: 'pendingNotifications',
  };
}

// ---- Mock DB builder ----

interface BobDoc {
  id: string;
  data: PendingNotification;
}

interface ExistingActiveDoc {
  id: string;
  data: Record<string, unknown>;
}

function createMockDb({
  pendingDocs = [],
  existingActiveDocs = [],
}: {
  pendingDocs?: BobDoc[];
  existingActiveDocs?: ExistingActiveDoc[];
} = {}) {
  const addedDocs: Record<string, unknown>[] = [];
  const updatedDocs: Array<{ id: string; data: Record<string, unknown> }> = [];
  const batchDeletedIds: string[] = [];

  const pendingSnapDocs = pendingDocs.map((pd) => ({
    id: pd.id,
    data: () => pd.data,
    ref: { id: pd.id },
  }));

  // Build active doc lookup by dedupKey
  const activeByDedupKey = new Map<string, ExistingActiveDoc>();
  for (const ad of existingActiveDocs) {
    const dedupKey = (ad.data.dedupKey as string) ?? '';
    activeByDedupKey.set(dedupKey, ad);
  }

  // Track pending query call count for iteration control
  let pendingCallCount = 0;

  const db: ServerFirestore = {
    collection: vi.fn((colPath: string) => {
      if (colPath === 'pendingNotifications') {
        const pendingQuery = {
          where: vi.fn().mockReturnThis(),
          orderBy: vi.fn().mockReturnThis(),
          limit: vi.fn().mockReturnThis(),
          get: vi.fn(async () => {
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
          add: vi.fn(async (data: Record<string, unknown>) => {
            addedDocs.push(data);
            return { id: 'new_doc' };
          }),
          doc: vi.fn(),
        };
        return pendingQuery as any;
      }

      // Active collection — supports where().where().limit().get() and .add()
      let capturedDedupKey = '';
      const activeQuery = {
        where: vi.fn(function (this: any, field: string, _op: string, val: unknown) {
          if (field === 'dedupKey') capturedDedupKey = val as string;
          return this;
        }),
        limit: vi.fn().mockReturnThis(),
        get: vi.fn(async () => {
          const existing = activeByDedupKey.get(capturedDedupKey);
          if (existing) {
            const updateFn = vi.fn(async (data: Record<string, unknown>) => {
              updatedDocs.push({ id: existing.id, data });
            });
            return {
              empty: false,
              size: 1,
              docs: [{ id: existing.id, data: () => existing.data, ref: { id: existing.id, update: updateFn } }],
            };
          }
          return { empty: true, size: 0, docs: [] };
        }),
        add: vi.fn(async (data: Record<string, unknown>) => {
          addedDocs.push(data);
          return { id: 'new_doc' };
        }),
        doc: vi.fn(),
        orderBy: vi.fn().mockReturnThis(),
      };
      return activeQuery as any;
    }),
    batch: vi.fn(() => {
      const batch = {
        delete: vi.fn((ref: any) => {
          batchDeletedIds.push(ref.id);
          return batch;
        }),
        commit: vi.fn().mockResolvedValue(undefined),
      };
      return batch as any;
    }),
    doc: vi.fn(),
  };

  return { db, addedDocs, updatedDocs, batchDeletedIds };
}

// ---- Helpers ----

function makePendingDoc(overrides: Partial<PendingNotification> & { type: string; actorId: string; actorName: string; metadata: Record<string, unknown> }): BobDoc {
  const id = `pending_${Math.random().toString(36).slice(2)}`;
  return {
    id,
    data: {
      id,
      type: overrides.type,
      category: 'admin',
      targetUserId: null,
      actorId: overrides.actorId,
      actorName: overrides.actorName,
      metadata: overrides.metadata,
      createdAt: Date.now() - 60_000, // 1 minute ago (past cutoff)
      ...overrides,
    },
  };
}

// ---- Tests ----

describe('processBatchHelper', () => {
  it('returns totals of 0 when pending queue is empty', async () => {
    const { db } = createMockDb({ pendingDocs: [] });
    const result = await processBatchHelper(db, makeConfig());
    expect(result).toEqual({ totalProcessed: 0, notificationsCreated: 0, notificationsUpdated: 0 });
  });

  it('creates new active notification when no existing dedup match', async () => {
    const pending = makePendingDoc({
      type: 'content_report',
      actorId: 'user1',
      actorName: 'Alice',
      metadata: { itemId: 'item1' },
    });
    const { db, addedDocs } = createMockDb({ pendingDocs: [pending] });

    const result = await processBatchHelper(db, makeConfig());

    expect(result.notificationsCreated).toBe(1);
    expect(result.notificationsUpdated).toBe(0);
    expect(addedDocs).toHaveLength(1);
    const doc = addedDocs[0];
    expect(doc.type).toBe('content_report');
    expect(doc.dedupKey).toBe('report_item1');
    expect(doc.count).toBe(1);
    expect(doc.latestActorIds).toEqual(['user1']);
    expect(doc.latestActorNames).toEqual(['Alice']);
  });

  it('sets title and message on created notification', async () => {
    const pending = makePendingDoc({
      type: 'content_report',
      actorId: 'user1',
      actorName: 'Alice',
      metadata: { itemId: 'item1' },
    });
    const { db, addedDocs } = createMockDb({ pendingDocs: [pending] });

    await processBatchHelper(db, makeConfig());

    expect(addedDocs[0].title).toBe('New Report');
    expect(addedDocs[0].message).toBe('1 report(s)');
  });

  it('increments existing notification count when dedup matches', async () => {
    const pending = makePendingDoc({
      type: 'content_report',
      actorId: 'user2',
      actorName: 'Bob',
      metadata: { itemId: 'item1' },
    });
    const existingDoc: ExistingActiveDoc = {
      id: 'active_1',
      data: {
        dedupKey: 'report_item1',
        category: 'admin',
        count: 3,
        latestActorIds: ['user1'],
        latestActorNames: ['Alice'],
      },
    };
    const { db, updatedDocs } = createMockDb({
      pendingDocs: [pending],
      existingActiveDocs: [existingDoc],
    });

    const result = await processBatchHelper(db, makeConfig());

    expect(result.notificationsUpdated).toBe(1);
    expect(result.notificationsCreated).toBe(0);
    expect(updatedDocs).toHaveLength(1);
    expect(updatedDocs[0].data.count).toBe(4); // 3 + 1
  });

  it('merges actor lists (new first, deduped)', async () => {
    const pending = makePendingDoc({
      type: 'content_report',
      actorId: 'user2',
      actorName: 'Bob',
      metadata: { itemId: 'item1' },
    });
    const existingDoc: ExistingActiveDoc = {
      id: 'active_1',
      data: {
        dedupKey: 'report_item1',
        category: 'admin',
        count: 1,
        latestActorIds: ['user1'],
        latestActorNames: ['Alice'],
      },
    };
    const { db, updatedDocs } = createMockDb({
      pendingDocs: [pending],
      existingActiveDocs: [existingDoc],
    });

    await processBatchHelper(db, makeConfig());

    // New actor (user2) should come first
    expect(updatedDocs[0].data.latestActorIds).toEqual(['user2', 'user1']);
    expect(updatedDocs[0].data.latestActorNames).toEqual(['Bob', 'Alice']);
  });

  it('deduplicates actors that already exist in the list', async () => {
    const pending = makePendingDoc({
      type: 'content_report',
      actorId: 'user1', // same actor as in existing
      actorName: 'Alice',
      metadata: { itemId: 'item1' },
    });
    const existingDoc: ExistingActiveDoc = {
      id: 'active_1',
      data: {
        dedupKey: 'report_item1',
        category: 'admin',
        count: 1,
        latestActorIds: ['user1'],
        latestActorNames: ['Alice'],
      },
    };
    const { db, updatedDocs } = createMockDb({
      pendingDocs: [pending],
      existingActiveDocs: [existingDoc],
    });

    await processBatchHelper(db, makeConfig());

    // user1 is already in the list — should not be duplicated
    expect(updatedDocs[0].data.latestActorIds).toEqual(['user1']);
  });

  it('caps count at countCap', async () => {
    const pending = makePendingDoc({
      type: 'content_report',
      actorId: 'user2',
      actorName: 'Bob',
      metadata: { itemId: 'item1' },
    });
    const existingDoc: ExistingActiveDoc = {
      id: 'active_1',
      data: {
        dedupKey: 'report_item1',
        category: 'admin',
        count: 4999,
        latestActorIds: ['user1'],
        latestActorNames: ['Alice'],
      },
    };

    // Use a config with low countCap
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
      existingActiveDocs: [existingDoc],
    });

    await processBatchHelper(db, config);

    expect(updatedDocs[0].data.count).toBe(5000); // capped
  });

  it('deletes processed pending docs', async () => {
    const pending = makePendingDoc({
      type: 'content_report',
      actorId: 'user1',
      actorName: 'Alice',
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
      actorName: 'Alice',
      metadata: { itemId: 'item1' },
    });
    const pending2 = makePendingDoc({
      type: 'content_report',
      actorId: 'user2',
      actorName: 'Bob',
      metadata: { itemId: 'item1' }, // same dedupKey
    });
    const { db, addedDocs } = createMockDb({ pendingDocs: [pending1, pending2] });

    const result = await processBatchHelper(db, makeConfig());

    // Both should be grouped into one notification
    expect(result.notificationsCreated).toBe(1);
    expect(addedDocs).toHaveLength(1);
    expect((addedDocs[0] as any).count).toBe(2);
  });

  it('creates separate notifications for different dedupKeys', async () => {
    const pending1 = makePendingDoc({
      type: 'content_report',
      actorId: 'user1',
      actorName: 'Alice',
      metadata: { itemId: 'item1' },
    });
    const pending2 = makePendingDoc({
      type: 'content_report',
      actorId: 'user2',
      actorName: 'Bob',
      metadata: { itemId: 'item2' }, // different dedupKey
    });
    const { db, addedDocs } = createMockDb({ pendingDocs: [pending1, pending2] });

    const result = await processBatchHelper(db, makeConfig());

    expect(result.notificationsCreated).toBe(2);
    expect(addedDocs).toHaveLength(2);
  });

  it('tracks totalProcessed correctly', async () => {
    const pending1 = makePendingDoc({
      type: 'content_report',
      actorId: 'user1',
      actorName: 'Alice',
      metadata: { itemId: 'item1' },
    });
    const pending2 = makePendingDoc({
      type: 'content_report',
      actorId: 'user2',
      actorName: 'Bob',
      metadata: { itemId: 'item2' },
    });
    const { db } = createMockDb({ pendingDocs: [pending1, pending2] });

    const result = await processBatchHelper(db, makeConfig());

    expect(result.totalProcessed).toBe(2);
  });
});
