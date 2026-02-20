import { describe, it, expect, vi } from 'vitest';
import { createCheckinTaskHandler } from '../src/server/createCheckinTaskHandler';
import type { ServerReportCoreConfig } from '../src/server/types';

const TEST_CONFIG: ServerReportCoreConfig = {
  collections: {
    reports: 'contentReports',
    reportGroups: 'activeReportGroups',
    adminTasks: 'adminTasks',
    activityLog: 'adminActivityLog',
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

  it('throws when task not found', async () => {
    const { db } = createMockDb(null);
    const handler = createCheckinTaskHandler({ config: TEST_CONFIG, db });

    await expect(
      handler({ taskId: 'task1', resolved: true }, { uid: 'admin1' }),
    ).rejects.toThrow('task could not be found');
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

  it('logs activity with action "checkin_resolved" when resolved', async () => {
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

    expect(sets).toHaveLength(1);
    expect(sets[0].data.action).toBe('checkin_resolved');
  });

  it('logs activity with action "checkin_unresolved" when not resolved', async () => {
    const now = Date.now();
    const taskData = {
      taskType: 'userReport',
      taskId: 'group1',
      status: 'checkedOut',
      checkoutDetails: { userId: 'admin1', checkedOutAt: now - 1000 },
    };
    const { db, sets } = createMockDb(taskData);
    const handler = createCheckinTaskHandler({ config: TEST_CONFIG, db });

    await handler({ taskId: 'task1', resolved: false }, { uid: 'admin1' });

    expect(sets[0].data.action).toBe('checkin_unresolved');
  });

  it('logs timeSpentMinutes based on checkedOutAt', async () => {
    const now = Date.now();
    const checkedOutAt = now - 10 * 60_000; // 10 minutes ago
    const taskData = {
      taskType: 'userReport',
      taskId: 'group1',
      status: 'checkedOut',
      checkoutDetails: { userId: 'admin1', checkedOutAt },
    };
    const { db, sets } = createMockDb(taskData);
    const handler = createCheckinTaskHandler({ config: TEST_CONFIG, db });

    await handler({ taskId: 'task1', resolved: true }, { uid: 'admin1' });

    expect(typeof sets[0].data.timeSpentMinutes).toBe('number');
    expect(sets[0].data.timeSpentMinutes).toBeGreaterThanOrEqual(9);
  });

  it('uses getUserProfile displayName in activity log', async () => {
    const now = Date.now();
    const taskData = {
      taskType: 'userReport',
      taskId: 'group1',
      status: 'checkedOut',
      checkoutDetails: { userId: 'admin1', checkedOutAt: now - 1000 },
    };
    const { db, sets } = createMockDb(taskData);
    const getUserProfile = vi.fn().mockResolvedValue({ displayName: 'Alice Admin' });
    const handler = createCheckinTaskHandler({ config: TEST_CONFIG, db, getUserProfile });

    await handler({ taskId: 'task1', resolved: true }, { uid: 'admin1' });

    expect(sets[0].data.adminDisplayName).toBe('Alice Admin');
  });

  it('falls back to "Admin" when getUserProfile returns null', async () => {
    const now = Date.now();
    const taskData = {
      taskType: 'userReport',
      taskId: 'group1',
      status: 'checkedOut',
      checkoutDetails: { userId: 'admin1', checkedOutAt: now - 1000 },
    };
    const { db, sets } = createMockDb(taskData);
    const getUserProfile = vi.fn().mockResolvedValue(null);
    const handler = createCheckinTaskHandler({ config: TEST_CONFIG, db, getUserProfile });

    await handler({ taskId: 'task1', resolved: true }, { uid: 'admin1' });

    expect(sets[0].data.adminDisplayName).toBe('Admin');
  });
});
