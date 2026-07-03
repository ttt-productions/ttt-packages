import { describe, it, expect, vi } from 'vitest';
import { createCheckinTaskHandler } from '../src/server/createCheckinTaskHandler';
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
    reasonScores: { spam: 5, harassment: 10 },
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

describe('createCheckinTaskHandler', () => {
  it('factory returns a function', () => {
    const handler = createCheckinTaskHandler({ config: TEST_CONFIG, db: {} as any });
    expect(typeof handler).toBe('function');
  });

  it('resolved checkin: sets status=completed, clears checkoutDetails, sets completedAt', async () => {
    const now = Date.now();
    const taskData = {
      taskType: 'userReport',
      taskId: 'group1',
      status: 'checkedOut',
      checkoutDetails: { userId: 'admin1', checkedOutAt: now - 5 * 60_000 },
    };
    const { db, updates } = createMockDb(taskData);
    const handler = createCheckinTaskHandler({ config: TEST_CONFIG, db });

    const result = await handler({ taskId: 'task1', resolved: true }, { uid: 'admin1' });

    expect(result).toEqual({ success: true });
    expect(updates).toHaveLength(1);
    expect(updates[0].data.status).toBe('completed');
    expect(updates[0].data.checkoutDetails).toBeNull();
    expect(typeof updates[0].data.completedAt).toBe('number');
  });

  it('unresolved checkin: sets status=pending, clears checkoutDetails, completedAt=null', async () => {
    const now = Date.now();
    const taskData = {
      taskType: 'userReport',
      taskId: 'group1',
      status: 'checkedOut',
      checkoutDetails: { userId: 'admin1', checkedOutAt: now - 10 * 60_000 },
    };
    const { db, updates } = createMockDb(taskData);
    const handler = createCheckinTaskHandler({ config: TEST_CONFIG, db });

    const result = await handler({ taskId: 'task1', resolved: false }, { uid: 'admin1' });

    expect(result).toEqual({ success: true });
    expect(updates[0].data.status).toBe('pending');
    expect(updates[0].data.checkoutDetails).toBeNull();
    expect(updates[0].data.completedAt).toBeNull();
  });

  it('returns idempotent success when task not found (already resolved by another writer)', async () => {
    const { db } = createMockDb(null);
    const handler = createCheckinTaskHandler({ config: TEST_CONFIG, db });

    const result = await handler({ taskId: 'task1', resolved: true }, { uid: 'admin1' });

    expect(result).toEqual({ success: true, alreadyResolved: true });
  });

  it('does not write activity log or audit event when task not found', async () => {
    const { db, sets, updates } = createMockDb(null);
    const onAuditEvent = vi.fn();
    const handler = createCheckinTaskHandler({ config: TEST_CONFIG, db, onAuditEvent });

    await handler({ taskId: 'task1', resolved: true }, { uid: 'admin1' });

    expect(updates).toHaveLength(0);
    expect(sets).toHaveLength(0);
    expect(onAuditEvent).not.toHaveBeenCalled();
  });

  it('throws when user does not have task checked out', async () => {
    const taskData = {
      taskType: 'userReport',
      taskId: 'group1',
      status: 'checkedOut',
      checkoutDetails: { userId: 'other-admin', checkedOutAt: Date.now() - 1000 },
    };
    const { db } = createMockDb(taskData);
    const handler = createCheckinTaskHandler({ config: TEST_CONFIG, db });

    await expect(
      handler({ taskId: 'task1', resolved: true }, { uid: 'admin1' }),
    ).rejects.toThrow('do not have this task checked out');
  });

  it('writes no adminActivityLog doc (auditEvents is the canonical trail)', async () => {
    const now = Date.now();
    const taskData = {
      taskType: 'userReport',
      taskId: 'group1',
      status: 'checkedOut',
      checkoutDetails: { userId: 'admin1', checkedOutAt: now - 1000 },
    };
    const { db, sets } = createMockDb(taskData);
    const handler = createCheckinTaskHandler({ config: TEST_CONFIG, db });

    await handler({ taskId: 'task1', resolved: true }, { uid: 'admin1' });

    expect(sets).toHaveLength(0);
  });

  it('audits action "checkin_unresolved" when not resolved', async () => {
    const now = Date.now();
    const taskData = {
      taskType: 'userReport',
      taskId: 'group1',
      status: 'checkedOut',
      checkoutDetails: { userId: 'admin1', checkedOutAt: now - 1000 },
    };
    const { db } = createMockDb(taskData);
    const onAuditEvent = vi.fn();
    const handler = createCheckinTaskHandler({ config: TEST_CONFIG, db, onAuditEvent });

    await handler({ taskId: 'task1', resolved: false }, { uid: 'admin1' });

    expect(onAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'checkin_unresolved' }),
      expect.anything(),
    );
  });

  it('audits timeSpentMinutes based on checkedOutAt', async () => {
    const now = Date.now();
    const checkedOutAt = now - 10 * 60_000; // 10 minutes ago
    const taskData = {
      taskType: 'userReport',
      taskId: 'group1',
      status: 'checkedOut',
      checkoutDetails: { userId: 'admin1', checkedOutAt },
    };
    const { db } = createMockDb(taskData);
    const onAuditEvent = vi.fn();
    const handler = createCheckinTaskHandler({ config: TEST_CONFIG, db, onAuditEvent });

    await handler({ taskId: 'task1', resolved: true }, { uid: 'admin1' });

    const payload = onAuditEvent.mock.calls[0][0] as { timeSpentMinutes: number };
    expect(typeof payload.timeSpentMinutes).toBe('number');
    expect(payload.timeSpentMinutes).toBeGreaterThanOrEqual(9);
  });

  it('invokes onAuditEvent inside the transaction with the correct payload', async () => {
    const now = Date.now();
    const taskData = {
      taskType: 'userReport',
      taskId: 'group1',
      status: 'checkedOut',
      checkoutDetails: { userId: 'admin1', checkedOutAt: now - 5 * 60_000 },
    };
    const { db, transaction } = createMockDb(taskData);
    const onAuditEvent = vi.fn();
    const handler = createCheckinTaskHandler({ config: TEST_CONFIG, db, onAuditEvent });

    await handler({ taskId: 'task1', resolved: true, resolution: 'looks fine' }, { uid: 'admin1' });

    expect(onAuditEvent).toHaveBeenCalledTimes(1);
    expect(onAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'checkin_resolved',
        adminUserId: 'admin1',
        taskType: 'userReport',
        taskId: 'group1',
        resolution: 'looks fine',
        timeSpentMinutes: expect.any(Number),
      }),
      transaction,
    );
  });

});
