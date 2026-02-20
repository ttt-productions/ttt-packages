import { describe, it, expect, vi } from 'vitest';
import { createCheckoutNextImportantHandler } from '../src/server/createCheckoutNextImportantHandler';
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
    reasonScores: { spam: 5 },
    itemTypeMultipliers: { post: 1.0 },
    additionalReportBonus: 2,
    defaultReasonScore: 3,
    defaultItemTypeMultiplier: 1.0,
  },
};

interface MockDbOptions {
  pendingTask?: { id: string; data: Record<string, unknown> } | null;
  originalDocData?: Record<string, unknown> | null;
}

function createMockDb({ pendingTask = null, originalDocData = null }: MockDbOptions = {}) {
  let autoId = 0;

  const makeRef = (path: string) => ({
    id: path.split('/').pop()!,
    _path: path,
    _isDocRef: true,
  });

  const sets: Array<{ path: string; data: Record<string, unknown> }> = [];
  const updates: Array<{ path: string; data: Record<string, unknown> }> = [];

  const transaction = {
    get: vi.fn(async (refOrQuery: any) => {
      // Query object (collection with where/orderBy/limit)
      if (refOrQuery._isQuery) {
        if (!pendingTask) {
          return { empty: true, size: 0, docs: [] };
        }
        const docRef = { ...makeRef(`adminTasks/${pendingTask.id}`), ref: makeRef(`adminTasks/${pendingTask.id}`) };
        return {
          empty: false,
          size: 1,
          docs: [
            {
              id: pendingTask.id,
              exists: true,
              data: () => pendingTask.data,
              ref: docRef,
            },
          ],
        };
      }
      // Doc ref — check if it's the original doc
      if (refOrQuery._path && originalDocData !== null) {
        return { exists: true, data: () => originalDocData, id: refOrQuery.id };
      }
      return { exists: false, data: () => undefined, id: refOrQuery.id ?? 'unknown' };
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
    collection: vi.fn((colPath: string) => {
      const col = {
        _isQuery: true,
        _colPath: colPath,
        doc: vi.fn((id?: string) => {
          const docId = id ?? `auto_${++autoId}`;
          return makeRef(`${colPath}/${docId}`);
        }),
        where: vi.fn().mockReturnThis(),
        orderBy: vi.fn().mockReturnThis(),
        limit: vi.fn().mockReturnThis(),
      };
      return col;
    }),
    doc: vi.fn((path: string) => makeRef(path)),
    runTransaction: vi.fn(async (fn: any) => fn(transaction)),
  } as any;

  return { db, transaction, sets, updates };
}

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
    const { db } = createMockDb({ pendingTask: null });
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
      pendingTask: {
        id: 'task1',
        data: {
          taskType: 'userReport',
          taskId: 'group1',
          originalPath: 'activeReportGroups/group1',
          summary: '1 report for post',
          priority: 10,
        },
      },
      originalDocData: { reportedItemType: 'post' },
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
  });

  it('sets status=checkedOut with checkoutDetails on the task', async () => {
    const { db, updates } = createMockDb({
      pendingTask: {
        id: 'task1',
        data: {
          taskType: 'userReport',
          taskId: 'group1',
          originalPath: 'activeReportGroups/group1',
          summary: 'test',
          priority: 10,
        },
      },
    });
    const handler = createCheckoutNextImportantHandler({
      config: TEST_CONFIG,
      db,
      auth: { adminUserIds: ['admin1'] },
    });

    await handler({}, { uid: 'admin1', token: null });

    expect(updates).toHaveLength(1);
    expect(updates[0].data.status).toBe('checkedOut');
    expect(updates[0].data.checkoutDetails).toBeDefined();
    expect((updates[0].data.checkoutDetails as any).userId).toBe('admin1');
  });

  it('logs "checkout_next_important" with priority', async () => {
    const { db, sets } = createMockDb({
      pendingTask: {
        id: 'task1',
        data: {
          taskType: 'userReport',
          taskId: 'group1',
          originalPath: 'activeReportGroups/group1',
          summary: 'test',
          priority: 42,
        },
      },
    });
    const handler = createCheckoutNextImportantHandler({
      config: TEST_CONFIG,
      db,
      auth: { adminUserIds: ['admin1'] },
    });

    await handler({}, { uid: 'admin1', token: null });

    expect(sets).toHaveLength(1);
    expect(sets[0].data.action).toBe('checkout_next_important');
    expect(sets[0].data.priority).toBe(42);
  });

  it('uses adminUserIds fallback for admin verification', async () => {
    const { db } = createMockDb({
      pendingTask: {
        id: 'task1',
        data: {
          taskType: 'userReport',
          taskId: 'group1',
          originalPath: 'activeReportGroups/group1',
          summary: 'test',
          priority: 10,
        },
      },
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
    const { db } = createMockDb({ pendingTask: null });
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
      pendingTask: {
        id: 'task1',
        data: {
          taskType: 'userReport',
          taskId: 'group1',
          originalPath: 'activeReportGroups/group1',
          summary: 'test',
          priority: 10,
        },
      },
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
});
