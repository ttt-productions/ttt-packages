import { describe, it, expect, vi } from 'vitest';
import { createCheckoutTaskHandler } from '../src/server/createCheckoutTaskHandler';
import { ReportCoreTaskError } from '../src/server/taskError';
import type { ServerReportCoreConfig, TaskClaimGuard } from '../src/server/types';

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
  let docsRead = 0;
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

  const makeQuery = (colPath: string, clauses: Clause[], orders: Order[], lim?: number, afterPath?: string) => {
    const query = {
      _isQuery: true,
      where: (field: string, op: string, value: unknown) =>
        makeQuery(colPath, [...clauses, { field, op, value }], orders, lim, afterPath),
      orderBy: (field: string, direction: 'asc' | 'desc' = 'asc') =>
        makeQuery(colPath, clauses, [...orders, { field, dir: direction }], lim, afterPath),
      limit: (n: number) => makeQuery(colPath, clauses, orders, n, afterPath),
      startAfter: (snapshot: { ref: { _path: string } }) =>
        makeQuery(colPath, clauses, orders, lim, snapshot.ref._path),
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
        if (afterPath !== undefined) {
          const at = rows.findIndex((r) => r.path === afterPath);
          if (at >= 0) rows = rows.slice(at + 1);
        }
        if (lim !== undefined) rows = rows.slice(0, lim);
        docsRead += rows.length;
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

  return { db, transaction, store, sets, updates, queryCount: () => queryCount, docsRead: () => docsRead };
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
      expect.objectContaining({ action: 'auto_released', adminUserId: 'admin1', priorAdminUserId: 'other' }),
      expect.anything(),
    );
    expect(onAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'checkout', adminUserId: 'admin1' }),
      expect.anything(),
    );
  });

  it('names the caller who took over as the actor of the auto-release, never the prior holder', async () => {
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

    const release = onAuditEvent.mock.calls.map(([event]) => event).find((e) => e.action === 'auto_released');
    expect(release.adminUserId).toBe('admin1');
    expect(release.priorAdminUserId).toBe('other');
  });

  it('answers a re-checkout of the caller own active lock with the task as held and writes nothing', async () => {
    const onAuditEvent = vi.fn();
    const heldCheckout = { userId: 'admin1', checkedOutAt: 1_000, expiresAt: Date.now() + 60_000, workLaterUntil: null };
    const { db, updates, sets } = createMockDb({
      docs: {
        'adminTasks/task1': { ...baseTask, status: 'checkedOut', checkoutDetails: heldCheckout },
        'activeReportGroups/group1': GROUP_DOC,
      },
    });
    const handler = createCheckoutTaskHandler({ config: TEST_CONFIG, db, auth: AUTH, onAuditEvent });

    const result = (await handler(
      { taskType: 'userReport', specificTaskId: 'task1' },
      { uid: 'admin1', token: {} },
    )) as { success: boolean; alreadyHeld: boolean; task: Record<string, unknown> };

    expect(result.success).toBe(true);
    expect(result.alreadyHeld).toBe(true);
    expect(result.task).toMatchObject({
      id: 'task1',
      status: 'checkedOut',
      checkedOutAt: heldCheckout.checkedOutAt,
      expiresAt: heldCheckout.expiresAt,
      checkoutDetails: heldCheckout,
      itemData: GROUP_DOC,
    });
    expect(updates).toHaveLength(0);
    expect(sets).toHaveLength(0);
    expect(onAuditEvent).not.toHaveBeenCalled();
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
      expect.objectContaining({ action: 'auto_released', adminUserId: 'admin1', priorAdminUserId: 'other' }),
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

describe('createCheckoutTaskHandler — the app claim guard', () => {
  const IN_FLIGHT = 'This report is being processed.';
  const refuseInFlight: TaskClaimGuard = async ({ originalData }) =>
    originalData?.status === 'processing' ? { claimable: false, message: IN_FLIGHT } : { claimable: true };

  it('refuses a specific task the guard refuses, with the app message and no write or audit', async () => {
    const onAuditEvent = vi.fn();
    const { db, updates, sets } = createMockDb({
      docs: {
        'adminTasks/task1': { ...baseTask, status: 'pending' },
        'activeReportGroups/group1': { ...GROUP_DOC, status: 'processing' },
      },
    });
    const handler = createCheckoutTaskHandler({
      config: TEST_CONFIG,
      db,
      auth: AUTH,
      onAuditEvent,
      assertTaskClaimable: refuseInFlight,
    });

    const error = await handler({ taskType: 'userReport', specificTaskId: 'task1' }, { uid: 'admin1', token: {} }).catch(
      (e) => e,
    );

    expect(error).toBeInstanceOf(ReportCoreTaskError);
    expect(error.code).toBe('failed-precondition');
    expect(error.message).toBe(IN_FLIGHT);
    expect(updates).toHaveLength(0);
    expect(sets).toHaveLength(0);
    expect(onAuditEvent).not.toHaveBeenCalled();
  });

  it('refuses the takeover of an expired lock without auditing an auto-release', async () => {
    const onAuditEvent = vi.fn();
    const { db, updates } = createMockDb({
      docs: {
        'adminTasks/task1': {
          ...baseTask,
          status: 'checkedOut',
          checkoutDetails: { userId: 'other', expiresAt: Date.now() - 60_000 },
        },
        'activeReportGroups/group1': { ...GROUP_DOC, status: 'processing' },
      },
    });
    const handler = createCheckoutTaskHandler({
      config: TEST_CONFIG,
      db,
      auth: AUTH,
      onAuditEvent,
      assertTaskClaimable: refuseInFlight,
    });

    await expect(
      handler({ taskType: 'userReport', specificTaskId: 'task1' }, { uid: 'admin1', token: {} }),
    ).rejects.toThrow(IN_FLIGHT);
    expect(updates).toHaveLength(0);
    expect(onAuditEvent).not.toHaveBeenCalled();
  });

  it('asks the guard inside the claim transaction, after the task and item reads and before any write', async () => {
    const { db, transaction } = createMockDb({
      docs: {
        'adminTasks/task1': { ...baseTask, status: 'pending' },
        'activeReportGroups/group1': GROUP_DOC,
        'caseLocks/group1': { open: false },
      },
    });
    const guard = vi.fn<TaskClaimGuard>(async (args) => {
      // A guard may read more through the transaction; the mock throws on a read after a write.
      const lock = await args.transaction.get(db.doc('caseLocks/group1'));
      return lock.data()?.open ? { claimable: false, message: 'locked' } : { claimable: true };
    });
    const handler = createCheckoutTaskHandler({ config: TEST_CONFIG, db, auth: AUTH, assertTaskClaimable: guard });

    const result = (await handler(
      { taskType: 'userReport', specificTaskId: 'task1' },
      { uid: 'admin1', token: {} },
    )) as { success: boolean };

    expect(result.success).toBe(true);
    expect(guard).toHaveBeenCalledTimes(1);
    const args = guard.mock.calls[0][0];
    expect(args.taskDocId).toBe('task1');
    expect(args.taskData).toMatchObject({ taskId: 'group1', status: 'pending' });
    expect(args.originalData).toEqual(GROUP_DOC);
    expect(args.transaction).toBe(transaction);
    const guardOrder = guard.mock.invocationCallOrder[0];
    expect(transaction.get.mock.invocationCallOrder[1]).toBeLessThan(guardOrder);
    expect(transaction.update.mock.invocationCallOrder[0]).toBeGreaterThan(guardOrder);
  });

  it('hands the guard a null item when the task original document is gone', async () => {
    const { db } = createMockDb({ docs: { 'adminTasks/task1': { ...baseTask, status: 'pending' } } });
    const guard = vi.fn<TaskClaimGuard>(async () => ({ claimable: true }));
    const handler = createCheckoutTaskHandler({ config: TEST_CONFIG, db, auth: AUTH, assertTaskClaimable: guard });

    await handler({ taskType: 'userReport', specificTaskId: 'task1' }, { uid: 'admin1', token: {} });

    expect(guard.mock.calls[0][0].originalData).toBeNull();
  });

  it('does not ask the guard when the caller already holds the task', async () => {
    const { db } = createMockDb({
      docs: {
        'adminTasks/task1': {
          ...baseTask,
          status: 'checkedOut',
          checkoutDetails: { userId: 'admin1', checkedOutAt: 1, expiresAt: Date.now() + 60_000 },
        },
        'activeReportGroups/group1': { ...GROUP_DOC, status: 'processing' },
      },
    });
    const guard = vi.fn(refuseInFlight);
    const handler = createCheckoutTaskHandler({ config: TEST_CONFIG, db, auth: AUTH, assertTaskClaimable: guard });

    const result = (await handler(
      { taskType: 'userReport', specificTaskId: 'task1' },
      { uid: 'admin1', token: {} },
    )) as { alreadyHeld?: boolean };

    expect(result.alreadyHeld).toBe(true);
    expect(guard).not.toHaveBeenCalled();
  });

  it('aborts the claim when the guard throws — a failed check never counts as claimable', async () => {
    const { db, updates } = createMockDb({
      docs: {
        'adminTasks/task1': { ...baseTask, status: 'pending' },
        'activeReportGroups/group1': GROUP_DOC,
      },
    });
    const readFailure = new Error('read failed');
    const handler = createCheckoutTaskHandler({
      config: TEST_CONFIG,
      db,
      auth: AUTH,
      assertTaskClaimable: async () => {
        throw readFailure;
      },
    });

    await expect(handler({ taskType: 'userReport' }, { uid: 'admin1', token: {} })).rejects.toBe(readFailure);
    expect(updates).toHaveLength(0);
  });

  it('skips a refused queue candidate and claims the next one', async () => {
    const { db, updates } = createMockDb({
      docs: {
        'adminTasks/busy': { ...baseTask, taskId: 'groupBusy', originalPath: 'activeReportGroups/groupBusy', priority: 9, status: 'pending' },
        'adminTasks/free': { ...baseTask, taskId: 'groupFree', originalPath: 'activeReportGroups/groupFree', priority: 1, status: 'pending' },
        'activeReportGroups/groupBusy': { status: 'processing' },
        'activeReportGroups/groupFree': { status: 'pending' },
      },
    });
    const handler = createCheckoutTaskHandler({ config: TEST_CONFIG, db, auth: AUTH, assertTaskClaimable: refuseInFlight });

    const result = (await handler({ taskType: 'userReport' }, { uid: 'admin1', token: {} })) as {
      task: { id: string };
    };

    expect(result.task.id).toBe('free');
    expect(updates).toHaveLength(1);
    expect(updates[0].path).toBe('adminTasks/free');
  });

  it('skips more refused candidates than the contention round budget', async () => {
    const docs: Record<string, DocData> = {
      'adminTasks/free': { ...baseTask, taskId: 'groupFree', originalPath: 'activeReportGroups/groupFree', priority: 1, status: 'pending' },
      'activeReportGroups/groupFree': { status: 'pending' },
    };
    for (let i = 0; i < 7; i++) {
      docs[`adminTasks/busy${i}`] = {
        ...baseTask,
        taskId: `groupBusy${i}`,
        originalPath: `activeReportGroups/groupBusy${i}`,
        priority: 20 - i,
        status: 'pending',
      };
      docs[`activeReportGroups/groupBusy${i}`] = { status: 'processing' };
    }
    const { db } = createMockDb({ docs });
    const handler = createCheckoutTaskHandler({ config: TEST_CONFIG, db, auth: AUTH, assertTaskClaimable: refuseInFlight });

    const result = (await handler({ taskType: 'userReport' }, { uid: 'admin1', token: {} })) as {
      task: { id: string };
    };

    expect(result.task.id).toBe('free');
  });

  it('reads past refused candidates one document per refusal, never re-reading the queue head', async () => {
    const docs: Record<string, DocData> = {
      'adminTasks/free': { ...baseTask, taskId: 'groupFree', originalPath: 'activeReportGroups/groupFree', priority: 1, status: 'pending' },
      'activeReportGroups/groupFree': { status: 'pending' },
    };
    for (let i = 0; i < 7; i++) {
      docs[`adminTasks/busy${i}`] = {
        ...baseTask,
        taskId: `groupBusy${i}`,
        originalPath: `activeReportGroups/groupBusy${i}`,
        priority: 20 - i,
        status: 'pending',
      };
      docs[`activeReportGroups/groupBusy${i}`] = { status: 'processing' };
    }
    const { db, docsRead, queryCount } = createMockDb({ docs });
    const handler = createCheckoutTaskHandler({ config: TEST_CONFIG, db, auth: AUTH, assertTaskClaimable: refuseInFlight });

    await handler({ taskType: 'userReport' }, { uid: 'admin1', token: {} });

    // Seven refusals and one claim: eight one-document reads in total.
    expect(queryCount()).toBe(8);
    expect(docsRead()).toBe(8);
  });

  it('answers an empty queue when every candidate, expired ones included, is refused', async () => {
    const { db, updates } = createMockDb({
      docs: {
        'adminTasks/busy': { ...baseTask, status: 'pending' },
        'adminTasks/expired': {
          ...baseTask,
          status: 'checkedOut',
          checkoutDetails: { userId: 'other', expiresAt: Date.now() - 60_000 },
        },
        'activeReportGroups/group1': { ...GROUP_DOC, status: 'processing' },
      },
    });
    const guard = vi.fn(refuseInFlight);
    const handler = createCheckoutTaskHandler({ config: TEST_CONFIG, db, auth: AUTH, assertTaskClaimable: guard });

    const error = await handler({ taskType: 'userReport' }, { uid: 'admin1', token: {} }).catch((e) => e);

    expect(error).toBeInstanceOf(ReportCoreTaskError);
    expect(error.code).toBe('not-found');
    expect(guard).toHaveBeenCalledTimes(2);
    expect(updates).toHaveLength(0);
  });
});
