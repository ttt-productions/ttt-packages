import { describe, it, expect, vi, type Mock } from 'vitest';
import { createCheckoutNextImportantHandler } from '../src/server/createCheckoutNextImportantHandler.js';
import { ReportCoreTaskError } from '../src/server/taskError.js';
import type {
  ServerReportCoreConfig,
  TaskClaimGuard,
  ServerDocRef,
  ServerDocSnapshot,
  ServerFirestore,
  ServerCollectionRef,
  ServerQuery,
  ServerQuerySnapshot,
  ServerTransaction,
} from '../src/server/types.js';

const TEST_CONFIG: ServerReportCoreConfig = {
  describeUserReportTask: ({ totalReports, reportedItemType }) =>
    `${reportedItemType} reported ${totalReports} times`,
  collections: {
    reports: 'testReports',
    reportGroups: 'testReportGroups',
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
  return dotted.split('.').reduce<unknown>((acc, k) => (acc as DocData | undefined)?.[k], data);
}

interface MockDbOptions {
  docs?: Record<string, DocData>;
  beforeQuery?: (store: Store) => void;
  afterQuery?: (store: Store) => void;
}

function createMockDb(opts: MockDbOptions = {}) {
  let autoId = 0;
  const store: Store = new Map(Object.entries(opts.docs ?? {}));
  const updates: Array<{ path: string; data: DocData }> = [];
  const sets: Array<{ path: string; data: DocData }> = [];
  let queryCount = 0;
  let docsRead = 0;
  let hasWritten = false;

  type FakeRef = ServerDocRef & { _path: string };
  type FakeQuery = ServerQuery & { _isQuery: true };

  const outsideTransaction = (op: string) =>
    Promise.reject(new Error(`${op} outside the transaction is not part of this fake`));

  const makeRef = (path: string): FakeRef => ({
    id: path.split('/').pop()!,
    _path: path,
    set: () => outsideTransaction('set'),
    update: () => outsideTransaction('update'),
    get: () => outsideTransaction('get'),
  });

  const snapshotOf = (ref: FakeRef): ServerDocSnapshot => {
    const data = store.get(ref._path);
    return { exists: !!data, data: () => data, id: ref.id, ref };
  };

  interface Clause {
    field: string;
    op: string;
    value: unknown;
  }
  interface Order {
    field: string;
    dir: 'asc' | 'desc';
  }

  const makeQuery = (
    colPath: string,
    clauses: Clause[],
    orders: Order[],
    lim?: number,
    afterPath?: string,
  ): FakeQuery => {
    const query: FakeQuery = {
      _isQuery: true,
      where: (field: string, op: string, value: unknown) =>
        makeQuery(colPath, [...clauses, { field, op, value }], orders, lim, afterPath),
      orderBy: (field: string, direction: 'asc' | 'desc' = 'asc') =>
        makeQuery(colPath, clauses, [...orders, { field, dir: direction }], lim, afterPath),
      limit: (n: number) => makeQuery(colPath, clauses, orders, n, afterPath),
      startAfter: (snapshot: ServerDocSnapshot) =>
        makeQuery(colPath, clauses, orders, lim, (snapshot.ref as FakeRef)._path),
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
        const docs = rows.map((r): ServerDocSnapshot => ({
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

  const txGet = vi.fn(
    async (
      target: ServerDocRef | ServerQuery,
    ): Promise<ServerDocSnapshot | ServerQuerySnapshot> => {
      if ('_isQuery' in target) {
        throw new Error(
          'Range query inside a transaction — candidate discovery must run OUTSIDE the transaction (doc-level claims only).',
        );
      }
      if (hasWritten) {
        throw new Error(
          'Firestore transactions require all reads to be executed before all writes.',
        );
      }
      return snapshotOf(target as FakeRef);
    },
  );
  type FakeTransaction = ServerTransaction & {
    get: typeof txGet;
    set: Mock<(ref: ServerDocRef, data: DocData) => ServerTransaction>;
    update: Mock<(ref: ServerDocRef, data: DocData) => ServerTransaction>;
  };
  const transaction: FakeTransaction = {
    get: txGet as FakeTransaction['get'],
    set: vi.fn((ref: ServerDocRef, data: DocData) => {
      const { _path } = ref as FakeRef;
      hasWritten = true;
      sets.push({ path: _path, data });
      store.set(_path, data);
      return transaction;
    }),
    update: vi.fn((ref: ServerDocRef, data: DocData) => {
      const { _path } = ref as FakeRef;
      hasWritten = true;
      updates.push({ path: _path, data });
      store.set(_path, { ...(store.get(_path) ?? {}), ...data });
      return transaction;
    }),
  };

  const db: ServerFirestore = {
    collection: vi.fn((colPath: string): ServerCollectionRef => ({
      ...makeQuery(colPath, [], []),
      doc: vi.fn((id?: string) => makeRef(`${colPath}/${id ?? `auto_${++autoId}`}`)),
    })),
    doc: vi.fn((path: string) => makeRef(path)),
    batch: () => {
      throw new Error('batch writes are not part of this fake');
    },
    runTransaction: async (fn) => {
      hasWritten = false;
      return fn(transaction);
    },
  };

  return {
    db,
    transaction,
    store,
    sets,
    updates,
    queryCount: () => queryCount,
    docsRead: () => docsRead,
  };
}

const pendingTask = (taskId: string, priority: number, createdAt = 1): DocData => ({
  taskType: 'userReport',
  taskId,
  originalPath: `testReportGroups/${taskId}`,
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
      db: {} as ServerFirestore,
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

    await expect(handler({}, { uid: 'random-user', token: null })).rejects.toThrow(
      'Administrator access required',
    );
  });

  it('throws a TYPED not-found ReportCoreTaskError when the queue is empty', async () => {
    const { db } = createMockDb();
    const handler = createCheckoutNextImportantHandler({
      config: TEST_CONFIG,
      db,
      auth: { adminUserIds: ['admin1'] },
    });

    const refusal = handler({}, { uid: 'admin1', token: null });
    await expect(refusal).rejects.toBeInstanceOf(ReportCoreTaskError);
    await expect(refusal).rejects.toHaveProperty('code', 'not-found');
    await expect(refusal).rejects.toThrow('No pending tasks available');
  });

  it('returns task data on success', async () => {
    const { db } = createMockDb({
      docs: {
        'adminTasks/task1': { ...pendingTask('group1', 10), summary: '1 report for post' },
        'testReportGroups/group1': { reportedItemType: 'post' },
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
    expect(result.task.id).toBe('task1');
    expect(result.task.status).toBe('checkedOut');
    expect(result.task.itemData).toEqual({ reportedItemType: 'post' });
  });

  it("answers with the task's own createdAt and lastUpdatedAt, so the claim is a full checked-out task", async () => {
    const { db } = createMockDb({
      docs: {
        'adminTasks/task1': { ...pendingTask('group1', 10, 111), lastUpdatedAt: 222 },
        'testReportGroups/group1': { reportedItemType: 'post' },
      },
    });
    const handler = createCheckoutNextImportantHandler({
      config: TEST_CONFIG,
      db,
      auth: { adminUserIds: ['admin1'] },
    });

    const result = await handler({}, { uid: 'admin1', token: null });

    expect(result.task.createdAt).toBe(111);
    expect(result.task.lastUpdatedAt).toBe(222);
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
    expect(result.task.id).toBe('high');
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
    expect((updates[0].data.checkoutDetails as DocData).userId).toBe('admin1');
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

  it('without auth makes no admin check of its own, leaving the caller authorized upstream', async () => {
    const { db } = createMockDb({
      docs: { 'adminTasks/task1': pendingTask('group1', 10) },
    });
    const handler = createCheckoutNextImportantHandler({ config: TEST_CONFIG, db });

    const result = await handler({}, { uid: 'not-on-any-list', token: null });
    expect(result.success).toBe(true);
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

    await expect(handler({}, { uid: 'anyone', token: 'tok' })).rejects.toThrow(
      'No pending tasks available',
    );
    expect(requireAdmin).toHaveBeenCalledWith('anyone', 'tok');
  });

  it('a failed admin lookup fails the checkout as itself, never as a permission refusal', async () => {
    const { db } = createMockDb();
    const outage = Object.assign(new Error('Admin system configuration error'), {
      code: 'internal',
    });
    const handler = createCheckoutNextImportantHandler({
      config: TEST_CONFIG,
      db,
      auth: { requireAdmin: vi.fn().mockRejectedValue(outage), adminUserIds: ['admin1'] },
    });

    await expect(handler({}, { uid: 'admin1', token: null })).rejects.toBe(outage);
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

    const checkoutDetails = updates[0].data.checkoutDetails as DocData;
    const expectedMinExpiry = before + 60 * 60_000;
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
          originalPath: 'testReportGroups/report-group-1',
        },
        'testReportGroups/report-group-1': { groupId: 'report-group-1' },
      },
    });

    const handler = createCheckoutNextImportantHandler({
      config: TEST_CONFIG,
      db,
      auth: { requireAdmin: async () => {} },
    });

    const result = await handler({}, { uid: 'admin-1', token: {} });

    expect(result.success).toBe(true);
    expect(result.task.itemData).toEqual({
      groupId: 'report-group-1',
    });
  });

  it('never issues a range query inside the transaction (doc-level claim only)', async () => {
    const { db, transaction } = createMockDb({
      docs: { 'adminTasks/task1': pendingTask('group1', 10) },
    });
    const handler = createCheckoutNextImportantHandler({
      config: TEST_CONFIG,
      db,
      auth: { adminUserIds: ['admin1'] },
    });

    const result = await handler({}, { uid: 'admin1', token: null });
    expect(result.success).toBe(true);
    for (const call of transaction.get.mock.calls) {
      expect('_isQuery' in call[0]).toBe(false);
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
    expect(result.task.id).toBe('task2');
    expect(updates).toHaveLength(1);
    expect(updates[0].path).toBe('adminTasks/task2');
  });

  it('gives up with a busy error after exhausting claim rounds under perpetual contention', async () => {
    const { db, queryCount } = createMockDb({
      docs: { 'adminTasks/task1': pendingTask('group1', 10) },
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

    await expect(handler({}, { uid: 'admin1', token: null })).rejects.toThrow('queue is busy');
    expect(queryCount()).toBe(5);
  });
});

describe('createCheckoutNextImportantHandler — the app claim guard', () => {
  const refuseInFlight: TaskClaimGuard = async ({ originalData }) =>
    originalData?.status === 'processing'
      ? { claimable: false, message: 'in flight' }
      : { claimable: true };

  it('skips a refused candidate, without auditing it, and claims the next one', async () => {
    const onAuditEvent = vi.fn();
    const { db, updates } = createMockDb({
      docs: {
        'adminTasks/busy': pendingTask('groupBusy', 9),
        'adminTasks/free': pendingTask('groupFree', 1),
        'testReportGroups/groupBusy': { status: 'processing' },
        'testReportGroups/groupFree': { status: 'pending' },
      },
    });
    const handler = createCheckoutNextImportantHandler({
      config: TEST_CONFIG,
      db,
      auth: { adminUserIds: ['admin1'] },
      onAuditEvent,
      assertTaskClaimable: refuseInFlight,
    });

    const result = await handler({}, { uid: 'admin1', token: null });

    expect((result.task as { id: string }).id).toBe('free');
    expect(updates).toHaveLength(1);
    expect(updates[0].path).toBe('adminTasks/free');
    expect(onAuditEvent).toHaveBeenCalledTimes(1);
    expect(onAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({ taskId: 'groupFree' }),
      expect.anything(),
    );
  });

  it('hands the guard the task, its item, and the claim transaction', async () => {
    const { db, transaction } = createMockDb({
      docs: {
        'adminTasks/task1': pendingTask('group1', 5),
        'testReportGroups/group1': { status: 'pending' },
      },
    });
    const guard = vi.fn<TaskClaimGuard>(async () => ({ claimable: true }));
    const handler = createCheckoutNextImportantHandler({
      config: TEST_CONFIG,
      db,
      auth: { adminUserIds: ['admin1'] },
      assertTaskClaimable: guard,
    });

    await handler({}, { uid: 'admin1', token: null });

    const args = guard.mock.calls[0][0];
    expect(args.taskDocId).toBe('task1');
    expect(args.taskData).toMatchObject({ taskId: 'group1', status: 'pending' });
    expect(args.originalData).toEqual({ status: 'pending' });
    expect(args.transaction).toBe(transaction);
    expect(transaction.update.mock.invocationCallOrder[0]).toBeGreaterThan(
      guard.mock.invocationCallOrder[0],
    );
  });

  it('reads past refused candidates one document per refusal, never re-reading the queue head', async () => {
    const docs: Record<string, DocData> = {
      'adminTasks/free': pendingTask('groupFree', 1),
      'testReportGroups/groupFree': { status: 'pending' },
    };
    for (let i = 0; i < 6; i++) {
      docs[`adminTasks/busy${i}`] = pendingTask(`groupBusy${i}`, 20 - i);
      docs[`testReportGroups/groupBusy${i}`] = { status: 'processing' };
    }
    const { db, docsRead, queryCount } = createMockDb({ docs });
    const handler = createCheckoutNextImportantHandler({
      config: TEST_CONFIG,
      db,
      auth: { adminUserIds: ['admin1'] },
      assertTaskClaimable: refuseInFlight,
    });

    const result = await handler({}, { uid: 'admin1', token: null });

    expect((result.task as { id: string }).id).toBe('free');
    expect(queryCount()).toBe(7);
    expect(docsRead()).toBe(7);
  });

  it('answers an empty queue when every pending task is refused', async () => {
    const { db, updates } = createMockDb({
      docs: {
        'adminTasks/a': pendingTask('groupA', 9),
        'adminTasks/b': pendingTask('groupB', 5),
        'testReportGroups/groupA': { status: 'processing' },
        'testReportGroups/groupB': { status: 'processing' },
      },
    });
    const handler = createCheckoutNextImportantHandler({
      config: TEST_CONFIG,
      db,
      auth: { adminUserIds: ['admin1'] },
      assertTaskClaimable: refuseInFlight,
    });

    const refusal = handler({}, { uid: 'admin1', token: null });

    await expect(refusal).rejects.toBeInstanceOf(ReportCoreTaskError);
    await expect(refusal).rejects.toHaveProperty('code', 'not-found');
    expect(updates).toHaveLength(0);
  });
});
