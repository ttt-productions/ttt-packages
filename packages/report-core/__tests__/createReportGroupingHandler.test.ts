import { describe, it, expect, vi } from 'vitest';
import { createReportGroupingHandler } from '../src/server/createReportGroupingHandler';
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
    reasonScores: { spam: 5, harassment: 10, violence: 20, illegal: 30 },
    itemTypeMultipliers: { post: 1.0 },
    additionalReportBonus: 2,
    defaultReasonScore: 3,
    defaultItemTypeMultiplier: 1.0,
  },
};

const mockFieldValue = {
  increment: vi.fn((n: number) => `__increment_${n}__`),
};

interface MockDbOptions {
  existingGroup?: Record<string, unknown> | null;
}

function createMockDb({ existingGroup = null }: MockDbOptions = {}) {
  const store = new Map<string, Record<string, unknown>>();
  if (existingGroup) {
    store.set('activeReportGroups/group1', existingGroup);
  }

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
        const docId = id ?? 'auto_1';
        return makeRef(`${colPath}/${docId}`);
      }),
    })),
    runTransaction: vi.fn(async (fn: any) => fn(transaction)),
  } as any;

  return { db, sets, updates };
}

describe('createReportGroupingHandler', () => {
  it('factory returns a function', () => {
    const handler = createReportGroupingHandler({
      config: TEST_CONFIG,
      db: {} as any,
      fieldValue: mockFieldValue,
      groupingStrategy: () => 'group1',
    });
    expect(typeof handler).toBe('function');
  });

  it('creates new report group on first report', async () => {
    const { db, sets } = createMockDb(); // no existing group
    const handler = createReportGroupingHandler({
      config: TEST_CONFIG,
      db,
      fieldValue: mockFieldValue,
      groupingStrategy: () => 'group1',
    });

    await handler(
      {
        reason: 'spam',
        reportedItemId: 'item1',
        reportedItemType: 'post',
        reportedUserId: 'user1',
        reportedUsername: 'alice',
      },
      'report1',
    );

    expect(sets).toHaveLength(1);
    expect(sets[0].data.totalReports).toBe(1);
    expect(sets[0].data.status).toBe('pending');
    expect(sets[0].data.highestReasonScore).toBe(5); // spam = 5
  });

  it('sets correct fields on new group', async () => {
    const { db, sets } = createMockDb();
    const handler = createReportGroupingHandler({
      config: TEST_CONFIG,
      db,
      fieldValue: mockFieldValue,
      groupingStrategy: () => 'group1',
    });

    await handler(
      {
        reason: 'harassment',
        reportedItemId: 'item1',
        reportedItemType: 'post',
        reportedUserId: 'user1',
        reportedUsername: 'alice',
      },
      'report1',
    );

    const groupData = sets[0].data;
    expect(groupData.groupKey).toBe('group1');
    expect(groupData.reportedItemId).toBe('item1');
    expect(groupData.reportedItemType).toBe('post');
    expect(groupData.reportedUserId).toBe('user1');
    expect(groupData.reportedUsername).toBe('alice');
  });

  it('increments totalReports when group exists', async () => {
    const existingGroup = {
      groupKey: 'group1',
      totalReports: 2,
      highestReasonScore: 5,
      reportedItemType: 'post',
    };
    const { db, updates } = createMockDb({ existingGroup });
    const handler = createReportGroupingHandler({
      config: TEST_CONFIG,
      db,
      fieldValue: mockFieldValue,
      groupingStrategy: () => 'group1',
    });

    await handler({ reason: 'spam', reportedItemId: 'item1', reportedItemType: 'post' }, 'report2');

    expect(updates).toHaveLength(1);
    // Uses fieldValue.increment for totalReports
    expect(updates[0].data.totalReports).toBe('__increment_1__');
  });

  it('updates highestReasonScore when new reason is higher', async () => {
    const existingGroup = {
      groupKey: 'group1',
      totalReports: 1,
      highestReasonScore: 5, // spam
    };
    const { db, updates } = createMockDb({ existingGroup });
    const handler = createReportGroupingHandler({
      config: TEST_CONFIG,
      db,
      fieldValue: mockFieldValue,
      groupingStrategy: () => 'group1',
    });

    await handler({ reason: 'violence', reportedItemId: 'item1', reportedItemType: 'post' }, 'report2');

    // violence=20 > spam=5, so highestReasonScore should be 20
    expect(updates[0].data.highestReasonScore).toBe(20);
  });

  it('keeps existing highestReasonScore when new reason is lower', async () => {
    const existingGroup = {
      groupKey: 'group1',
      totalReports: 2,
      highestReasonScore: 20, // violence
    };
    const { db, updates } = createMockDb({ existingGroup });
    const handler = createReportGroupingHandler({
      config: TEST_CONFIG,
      db,
      fieldValue: mockFieldValue,
      groupingStrategy: () => 'group1',
    });

    await handler({ reason: 'spam', reportedItemId: 'item1', reportedItemType: 'post' }, 'report3');

    // spam=5 < violence=20, so highestReasonScore stays 20
    expect(updates[0].data.highestReasonScore).toBe(20);
  });

  it('uses defaultReasonScore for unknown reason', async () => {
    const { db, sets } = createMockDb();
    const handler = createReportGroupingHandler({
      config: TEST_CONFIG,
      db,
      fieldValue: mockFieldValue,
      groupingStrategy: () => 'group1',
    });

    await handler({ reason: 'unknown_reason', reportedItemId: 'item1', reportedItemType: 'post' }, 'r1');

    expect(sets[0].data.highestReasonScore).toBe(3); // defaultReasonScore
  });

  it('skips when reportData is falsy', async () => {
    const { db } = createMockDb();
    const db_spy = vi.spyOn(db, 'runTransaction');
    const handler = createReportGroupingHandler({
      config: TEST_CONFIG,
      db,
      fieldValue: mockFieldValue,
      groupingStrategy: () => 'group1',
    });

    await handler(null as any, 'r1');

    expect(db_spy).not.toHaveBeenCalled();
  });

  it('skips when groupingStrategy returns empty string', async () => {
    const { db } = createMockDb();
    const db_spy = vi.spyOn(db, 'runTransaction');
    const handler = createReportGroupingHandler({
      config: TEST_CONFIG,
      db,
      fieldValue: mockFieldValue,
      groupingStrategy: () => '', // returns empty string
    });

    await handler({ reason: 'spam', reportedItemId: 'item1', reportedItemType: 'post' }, 'r1');

    expect(db_spy).not.toHaveBeenCalled();
  });

  it('uses groupingStrategy result as the group doc ID', async () => {
    const { db } = createMockDb();
    let capturedGroupId: string | undefined;

    const mockDb = {
      ...db,
      collection: vi.fn((colPath: string) => ({
        doc: vi.fn((id?: string) => {
          capturedGroupId = id;
          return { id: id!, _path: `${colPath}/${id}` };
        }),
      })),
      runTransaction: vi.fn(async (fn: any) => {
        // Return a group that doesn't exist
        const t = {
          get: vi.fn(async () => ({ exists: false, data: () => undefined })),
          set: vi.fn().mockReturnThis(),
          update: vi.fn().mockReturnThis(),
        };
        return fn(t);
      }),
    } as any;

    const handler = createReportGroupingHandler({
      config: TEST_CONFIG,
      db: mockDb,
      fieldValue: mockFieldValue,
      groupingStrategy: (report) => `item_${report.reportedItemId}`,
    });

    await handler({ reason: 'spam', reportedItemId: 'item42', reportedItemType: 'post' }, 'r1');

    expect(capturedGroupId).toBe('item_item42');
  });
});
