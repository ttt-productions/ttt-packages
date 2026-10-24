import { describe, it, expect, vi } from 'vitest';
import { createReleaseTaskHandler } from '../src/server/createReleaseTaskHandler.js';
import { ReportCoreTaskError } from '../src/server/taskError.js';
import type { ServerReportCoreConfig } from '../src/server/types.js';

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

function createMockDb(taskData: Record<string, unknown> | null) {
  let autoId = 0;
  const store = new Map<string, Record<string, unknown>>();
  if (taskData) store.set('adminTasks/task1', taskData);

  const makeRef = (path: string) => ({
    id: path.split('/').pop()!,
    _path: path,
  });

  const sets: Array<{ path: string; data: Record<string, unknown> }> = [];
  const updates: Array<{ path: string; data: Record<string, unknown> }> = [];

  const transaction = {
    get: vi.fn(async (ref: any) => {
      const path = ref._path;
      const data = store.get(path);
      return { exists: !!data, data: () => data, ref: makeRef(path), id: path.split('/').pop()! };
    }),
    set: vi.fn((ref: any, data: Record<string, unknown>) => {
      sets.push({ path: ref._path, data });
      return transaction;
    }),
    update: vi.fn((ref: any, data: Record<string, unknown>) => {
      updates.push({ path: ref._path, data });
      return transaction;
    }),
  };

  const db = {
    collection: vi.fn((colPath: string) => ({
      doc: vi.fn((id?: string) => {
        const docId = id ?? `auto_${++autoId}`;
        return makeRef(`${colPath}/${docId}`);
      }),
    })),
    runTransaction: vi.fn(async (fn: any) => fn(transaction)),
  } as any;

  return { db, transaction, sets, updates };
}

describe('createReleaseTaskHandler', () => {
  it('factory returns a function', () => {
    const handler = createReleaseTaskHandler({ config: TEST_CONFIG, db: {} as any });
    expect(typeof handler).toBe('function');
  });

  it('sets status=pending and clears checkoutDetails', async () => {
    const taskData = {
      taskType: 'userReport',
      taskId: 'group1',
      status: 'checkedOut',
      checkoutDetails: { userId: 'admin1', checkedOutAt: Date.now() - 1000 },
    };
    const { db, updates } = createMockDb(taskData);
    const handler = createReleaseTaskHandler({ config: TEST_CONFIG, db });

    const result = await handler({ taskId: 'task1' }, { uid: 'admin1' });

    expect(result).toEqual({ success: true });
    expect(updates).toHaveLength(1);
    expect(updates[0].data.status).toBe('pending');
    expect(updates[0].data.checkoutDetails).toBeNull();
  });

  it('IDEMPOTENT: missing task doc → success no-op (no write, no audit event)', async () => {
    const { db, updates, sets } = createMockDb(null);
    const onAuditEvent = vi.fn();
    const handler = createReleaseTaskHandler({ config: TEST_CONFIG, db, onAuditEvent });

    const result = await handler({ taskId: 'task1' }, { uid: 'admin1' });

    expect(result).toEqual({ success: true, alreadyResolved: true });
    expect(updates).toHaveLength(0);
    expect(sets).toHaveLength(0);
    expect(onAuditEvent).not.toHaveBeenCalled();
  });

  it('throws when user does not own checkout', async () => {
    const taskData = {
      taskType: 'userReport',
      taskId: 'group1',
      status: 'checkedOut',
      checkoutDetails: { userId: 'other-admin', checkedOutAt: Date.now() - 1000 },
    };
    const { db } = createMockDb(taskData);
    const handler = createReleaseTaskHandler({ config: TEST_CONFIG, db });

    await expect(handler({ taskId: 'task1' }, { uid: 'admin1' })).rejects.toThrow(
      'do not have this task checked out',
    );
  });

  it('typed codes: failed-precondition for a foreign checkout (a missing task is NOT an error)', async () => {
    const { db: foreignDb } = createMockDb({
      taskType: 'userReport',
      taskId: 'group1',
      status: 'checkedOut',
      checkoutDetails: { userId: 'other-admin', checkedOutAt: Date.now() - 1000 },
    });
    const foreign = await createReleaseTaskHandler({ config: TEST_CONFIG, db: foreignDb })(
      { taskId: 'task1' },
      { uid: 'admin1' },
    ).catch((e) => e);
    expect(foreign).toBeInstanceOf(ReportCoreTaskError);
    expect(foreign.code).toBe('failed-precondition');

    const { db: emptyDb } = createMockDb(null);
    const gone = await createReleaseTaskHandler({ config: TEST_CONFIG, db: emptyDb })(
      { taskId: 'task1' },
      { uid: 'admin1' },
    ).catch((e) => e);
    expect(gone).not.toBeInstanceOf(ReportCoreTaskError);
    expect(gone).toEqual({ success: true, alreadyResolved: true });
  });

  it('the admin gate still rejects before any read, missing task or not', async () => {
    const { db, transaction } = createMockDb(null);
    const requireAdmin = vi.fn().mockRejectedValue(new Error('Administrator access required'));
    const handler = createReleaseTaskHandler({ config: TEST_CONFIG, db, auth: { requireAdmin } });

    await expect(handler({ taskId: 'task1' }, { uid: 'not-an-admin' })).rejects.toThrow(
      'Administrator access required',
    );
    expect(transaction.get).not.toHaveBeenCalled();
  });

  it('IDEMPOTENT: no live checkout → success no-op (no write, no audit event)', async () => {
    const taskData = {
      taskType: 'exampleAuditTask',
      taskId: 'group1',
      status: 'pending',
      checkoutDetails: null,
    };
    const { db, updates } = createMockDb(taskData);
    const onAuditEvent = vi.fn();
    const handler = createReleaseTaskHandler({ config: TEST_CONFIG, db, onAuditEvent });

    const result = await handler({ taskId: 'task1' }, { uid: 'admin1' });

    expect(result).toEqual({ success: true });
    expect(updates).toHaveLength(0);
    expect(onAuditEvent).not.toHaveBeenCalled();
  });

  it('writes no adminActivityLog doc (auditEvents is the canonical trail)', async () => {
    const taskData = {
      taskType: 'userReport',
      taskId: 'group1',
      status: 'checkedOut',
      checkoutDetails: { userId: 'admin1', checkedOutAt: Date.now() - 1000 },
    };
    const { db, sets } = createMockDb(taskData);
    const handler = createReleaseTaskHandler({ config: TEST_CONFIG, db });

    await handler({ taskId: 'task1' }, { uid: 'admin1' });

    expect(sets).toHaveLength(0);
  });

  it('invokes onAuditEvent inside the transaction with the correct payload', async () => {
    const taskData = {
      taskType: 'userReport',
      taskId: 'group1',
      status: 'checkedOut',
      checkoutDetails: { userId: 'admin1', checkedOutAt: Date.now() - 1000 },
    };
    const { db, transaction } = createMockDb(taskData);
    const onAuditEvent = vi.fn();
    const handler = createReleaseTaskHandler({ config: TEST_CONFIG, db, onAuditEvent });

    await handler({ taskId: 'task1' }, { uid: 'admin1' });

    expect(onAuditEvent).toHaveBeenCalledTimes(1);
    expect(onAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'release',
        adminUserId: 'admin1',
        taskType: 'userReport',
        taskId: 'group1',
      }),
      transaction,
    );
  });
});
