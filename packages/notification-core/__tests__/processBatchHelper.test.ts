import { describe, it, expect, vi } from 'vitest';
import { processBatchHelper } from '../src/server/processBatchHelper';
import { buildActiveNotificationDocId } from '../src/server/activeNotificationId';
import type { NotificationSystemConfig, PendingNotification } from '../src/types';
import type { ServerFirestore, ServerTransaction } from '../src/server/types';

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
      // No defaultTargetPath — a linkless, clear-only type; the doc must OMIT targetPath.
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

// ---- Mock DB builder ----
// In-memory collections so deterministic-ID transactional writes land somewhere
// inspectable. Active docs are seeded at their deterministic IDs (the helper
// under test computes the same ID via buildActiveNotificationDocId).

interface BobDoc {
  id: string;
  data: PendingNotification;
}

interface SeedActiveDoc {
  /** Inputs that determine the deterministic doc ID */
  category: string;
  audienceType: 'personal' | 'shared';
  targetUserId: string | null;
  dedupKey: string;
  /** Stored doc data */
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
    // Tests assume a single active collection per category config.
    getCol(seed.category === 'user' ? 'userNotifications' : 'adminNotifications').set(id, { ...seed.data });
  }

  const pendingSnapDocs = pendingDocs.map((pd) => ({
    id: pd.id,
    data: () => pd.data,
    ref: { id: pd.id },
  }));

  // Track pending query call count for iteration control
  let pendingCallCount = 0;

  const makeDocRef = (colPath: string, id: string) => ({
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
    delete: vi.fn(async () => { getCol(colPath).delete(id); }),
    get: vi.fn(async () => {
      const data = getCol(colPath).get(id);
      return { id, exists: !!data, data: () => data ?? undefined, ref: makeDocRef(colPath, id) };
    }),
  });

  const db: ServerFirestore = {
    collection: vi.fn((colPath: string) => {
      if (colPath === 'pendingNotifications') {
        return {
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
          add: vi.fn(),
          doc: vi.fn(),
        } as any;
      }

      return {
        doc: (id?: string) => makeDocRef(colPath, id ?? 'auto'),
        add: vi.fn(),
        where: vi.fn(),
      } as any;
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
    runTransaction: async <T,>(fn: (tx: ServerTransaction) => Promise<T>): Promise<T> => {
      const tx: ServerTransaction = {
        get: async (ref) => ref.get(),
        set: (ref, data, options) => { void ref.set(data, options); return tx; },
        update: (ref, data) => { void ref.update(data); return tx; },
        delete: (ref) => { void ref.delete(); return tx; },
      };
      return fn(tx);
    },
  };

  const activeDocs = (path: string) => Array.from(getCol(path).values());

  return { db, collections, activeDocs, updatedDocs, createdIds, batchDeletedIds };
}

// ---- Helpers ----

function makePendingDoc(overrides: Partial<PendingNotification> & { type: string; actorId: string; metadata: Record<string, unknown> }): BobDoc {
  const id = `pending_${Math.random().toString(36).slice(2)}`;
  return {
    id,
    data: {
      id,
      category: 'admin',
      targetUserId: null,
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
    // Active docs are created unseen so the unread count() predicate matches.
    expect(doc!.seenAt).toBe(0);
    // Identity is stored id-only — no persisted display names.
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
    // The KEY must be absent (a Firestore write with `undefined` throws), so the
    // consumer's `targetPath ?` check renders a clear-only row.
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
      seedActiveDocs: [{
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
      }],
    });

    const result = await processBatchHelper(db, makeConfig());

    expect(result.notificationsUpdated).toBe(1);
    expect(result.notificationsCreated).toBe(0);
    expect(updatedDocs).toHaveLength(1);
    expect(updatedDocs[0].data.count).toBe(4); // 3 + 1
    // Dedup-increment re-lights the unread badge.
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
      seedActiveDocs: [{
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
      }],
    });

    await processBatchHelper(db, makeConfig());

    // New actor (user2) should come first; identity is id-only.
    expect(updatedDocs[0].data.latestActorIds).toEqual(['user2', 'user1']);
    expect(updatedDocs[0].data.latestActorNames).toBeUndefined();
  });

  it('deduplicates actors that already exist in the list', async () => {
    const pending = makePendingDoc({
      type: 'content_report',
      actorId: 'user1', // same actor as in existing
      metadata: { itemId: 'item1' },
    });
    const { db, updatedDocs } = createMockDb({
      pendingDocs: [pending],
      seedActiveDocs: [{
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
      }],
    });

    await processBatchHelper(db, makeConfig());

    // user1 is already in the list — should not be duplicated
    expect(updatedDocs[0].data.latestActorIds).toEqual(['user1']);
  });

  it('caps count at countCap', async () => {
    const pending = makePendingDoc({
      type: 'content_report',
      actorId: 'user2',
      metadata: { itemId: 'item1' },
    });

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
      seedActiveDocs: [{
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
      }],
    });

    await processBatchHelper(db, config);

    expect(updatedDocs[0].data.count).toBe(5000); // capped
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
      metadata: { itemId: 'item1' }, // same dedupKey
    });
    const { db, activeDocs } = createMockDb({ pendingDocs: [pending1, pending2] });

    const result = await processBatchHelper(db, makeConfig());

    // Both should be grouped into one notification
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
      metadata: { itemId: 'item2' }, // different dedupKey
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
    // Two separate runs over equivalent pending docs (e.g. overlapping batch
    // runs reading the queue before deletion) must converge on one active doc
    // via the deterministic ID instead of creating duplicates.
    const mkPending = () => makePendingDoc({
      type: 'content_report',
      actorId: 'user1',
      metadata: { itemId: 'item1' },
    });

    const first = createMockDb({ pendingDocs: [mkPending()] });
    await processBatchHelper(first.db, makeConfig());
    expect(first.activeDocs('adminNotifications')).toHaveLength(1);

    // Second run with the surviving active doc seeded — same dedup scope.
    const second = createMockDb({
      pendingDocs: [mkPending()],
      seedActiveDocs: [{
        category: 'admin',
        audienceType: 'shared',
        targetUserId: null,
        dedupKey: 'report_item1',
        data: first.activeDocs('adminNotifications')[0],
      }],
    });
    const result = await processBatchHelper(second.db, makeConfig());

    expect(result.notificationsCreated).toBe(0);
    expect(result.notificationsUpdated).toBe(1);
    expect(second.activeDocs('adminNotifications')).toHaveLength(1);
  });
});

// ---- Personal (per-recipient) dedup scoping ----
// Regression coverage for the multi-recipient fan-out bug: personal
// notifications with identical type/metadata but different targetUserId must
// NOT collapse into a single recipient's active doc. With deterministic IDs the
// scoping is structural — the recipient is part of the ID hash.

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
        // Recipient-blind dedup key on purpose — the package must scope by
        // targetUserId itself, not rely on the app embedding the uid here.
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
      metadata: { title: 'Launch' }, // identical metadata → identical dedupKey
    });
    const { db, activeDocs } = createMockDb({ pendingDocs: [p1, p2] });

    const result = await processBatchHelper(db, makePersonalConfig());

    expect(result.notificationsCreated).toBe(2);
    const docs = activeDocs('userNotifications');
    expect(docs).toHaveLength(2);
    const targets = docs.map((d) => d.targetUserId).sort();
    expect(targets).toEqual(['userA', 'userB']);
  });

  it('does not increment another recipient\'s active doc on a dedupKey match', async () => {
    const pendingForB = makePersonalPendingDoc({
      type: 'admin_announcement',
      actorId: 'admin',
      targetUserId: 'userB',
      metadata: { title: 'Launch' },
    });
    const { db, activeDocs, updatedDocs } = createMockDb({
      pendingDocs: [pendingForB],
      seedActiveDocs: [{
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
      }],
    });

    const result = await processBatchHelper(db, makePersonalConfig());

    // B gets its own new doc; A's doc is untouched.
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
      seedActiveDocs: [{
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
      }],
    });

    const result = await processBatchHelper(db, makePersonalConfig());

    expect(result.notificationsCreated).toBe(0);
    expect(result.notificationsUpdated).toBe(1);
    expect(activeDocs('userNotifications')).toHaveLength(1);
    expect(updatedDocs[0].data.count).toBe(2);
  });
});
