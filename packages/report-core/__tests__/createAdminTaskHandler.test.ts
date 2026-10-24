import { describe, it, expect, vi } from 'vitest';
import { createAdminTaskHandler } from '../src/server/createAdminTaskHandler.js';
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
    reasonScores: { spam: 5, harassment: 10, violence: 20, illegal: 30 },
    itemTypeMultipliers: { post: 1.0, comment: 0.8, profile: 1.5 },
    additionalReportBonus: 2,
    defaultReasonScore: 3,
    defaultItemTypeMultiplier: 1.0,
  },
};

function makeMockDb() {
  const setFn = vi.fn().mockResolvedValue(undefined);
  const docFn = vi.fn().mockReturnValue({ set: setFn });
  const collectionFn = vi.fn().mockReturnValue({ doc: docFn });
  const db = { collection: collectionFn } as any;
  return { db, setFn, docFn, collectionFn };
}

describe('createAdminTaskHandler', () => {
  it('factory returns a function', () => {
    const handler = createAdminTaskHandler({ config: TEST_CONFIG, db: {} as any });
    expect(typeof handler).toBe('function');
  });

  it('creates adminTask doc with taskType, taskId, originalPath, status, checkoutDetails', async () => {
    const { db, setFn } = makeMockDb();
    const handler = createAdminTaskHandler({ config: TEST_CONFIG, db });

    await handler({ reportedItemType: 'post', totalReports: 1, highestReasonScore: 10 }, 'group1');

    expect(setFn).toHaveBeenCalledTimes(1);
    const args = setFn.mock.calls[0][0];
    expect(args.taskType).toBe('userReport');
    expect(args.taskId).toBe('group1');
    expect(args.originalPath).toBe('testReportGroups/group1');
    expect(args.status).toBe('pending');
    expect(args.checkoutDetails).toBeNull();
  });

  it('calculates priority: reasonScore * multiplier + (reports-1) * bonus', async () => {
    const { db, setFn } = makeMockDb();
    const handler = createAdminTaskHandler({ config: TEST_CONFIG, db });

    await handler({ reportedItemType: 'post', totalReports: 1, highestReasonScore: 10 }, 'g1');
    expect(setFn.mock.calls[0][0].priority).toBe(10);
  });

  it('applies item type multiplier correctly', async () => {
    const { db, setFn } = makeMockDb();
    const handler = createAdminTaskHandler({ config: TEST_CONFIG, db });

    await handler({ reportedItemType: 'profile', totalReports: 3, highestReasonScore: 20 }, 'g2');
    expect(setFn.mock.calls[0][0].priority).toBe(34);
  });

  it('uses defaultItemTypeMultiplier for unknown item types', async () => {
    const { db, setFn } = makeMockDb();
    const handler = createAdminTaskHandler({ config: TEST_CONFIG, db });

    await handler(
      { reportedItemType: 'unknown_type', totalReports: 1, highestReasonScore: 10 },
      'g3',
    );
    expect(setFn.mock.calls[0][0].priority).toBe(10);
  });

  it('uses defaultReasonScore when highestReasonScore is missing', async () => {
    const { db, setFn } = makeMockDb();
    const handler = createAdminTaskHandler({ config: TEST_CONFIG, db });

    await handler({ reportedItemType: 'post', totalReports: 1 }, 'g4');
    expect(setFn.mock.calls[0][0].priority).toBe(3);
  });

  it('writes the summary the app describes from the group report count and item type', async () => {
    const { db, setFn } = makeMockDb();
    const describeUserReportTask = vi.fn(() => 'app wording');
    const handler = createAdminTaskHandler({
      config: { ...TEST_CONFIG, describeUserReportTask },
      db,
    });

    await handler({ reportedItemType: 'post', totalReports: 3, highestReasonScore: 5 }, 'g6');
    expect(describeUserReportTask).toHaveBeenCalledWith({
      totalReports: 3,
      reportedItemType: 'post',
    });
    expect(setFn.mock.calls[0][0].summary).toBe('app wording');
  });

  it('describes a group with no stored count as one report', async () => {
    const { db, setFn } = makeMockDb();
    const handler = createAdminTaskHandler({ config: TEST_CONFIG, db });

    await handler({ reportedItemType: 'post' }, 'g7');
    expect(setFn.mock.calls[0][0].summary).toBe('post reported 1 times');
  });

  it('uses correct adminTask doc ID: "userReport-{groupId}"', async () => {
    const { db, docFn } = makeMockDb();
    const handler = createAdminTaskHandler({ config: TEST_CONFIG, db });

    await handler(
      { reportedItemType: 'post', totalReports: 1, highestReasonScore: 5 },
      'myGroupId',
    );
    expect(docFn).toHaveBeenCalledWith('userReport-myGroupId');
  });

  it('skips when groupData is falsy', async () => {
    const { db, setFn } = makeMockDb();
    const handler = createAdminTaskHandler({ config: TEST_CONFIG, db });

    await handler(null as any, 'g8');
    expect(setFn).not.toHaveBeenCalled();
  });

  it('persists report identity fields so admin queues can filter/scope by reported user + item', async () => {
    const { db, setFn } = makeMockDb();
    const handler = createAdminTaskHandler({ config: TEST_CONFIG, db });

    await handler(
      {
        reportedItemType: 'post',
        totalReports: 1,
        highestReasonScore: 10,
        reportedUserId: 'owner-1',
        reportedItemId: 'post-1',
        parentItemId: 'thread-1',
      },
      'g-identity',
    );
    const args = setFn.mock.calls[0][0];
    expect(args.reportedUserId).toBe('owner-1');
    expect(args.reportedItemType).toBe('post');
    expect(args.reportedItemId).toBe('post-1');
    expect(args.parentItemId).toBe('thread-1');
  });

  it('coalesces missing report identity fields to null (Admin SDK rejects undefined)', async () => {
    const { db, setFn } = makeMockDb();
    const handler = createAdminTaskHandler({ config: TEST_CONFIG, db });

    await handler({ reportedItemType: 'post', totalReports: 1, highestReasonScore: 10 }, 'g-null');
    const args = setFn.mock.calls[0][0];
    expect(args.reportedUserId).toBeNull();
    expect(args.reportedItemId).toBeNull();
    expect(args.parentItemId).toBeNull();
    expect(args.reportedItemType).toBe('post');
  });

  it('includes createdAt and lastUpdatedAt timestamps', async () => {
    const { db, setFn } = makeMockDb();
    const handler = createAdminTaskHandler({ config: TEST_CONFIG, db });

    await handler({ reportedItemType: 'post', totalReports: 1, highestReasonScore: 5 }, 'g9');
    const args = setFn.mock.calls[0][0];
    expect(typeof args.createdAt).toBe('number');
    expect(typeof args.lastUpdatedAt).toBe('number');
  });
});
