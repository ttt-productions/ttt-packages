import { describe, it, expect, vi } from 'vitest';
import { createReleaseTaskHandler } from '../src/server/createReleaseTaskHandler';
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

  it('throws when task not found', async () => {
    const { db } = createMockDb(null);
    const handler = createReleaseTaskHandler({ config: TEST_CONFIG, db });

    await expect(handler({ taskId: 'task1' }, { uid: 'admin1' })).rejects.toThrow('Task not found');
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
