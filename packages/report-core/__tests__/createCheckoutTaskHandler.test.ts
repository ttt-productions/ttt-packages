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

/**
 * Mock db seeded with a single specific task at `adminTasks/task1` and its backing
 * `originalPath` doc. Records transaction updates so the test can assert the checkout
 * either happened (status→checkedOut) or was rejected before any write.
 */
function createMockDb(taskData: Record<string, unknown> | null) {
  let autoId = 0;
  const store = new Map<string, Record<string, unknown>>();
  if (taskData) store.set('adminTasks/task1', taskData);
  // The backing document the handler reads via originalPath.
  store.set('activeReportGroups/group1', { id: 'group1', status: 'pending' });

  const makeRef = (path: string) => ({ id: path.split('/').pop()!, _path: path });

  const updates: Array<{ path: string; data: Record<string, unknown> }> = [];
  const sets: Array<{ path: string; data: Record<string, unknown> }> = [];

  const transaction = {
    get: vi.fn(async (refOrQuery: any) => {
      const path = refOrQuery._path;
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
      doc: vi.fn((id?: string) => makeRef(`${colPath}/${id ?? `auto_${++autoId}`}`)),
    })),
    doc: vi.fn((path: string) => makeRef(path)),
    runTransaction: vi.fn(async (fn: any) => fn(transaction)),
  } as any;

  return { db, updates, sets };
}

const baseTask = {
  taskType: 'userReport',
  taskId: 'group1',
  originalPath: 'activeReportGroups/group1',
  summary: 'a report',
  priority: 5,
};

describe('createCheckoutTaskHandler — specificTaskId status guard', () => {
  it('checks out a pending task', async () => {
    const { db, updates } = createMockDb({ ...baseTask, status: 'pending' });
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
    const { db, updates } = createMockDb({ ...baseTask, status: 'completed' });
    const handler = createCheckoutTaskHandler({ config: TEST_CONFIG, db, auth: AUTH });

    await expect(
      handler({ taskType: 'userReport', specificTaskId: 'task1' }, { uid: 'admin1', token: {} }),
    ).rejects.toThrow('already been resolved');
    expect(updates).toHaveLength(0);
  });

  it('rejects a checkedOut task whose lock is still active', async () => {
    const { db } = createMockDb({
      ...baseTask,
      status: 'checkedOut',
      checkoutDetails: { userId: 'other', expiresAt: Date.now() + 60_000 },
    });
    const handler = createCheckoutTaskHandler({ config: TEST_CONFIG, db, auth: AUTH });

    await expect(
      handler({ taskType: 'userReport', specificTaskId: 'task1' }, { uid: 'admin1', token: {} }),
    ).rejects.toThrow('already checked out by another admin');
  });

  it('allows stealing a checkedOut task whose lock has EXPIRED', async () => {
    const { db, updates } = createMockDb({
      ...baseTask,
      status: 'checkedOut',
      checkoutDetails: { userId: 'other', expiresAt: Date.now() - 60_000 },
    });
    const handler = createCheckoutTaskHandler({ config: TEST_CONFIG, db, auth: AUTH });

    const result = (await handler(
      { taskType: 'userReport', specificTaskId: 'task1' },
      { uid: 'admin1', token: {} },
    )) as { success: boolean };
    expect(result.success).toBe(true);
    expect(updates.some((u) => u.path === 'adminTasks/task1' && u.data.status === 'checkedOut')).toBe(true);
  });

  it('allows stealing an expired workLater task', async () => {
    const { db, updates } = createMockDb({
      ...baseTask,
      status: 'workLater',
      checkoutDetails: { userId: 'other', expiresAt: Date.now() - 1 },
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
    const { db } = createMockDb(null);
    const handler = createCheckoutTaskHandler({ config: TEST_CONFIG, db, auth: AUTH });

    await expect(
      handler({ taskType: 'userReport', specificTaskId: 'task1' }, { uid: 'admin1', token: {} }),
    ).rejects.toThrow('could not be found');
  });
});
