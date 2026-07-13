import { describe, it, expect, vi } from 'vitest';
import { createCheckoutTaskHandler } from '../src/server/createCheckoutTaskHandler';
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

const AUTH = { adminUserIds: ['admin1'] };

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

const baseTask = {
  taskType: 'userReport',
  taskId: 'group1',
  originalPath: 'activeReportGroups/group1',
  summary: 'a report',
  priority: 5,
  createdAt: 1,
};

const GROUP_DOC = { id: 'group1', status: 'pending' };

describe('createCheckoutTaskHandler — specificTaskId status guard', () => {
  it('checks out a pending task', async () => {
    const { db, updates } = createMockDb({
      docs: {
        'adminTasks/task1': { ...baseTask, status: 'pending' },
        'activeReportGroups/group1': GROUP_DOC,
      },
    });
    const handler = createCheckoutTaskHandler({ config: TEST_CONFIG, db, auth: AUTH });

    const result = (await handler(
      { taskType: 'userReport', specificTaskId: 'task1' },
      { uid: 'admin1', token: {} },
    )) as { success: boolean; task: { status: string } };

    expect(result.success).toBe(true);
    expect(result.task.status).toBe('checkedOut');
    expect(updates.some((u) => u.path === 'adminTasks/task1' && u.data.status === 'checkedOut')).toBe(true);
  });

  it('rejects a COMPLETED (resolved) task — no re-checkout, no write', async () => {
    const { db, updates } = createMockDb({
      docs: {
        'adminTasks/task1': { ...baseTask, status: 'completed' },
        'activeReportGroups/group1': GROUP_DOC,
      },
    });
    const handler = createCheckoutTaskHandler({ config: TEST_CONFIG, db, auth: AUTH });

    await expect(
      handler({ taskType: 'userReport', specificTaskId: 'task1' }, { uid: 'admin1', token: {} }),
    ).rejects.toThrow('already been resolved');
    expect(updates).toHaveLength(0);
  });

  it('rejects a checkedOut task whose lock is still active', async () => {
    const { db } = createMockDb({
      docs: {
        'adminTasks/task1': {
          ...baseTask,
          status: 'checkedOut',
          checkoutDetails: { userId: 'other', expiresAt: Date.now() + 60_000 },
        },
        'activeReportGroups/group1': GROUP_DOC,
      },
    });
    const handler = createCheckoutTaskHandler({ config: TEST_CONFIG, db, auth: AUTH });

    await expect(
      handler({ taskType: 'userReport', specificTaskId: 'task1' }, { uid: 'admin1', token: {} }),
    ).rejects.toThrow('already checked out by another admin');
  });

  it('allows stealing a checkedOut task whose lock has EXPIRED', async () => {
    const { db, updates } = createMockDb({
      docs: {
        'adminTasks/task1': {
          ...baseTask,
          status: 'checkedOut',
          checkoutDetails: { userId: 'other', expiresAt: Date.now() - 60_000 },
        },
        'activeReportGroups/group1': GROUP_DOC,
      },
    });
    const handler = createCheckoutTaskHandler({ config: TEST_CONFIG, db, auth: AUTH });

    const result = (await handler(
      { taskType: 'userReport', specificTaskId: 'task1' },
      { uid: 'admin1', token: {} },
    )) as { success: boolean };
    expect(result.success).toBe(true);
    expect(updates.some((u) => u.path === 'adminTasks/task1' && u.data.status === 'checkedOut')).toBe(true);
  });

  it('emits an auto_released audit event when stealing an expired checkout', async () => {
    const onAuditEvent = vi.fn();
    const { db } = createMockDb({
      docs: {
        'adminTasks/task1': {
          ...baseTask,
          status: 'checkedOut',
          checkoutDetails: { userId: 'other', expiresAt: Date.now() - 60_000 },
        },
        'activeReportGroups/group1': GROUP_DOC,
      },
    });
    const handler = createCheckoutTaskHandler({ config: TEST_CONFIG, db, auth: AUTH, onAuditEvent });

    await handler({ taskType: 'userReport', specificTaskId: 'task1' }, { uid: 'admin1', token: {} });

    expect(onAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'auto_released', adminUserId: 'other' }),
      expect.anything(),
    );
    expect(onAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'checkout', adminUserId: 'admin1' }),
      expect.anything(),
    );
  });

  it('allows stealing an expired workLater task', async () => {
    const { db, updates } = createMockDb({
      docs: {
        'adminTasks/task1': {
          ...baseTask,
          status: 'workLater',
          checkoutDetails: { userId: 'other', expiresAt: Date.now() - 1 },
        },
        'activeReportGroups/group1': GROUP_DOC,
      },
    });
    const handler = createCheckoutTaskHandler({ config: TEST_CONFIG, db, auth: AUTH });

    const result = (await handler(
      { taskType: 'userReport', specificTaskId: 'task1' },
      { uid: 'admin1', token: {} },
    )) as { success: boolean };
    expect(result.success).toBe(true);
    expect(updates.some((u) => u.data.status === 'checkedOut')).toBe(true);
  });

  it('throws when the specific task does not exist', async () => {
    const { db } = createMockDb();
    const handler = createCheckoutTaskHandler({ config: TEST_CONFIG, db, auth: AUTH });

    await expect(
      handler({ taskType: 'userReport', specificTaskId: 'task1' }, { uid: 'admin1', token: {} }),
    ).rejects.toThrow('could not be found');
  });
});

describe('createCheckoutTaskHandler — queue path (no specificTaskId)', () => {
  it('checks out the highest-priority pending task of the requested type', async () => {
    const { db, updates } = createMockDb({
      docs: {
        'adminTasks/low': { ...baseTask, taskId: 'groupLow', priority: 1, status: 'pending' },
        'adminTasks/high': { ...baseTask, taskId: 'groupHigh', priority: 9, status: 'pending' },
        'adminTasks/otherType': {
          ...baseTask,
          taskType: 'thresholdLibraryReview',
          priority: 99,
          status: 'pending',
        },
        'activeReportGroups/group1': GROUP_DOC,
      },
    });
    const handler = createCheckoutTaskHandler({ config: TEST_CONFIG, db, auth: AUTH });

    const result = (await handler(
      { taskType: 'userReport' },
      { uid: 'admin1', token: {} },
    )) as { success: boolean; task: { id: string } };

    expect(result.success).toBe(true);
    expect(result.task.id).toBe('high');
    expect(updates).toHaveLength(1);
    expect(updates[0].path).toBe('adminTasks/high');
  });

  it('falls back to an expired checkedOut task and audits the auto-release', async () => {
    const onAuditEvent = vi.fn();
    const { db, updates } = createMockDb({
      docs: {
        'adminTasks/expired': {
          ...baseTask,
          status: 'checkedOut',
          checkoutDetails: { userId: 'other', expiresAt: Date.now() - 60_000 },
        },
        'activeReportGroups/group1': GROUP_DOC,
      },
    });
    const handler = createCheckoutTaskHandler({ config: TEST_CONFIG, db, auth: AUTH, onAuditEvent });

    const result = (await handler(
      { taskType: 'userReport' },
      { uid: 'admin1', token: {} },
    )) as { success: boolean };

    expect(result.success).toBe(true);
    expect(updates.some((u) => u.path === 'adminTasks/expired' && u.data.status === 'checkedOut')).toBe(true);
    expect(onAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'auto_released', adminUserId: 'other' }),
      expect.anything(),
    );
  });

  it('throws when the queue has no pending or expired tasks', async () => {
    const { db } = createMockDb({
      docs: {
        'adminTasks/locked': {
          ...baseTask,
          status: 'checkedOut',
          checkoutDetails: { userId: 'other', expiresAt: Date.now() + 60_000 },
        },
      },
    });
    const handler = createCheckoutTaskHandler({ config: TEST_CONFIG, db, auth: AUTH });

    await expect(handler({ taskType: 'userReport' }, { uid: 'admin1', token: {} })).rejects.toThrow(
      'No available tasks in this queue.',
    );
  });

  it('never issues a range query inside the transaction (doc-level claim only)', async () => {
    const { db, transaction } = createMockDb({
      docs: {
        'adminTasks/task1': { ...baseTask, status: 'pending' },
        'activeReportGroups/group1': GROUP_DOC,
      },
    });
    const handler = createCheckoutTaskHandler({ config: TEST_CONFIG, db, auth: AUTH });

    // The mock throws on a transactional range read, so success here proves the claim
    // transaction touched only specific docs.
    const result = (await handler(
      { taskType: 'userReport' },
      { uid: 'admin1', token: {} },
    )) as { success: boolean };
    expect(result.success).toBe(true);
    for (const call of transaction.get.mock.calls) {
      expect((call[0] as any)._isQuery).toBeUndefined();
    }
  });

  it('retries the NEXT candidate when the first is claimed between query and transaction', async () => {
    let stolen = false;
    const { db, updates } = createMockDb({
      docs: {
        'adminTasks/first': { ...baseTask, taskId: 'groupFirst', priority: 9, status: 'pending' },
        'adminTasks/second': { ...baseTask, taskId: 'groupSecond', priority: 1, status: 'pending' },
        'activeReportGroups/group1': GROUP_DOC,
      },
      afterQuery: (store) => {
        // Another admin wins `first` in the race window — exactly once.
        if (!stolen) {
          stolen = true;
          store.set('adminTasks/first', {
            ...store.get('adminTasks/first')!,
            status: 'checkedOut',
            checkoutDetails: { userId: 'other-admin', expiresAt: Date.now() + 60_000 },
          });
        }
      },
    });
    const handler = createCheckoutTaskHandler({ config: TEST_CONFIG, db, auth: AUTH });

    const result = (await handler(
      { taskType: 'userReport' },
      { uid: 'admin1', token: {} },
    )) as { success: boolean; task: { id: string } };

    expect(result.success).toBe(true);
    expect(result.task.id).toBe('second');
    // `first` was never written by THIS handler — only `second`.
    expect(updates).toHaveLength(1);
    expect(updates[0].path).toBe('adminTasks/second');
  });

  it('gives up with a busy error after exhausting claim rounds under perpetual contention', async () => {
    const { db } = createMockDb({
      docs: {
        'adminTasks/task1': { ...baseTask, status: 'pending' },
        'activeReportGroups/group1': GROUP_DOC,
      },
      // Every round: the query sees task1 pending, but by claim time it is locked.
      beforeQuery: (store) => {
        store.set('adminTasks/task1', {
          ...store.get('adminTasks/task1')!,
          status: 'pending',
          checkoutDetails: null,
        });
      },
      afterQuery: (store) => {
        store.set('adminTasks/task1', {
          ...store.get('adminTasks/task1')!,
          status: 'checkedOut',
          checkoutDetails: { userId: 'other-admin', expiresAt: Date.now() + 60_000 },
        });
      },
    });
    const handler = createCheckoutTaskHandler({ config: TEST_CONFIG, db, auth: AUTH });

    await expect(handler({ taskType: 'userReport' }, { uid: 'admin1', token: {} })).rejects.toThrow(
      'queue is busy',
    );
  });
});
