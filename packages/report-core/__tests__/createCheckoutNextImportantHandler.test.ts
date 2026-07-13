import { describe, it, expect, vi } from 'vitest';
import { createCheckoutNextImportantHandler } from '../src/server/createCheckoutNextImportantHandler';
import type { ServerReportCoreConfig } from '../src/server/types';

const TEST_CONFIG: ServerReportCoreConfig = {
  collections: {
    reports: 'contentReports',
    reportGroups: 'activeReportGroups',
    adminTasks: 'adminTasks',
  },
  taskQueues: {
    userReport: { defaultCheckoutMinutes: 60, workLaterMinutes: 120, maxWorkLaterMinutes: 480 },
  },
  priorityConfig: {
    reasonScores: { spam: 5 },
    itemTypeMultipliers: { post: 1.0 },
    additionalReportBonus: 2,
    defaultReasonScore: 3,
    defaultItemTypeMultiplier: 1.0,
  },
};

type DocData = Record<string, unknown>;
type Store = Map<string, DocData>;

function getByPath(data: DocData, dotted: string): unknown {
  return dotted
    .split('.')
    .reduce<unknown>((acc, k) => (acc as DocData | undefined)?.[k], data);
}

interface MockDbOptions {
  docs?: Record<string, DocData>;
  /** Runs before a query computes its results — lets a test restore state each round. */
  beforeQuery?: (store: Store) => void;
  /** Runs AFTER a query computed its results but before they are returned — lets a test
   *  simulate another admin claiming the candidate in the query→claim race window. */
  afterQuery?: (store: Store) => void;
}

/**
 * Live-store mock: queries filter/sort the CURRENT store (outside any transaction),
 * transactions read/write specific docs. Two invariants of the checkout fix are
 * enforced structurally:
 *   - a range query inside the transaction THROWS (the range-lock contention bug —
 *     candidate discovery must run outside; doc-level claims only), and
 *   - all transactional reads must precede writes (real Firestore throws otherwise).
 */
function createMockDb(opts: MockDbOptions = {}) {
  let autoId = 0;
  const store: Store = new Map(Object.entries(opts.docs ?? {}));
  const updates: Array<{ path: string; data: DocData }> = [];
  const sets: Array<{ path: string; data: DocData }> = [];
  let queryCount = 0;
  let hasWritten = false;

  const makeRef = (path: string) => ({ id: path.split('/').pop()!, _path: path });

  interface Clause {
    field: string;
    op: string;
    value: unknown;
  }
  interface Order {
    field: string;
    dir: 'asc' | 'desc';
  }

  const makeQuery = (colPath: string, clauses: Clause[], orders: Order[], lim?: number) => {
    const query = {
      _isQuery: true,
      where: (field: string, op: string, value: unknown) =>
        makeQuery(colPath, [...clauses, { field, op, value }], orders, lim),
      orderBy: (field: string, direction: 'asc' | 'desc' = 'asc') =>
        makeQuery(colPath, clauses, [...orders, { field, dir: direction }], lim),
      limit: (n: number) => makeQuery(colPath, clauses, orders, n),
      get: async () => {
        opts.beforeQuery?.(store);
        queryCount++;
        const prefix = `${colPath}/`;
        let rows = [...store.entries()]
          .filter(([p]) => p.startsWith(prefix) && !p.slice(prefix.length).includes('/'))
          .map(([p, d]) => ({ path: p, data: d }));
        for (const c of clauses) {
          rows = rows.filter((r) => {
            const v = getByPath(r.data, c.field);
            if (c.op === '==') return v === c.value;
            if (c.op === '<') return typeof v === 'number' && v < (c.value as number);
            return true;
          });
        }
        rows.sort((a, b) => {
          for (const o of orders) {
            const av = getByPath(a.data, o.field) as number | string;
            const bv = getByPath(b.data, o.field) as number | string;
            if (av === bv) continue;
            const cmp = av < bv ? -1 : 1;
            return o.dir === 'desc' ? -cmp : cmp;
          }
          return 0;
        });
        if (lim !== undefined) rows = rows.slice(0, lim);
        const docs = rows.map((r) => ({
          id: r.path.split('/').pop()!,
          exists: true,
          data: () => store.get(r.path),
          ref: makeRef(r.path),
        }));
        opts.afterQuery?.(store);
        return { empty: docs.length === 0, size: docs.length, docs };
      },
    };
    return query;
  };

  const transaction = {
    get: vi.fn(async (refOrQuery: any) => {
      if (refOrQuery._isQuery) {
        throw new Error(
          'Range query inside a transaction — candidate discovery must run OUTSIDE the transaction (doc-level claims only).',
        );
      }
      if (hasWritten) {
        throw new Error(
          'Firestore transactions require all reads to be executed before all writes.',
        );
      }
      const data = store.get(refOrQuery._path);
      return {
        exists: !!data,
        data: () => data,
        id: refOrQuery.id,
        ref: refOrQuery,
      };
    }),
    set: vi.fn((ref: any, data: DocData) => {
      hasWritten = true;
      sets.push({ path: ref._path, data });
      store.set(ref._path, data);
      return transaction;
    }),
    update: vi.fn((ref: any, data: DocData) => {
      hasWritten = true;
      updates.push({ path: ref._path, data });
      store.set(ref._path, { ...(store.get(ref._path) ?? {}), ...data });
      return transaction;
    }),
  };

  const db = {
    collection: vi.fn((colPath: string) => ({
      ...makeQuery(colPath, [], []),
      doc: vi.fn((id?: string) => makeRef(`${colPath}/${id ?? `auto_${++autoId}`}`)),
    })),
    doc: vi.fn((path: string) => makeRef(path)),
    runTransaction: vi.fn(async (fn: any) => {
      hasWritten = false;
      return fn(transaction);
    }),
  } as any;

  return { db, transaction, store, sets, updates, queryCount: () => queryCount };
}

const pendingTask = (taskId: string, priority: number, createdAt = 1): DocData => ({
  taskType: 'userReport',
  taskId,
  originalPath: `activeReportGroups/${taskId}`,
  summary: 'test',
  priority,
  createdAt,
  status: 'pending',
  checkoutDetails: null,
});

describe('createCheckoutNextImportantHandler', () => {
  it('factory returns a function', () => {
    const handler = createCheckoutNextImportantHandler({
      config: TEST_CONFIG,
      db: {} as any,
      auth: { adminUserIds: ['admin1'] },
    });
    expect(typeof handler).toBe('function');
  });

  it('rejects non-admin users', async () => {
    const { db } = createMockDb();
    const handler = createCheckoutNextImportantHandler({
      config: TEST_CONFIG,
      db,
      auth: { adminUserIds: ['admin1'] },
    });

    await expect(
      handler({}, { uid: 'random-user', token: null }),
    ).rejects.toThrow('Administrator access required');
  });

  it('throws "No pending tasks available!" when queue empty', async () => {
    const { db } = createMockDb();
    const handler = createCheckoutNextImportantHandler({
      config: TEST_CONFIG,
      db,
      auth: { adminUserIds: ['admin1'] },
    });

    await expect(handler({}, { uid: 'admin1', token: null })).rejects.toThrow(
      'No pending tasks available',
    );
  });

  it('returns task data on success', async () => {
    const { db } = createMockDb({
      docs: {
        'adminTasks/task1': { ...pendingTask('group1', 10), summary: '1 report for post' },
        'activeReportGroups/group1': { reportedItemType: 'post' },
      },
    });
    const handler = createCheckoutNextImportantHandler({
      config: TEST_CONFIG,
      db,
      auth: { adminUserIds: ['admin1'] },
    });

    const result = await handler({}, { uid: 'admin1', token: null });

    expect(result.success).toBe(true);
    expect(result.task).toBeDefined();
    expect((result.task as any).id).toBe('task1');
    expect((result.task as any).status).toBe('checkedOut');
    expect((result.task as any).itemData).toEqual({ reportedItemType: 'post' });
  });

  it('picks the highest-priority pending task', async () => {
    const { db } = createMockDb({
      docs: {
        'adminTasks/low': pendingTask('groupLow', 2),
        'adminTasks/high': pendingTask('groupHigh', 42),
      },
    });
    const handler = createCheckoutNextImportantHandler({
      config: TEST_CONFIG,
      db,
      auth: { adminUserIds: ['admin1'] },
    });

    const result = await handler({}, { uid: 'admin1', token: null });
    expect((result.task as any).id).toBe('high');
  });

  it('sets status=checkedOut with checkoutDetails on the task', async () => {
    const { db, updates } = createMockDb({
      docs: { 'adminTasks/task1': pendingTask('group1', 10) },
    });
    const handler = createCheckoutNextImportantHandler({
      config: TEST_CONFIG,
      db,
      auth: { adminUserIds: ['admin1'] },
    });

    await handler({}, { uid: 'admin1', token: null });

    expect(updates).toHaveLength(1);
    expect(updates[0].path).toBe('adminTasks/task1');
    expect(updates[0].data.status).toBe('checkedOut');
    expect(updates[0].data.checkoutDetails).toBeDefined();
    expect((updates[0].data.checkoutDetails as any).userId).toBe('admin1');
  });

  it('audits "checkout_next_important" with priority and writes no activity-log doc', async () => {
    const { db, sets } = createMockDb({
      docs: { 'adminTasks/task1': pendingTask('group1', 42) },
    });
    const onAuditEvent = vi.fn();
    const handler = createCheckoutNextImportantHandler({
      config: TEST_CONFIG,
      db,
      auth: { adminUserIds: ['admin1'] },
      onAuditEvent,
    });

    await handler({}, { uid: 'admin1', token: null });

    expect(sets).toHaveLength(0);
    expect(onAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'checkout_next_important', priority: 42 }),
      expect.anything(),
    );
  });

  it('uses adminUserIds fallback for admin verification', async () => {
    const { db } = createMockDb({
      docs: { 'adminTasks/task1': pendingTask('group1', 10) },
    });
    const handler = createCheckoutNextImportantHandler({
      config: TEST_CONFIG,
      db,
      auth: { adminUserIds: ['admin1', 'admin2'] },
    });

    // Should succeed for admin2
    const result = await handler({}, { uid: 'admin2', token: null });
    expect(result.success).toBe(true);
  });

  it('uses requireAdmin when provided', async () => {
    const { db } = createMockDb();
    const requireAdmin = vi.fn().mockResolvedValue(undefined);
    const handler = createCheckoutNextImportantHandler({
      config: TEST_CONFIG,
      db,
      auth: { requireAdmin },
    });

    // Should call requireAdmin and proceed (throw because no tasks)
    await expect(handler({}, { uid: 'anyone', token: 'tok' })).rejects.toThrow(
      'No pending tasks available',
    );
    expect(requireAdmin).toHaveBeenCalledWith('anyone', 'tok');
  });

  it('calculates expiresAt from checkout duration config', async () => {
    const { db, updates } = createMockDb({
      docs: { 'adminTasks/task1': pendingTask('group1', 10) },
    });
    const handler = createCheckoutNextImportantHandler({
      config: TEST_CONFIG,
      db,
      auth: { adminUserIds: ['admin1'] },
    });

    const before = Date.now();
    await handler({}, { uid: 'admin1', token: null });
    const after = Date.now();

    const checkoutDetails = updates[0].data.checkoutDetails as any;
    const expectedMinExpiry = before + 60 * 60_000; // 60 minutes
    const expectedMaxExpiry = after + 60 * 60_000;
    expect(checkoutDetails.expiresAt).toBeGreaterThanOrEqual(expectedMinExpiry);
    expect(checkoutDetails.expiresAt).toBeLessThanOrEqual(expectedMaxExpiry);
  });

  it('invokes onAuditEvent inside the transaction with the correct payload', async () => {
    const { db, transaction } = createMockDb({
      docs: { 'adminTasks/task1': pendingTask('group1', 42) },
    });
    const onAuditEvent = vi.fn();
    const handler = createCheckoutNextImportantHandler({
      config: TEST_CONFIG,
      db,
      auth: { adminUserIds: ['admin1'] },
      onAuditEvent,
    });

    await handler({}, { uid: 'admin1', token: null });

    expect(onAuditEvent).toHaveBeenCalledTimes(1);
    expect(onAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'checkout_next_important',
        adminUserId: 'admin1',
        taskType: 'userReport',
        taskId: 'group1',
        priority: 42,
      }),
      transaction,
    );
  });

  it('reads originalDoc BEFORE any writes (Firestore transaction ordering)', async () => {
    const { db } = createMockDb({
      docs: {
        'adminTasks/task-1': {
          ...pendingTask('report-group-1', 5),
          originalPath: 'activeReportGroups/report-group-1',
        },
        'activeReportGroups/report-group-1': { groupId: 'report-group-1' },
      },
    });

    const handler = createCheckoutNextImportantHandler({
      config: TEST_CONFIG,
      db,
      auth: { requireAdmin: async () => {} },
    });

    // If reads happen after writes, the strengthened mock throws the same
    // error the real Firestore emulator throws. This test passes only when
    // every transaction.get() runs before any transaction.update() or set().
    const result = await handler({}, { uid: 'admin-1', token: {} });

    expect(result.success).toBe(true);
    expect((result.task as Record<string, unknown>).itemData).toEqual({
      groupId: 'report-group-1',
    });
  });

  // ── The range-lock contention fix (candidate query OUTSIDE the transaction) ──

  it('never issues a range query inside the transaction (doc-level claim only)', async () => {
    const { db, transaction } = createMockDb({
      docs: { 'adminTasks/task1': pendingTask('group1', 10) },
    });
    const handler = createCheckoutNextImportantHandler({
      config: TEST_CONFIG,
      db,
      auth: { adminUserIds: ['admin1'] },
    });

    // The mock throws on a transactional range read, so success here proves the claim
    // transaction touched only specific docs.
    const result = await handler({}, { uid: 'admin1', token: null });
    expect(result.success).toBe(true);
    for (const call of transaction.get.mock.calls) {
      expect((call[0] as any)._isQuery).toBeUndefined();
    }
  });

  it('retries the NEXT candidate when the first is claimed between query and transaction', async () => {
    let stolen = false;
    const { db, updates } = createMockDb({
      docs: {
        'adminTasks/task1': pendingTask('group1', 10),
        'adminTasks/task2': pendingTask('group2', 5),
      },
      afterQuery: (store) => {
        // Another admin wins task1 in the race window — exactly once.
        if (!stolen) {
          stolen = true;
          store.set('adminTasks/task1', {
            ...store.get('adminTasks/task1')!,
            status: 'checkedOut',
            checkoutDetails: { userId: 'other-admin', expiresAt: Date.now() + 60_000 },
          });
        }
      },
    });
    const handler = createCheckoutNextImportantHandler({
      config: TEST_CONFIG,
      db,
      auth: { adminUserIds: ['admin1'] },
    });

    const result = await handler({}, { uid: 'admin1', token: null });

    expect(result.success).toBe(true);
    expect((result.task as any).id).toBe('task2');
    // task1 was never written by THIS handler — only task2.
    expect(updates).toHaveLength(1);
    expect(updates[0].path).toBe('adminTasks/task2');
  });

  it('gives up with a busy error after exhausting claim rounds under perpetual contention', async () => {
    const { db, queryCount } = createMockDb({
      docs: { 'adminTasks/task1': pendingTask('group1', 10) },
      // Every round: the query sees task1 pending, but by claim time it is locked.
      beforeQuery: (store) => {
        store.set('adminTasks/task1', { ...store.get('adminTasks/task1')!, status: 'pending' });
      },
      afterQuery: (store) => {
        store.set('adminTasks/task1', {
          ...store.get('adminTasks/task1')!,
          status: 'checkedOut',
          checkoutDetails: { userId: 'other-admin', expiresAt: Date.now() + 60_000 },
        });
      },
    });
    const handler = createCheckoutNextImportantHandler({
      config: TEST_CONFIG,
      db,
      auth: { adminUserIds: ['admin1'] },
    });

    await expect(handler({}, { uid: 'admin1', token: null })).rejects.toThrow(
      'queue is busy',
    );
    expect(queryCount()).toBe(5);
  });
});
