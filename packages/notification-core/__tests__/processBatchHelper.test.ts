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

  it('creates new active notification when no existing dedup match', async () => {
    const pending = makePendingDoc({
      type: 'content_report',
      actorId: 'user1',
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
    // Active docs are created unseen so the unread count() predicate matches.
    expect(doc.seenAt).toBe(0);
    // Identity is stored id-only — no persisted display names.
    expect(doc.latestActorNames).toBeUndefined();
  });

  it('sets title and message on created notification', async () => {
    const pending = makePendingDoc({
      type: 'content_report',
      actorId: 'user1',
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
      metadata: { itemId: 'item1' },
    });
    const existingDoc: ExistingActiveDoc = {
      id: 'active_1',
      data: {
        dedupKey: 'report_item1',
        category: 'admin',
        count: 3,
        latestActorIds: ['user1'],
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
    // Dedup-increment re-lights the unread badge.
    expect(updatedDocs[0].data.seenAt).toBe(0);
  });

  it('merges actor id lists (new first, deduped)', async () => {
    const pending = makePendingDoc({
      type: 'content_report',
      actorId: 'user2',
      metadata: { itemId: 'item1' },
    });
    const existingDoc: ExistingActiveDoc = {
      id: 'active_1',
      data: {
        dedupKey: 'report_item1',
        category: 'admin',
        count: 1,
        latestActorIds: ['user1'],
      },
    };
    const { db, updatedDocs } = createMockDb({
      pendingDocs: [pending],
      existingActiveDocs: [existingDoc],
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
    const existingDoc: ExistingActiveDoc = {
      id: 'active_1',
      data: {
        dedupKey: 'report_item1',
        category: 'admin',
        count: 1,
        latestActorIds: ['user1'],
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
      metadata: { itemId: 'item1' },
    });
    const existingDoc: ExistingActiveDoc = {
      id: 'active_1',
      data: {
        dedupKey: 'report_item1',
        category: 'admin',
        count: 4999,
        latestActorIds: ['user1'],
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
      metadata: { itemId: 'item1' },
    });
    const pending2 = makePendingDoc({
      type: 'content_report',
      actorId: 'user2',
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
});

// ---- Personal (per-recipient) dedup scoping ----
// Regression coverage for the multi-recipient fan-out bug: personal
// notifications with identical type/metadata but different targetUserId must
// NOT collapse into a single recipient's active doc.

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

/**
 * Active-collection mock that models real Firestore equality semantics: a
 * lookup with only (dedupKey, category) matches any recipient's doc, while
 * adding a (targetUserId ==) filter restricts to that recipient. This is what
 * lets the pre-fix code (no targetUserId filter) fail these tests.
 */
function createPersonalMockDb({
  pendingDocs = [],
  existingActiveDocs = [],
}: {
  pendingDocs?: BobDoc[];
  existingActiveDocs?: ExistingActiveDoc[];
} = {}) {
  const addedDocs: Record<string, unknown>[] = [];
  const updatedDocs: Array<{ id: string; data: Record<string, unknown> }> = [];

  const pendingSnapDocs = pendingDocs.map((pd) => ({
    id: pd.id,
    data: () => pd.data,
    ref: { id: pd.id },
  }));

  let pendingCallCount = 0;

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

      let cDedup = '';
      let cCategory = '';
      let cTarget: unknown;
      let targetFiltered = false;
      const activeQuery = {
        where: vi.fn(function (this: any, field: string, _op: string, val: unknown) {
          if (field === 'dedupKey') cDedup = val as string;
          if (field === 'category') cCategory = val as string;
          if (field === 'targetUserId') {
            cTarget = val;
            targetFiltered = true;
          }
          return this;
        }),
        limit: vi.fn().mockReturnThis(),
        orderBy: vi.fn().mockReturnThis(),
        get: vi.fn(async () => {
          const match = existingActiveDocs.find((ad) => {
            if (ad.data.dedupKey !== cDedup) return false;
            if (ad.data.category !== cCategory) return false;
            // Without a targetUserId filter, any recipient's doc matches.
            if (targetFiltered && ad.data.targetUserId !== cTarget) return false;
            return true;
          });
          if (match) {
            const updateFn = vi.fn(async (data: Record<string, unknown>) => {
              updatedDocs.push({ id: match.id, data });
            });
            return {
              empty: false,
              size: 1,
              docs: [{ id: match.id, data: () => match.data, ref: { id: match.id, update: updateFn } }],
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
      return activeQuery as any;
    }),
    batch: vi.fn(() => {
      const batch = {
        delete: vi.fn(() => batch),
        commit: vi.fn().mockResolvedValue(undefined),
      };
      return batch as any;
    }),
    doc: vi.fn(),
  };

  return { db, addedDocs, updatedDocs };
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
    const { db, addedDocs } = createPersonalMockDb({ pendingDocs: [p1, p2] });

    const result = await processBatchHelper(db, makePersonalConfig());

    expect(result.notificationsCreated).toBe(2);
    expect(addedDocs).toHaveLength(2);
    const targets = addedDocs.map((d) => d.targetUserId).sort();
    expect(targets).toEqual(['userA', 'userB']);
  });

  it('does not increment another recipient\'s active doc on a dedupKey match', async () => {
    const existingForA: ExistingActiveDoc = {
      id: 'active_A',
      data: {
        dedupKey: 'announcement_Launch',
        category: 'user',
        targetUserId: 'userA',
        count: 1,
        latestActorIds: ['admin'],
      },
    };
    const pendingForB = makePersonalPendingDoc({
      type: 'admin_announcement',
      actorId: 'admin',
      targetUserId: 'userB',
      metadata: { title: 'Launch' },
    });
    const { db, addedDocs, updatedDocs } = createPersonalMockDb({
      pendingDocs: [pendingForB],
      existingActiveDocs: [existingForA],
    });

    const result = await processBatchHelper(db, makePersonalConfig());

    // B gets its own new doc; A's doc is untouched.
    expect(result.notificationsCreated).toBe(1);
    expect(result.notificationsUpdated).toBe(0);
    expect(addedDocs).toHaveLength(1);
    expect(addedDocs[0].targetUserId).toBe('userB');
    expect(updatedDocs).toHaveLength(0);
  });

  it('still dedups repeat notifications for the same recipient', async () => {
    const existingForA: ExistingActiveDoc = {
      id: 'active_A',
      data: {
        dedupKey: 'announcement_Launch',
        category: 'user',
        targetUserId: 'userA',
        count: 1,
        latestActorIds: ['admin'],
      },
    };
    const pendingForA = makePersonalPendingDoc({
      type: 'admin_announcement',
      actorId: 'admin2',
      targetUserId: 'userA',
      metadata: { title: 'Launch' },
    });
    const { db, addedDocs, updatedDocs } = createPersonalMockDb({
      pendingDocs: [pendingForA],
      existingActiveDocs: [existingForA],
    });

    const result = await processBatchHelper(db, makePersonalConfig());

    expect(result.notificationsCreated).toBe(0);
    expect(result.notificationsUpdated).toBe(1);
    expect(addedDocs).toHaveLength(0);
    expect(updatedDocs[0].data.count).toBe(2);
  });
});
