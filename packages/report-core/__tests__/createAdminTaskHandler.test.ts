import { describe, it, expect, vi } from 'vitest';
import { createAdminTaskHandler } from '../src/server/createAdminTaskHandler';
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

    await handler(
      { reportedItemType: 'post', totalReports: 1, highestReasonScore: 10, reportedUsername: 'alice' },
      'group1',
    );

    expect(setFn).toHaveBeenCalledTimes(1);
    const args = setFn.mock.calls[0][0];
    expect(args.taskType).toBe('userReport');
    expect(args.taskId).toBe('group1');
    expect(args.originalPath).toBe('activeReportGroups/group1');
    expect(args.status).toBe('pending');
    expect(args.checkoutDetails).toBeNull();
  });

  it('calculates priority: reasonScore * multiplier + (reports-1) * bonus', async () => {
    const { db, setFn } = makeMockDb();
    const handler = createAdminTaskHandler({ config: TEST_CONFIG, db });

    // harassment(10) * post(1.0) + 0*2 = 10
    await handler({ reportedItemType: 'post', totalReports: 1, highestReasonScore: 10 }, 'g1');
    expect(setFn.mock.calls[0][0].priority).toBe(10);
  });

  it('applies item type multiplier correctly', async () => {
    const { db, setFn } = makeMockDb();
    const handler = createAdminTaskHandler({ config: TEST_CONFIG, db });

    // violence(20) * profile(1.5) + 2*2 = 34
    await handler({ reportedItemType: 'profile', totalReports: 3, highestReasonScore: 20 }, 'g2');
    expect(setFn.mock.calls[0][0].priority).toBe(34);
  });

  it('uses defaultItemTypeMultiplier for unknown item types', async () => {
    const { db, setFn } = makeMockDb();
    const handler = createAdminTaskHandler({ config: TEST_CONFIG, db });

    // harassment(10) * default(1.0) + 0 = 10
    await handler({ reportedItemType: 'unknown_type', totalReports: 1, highestReasonScore: 10 }, 'g3');
    expect(setFn.mock.calls[0][0].priority).toBe(10);
  });

  it('uses defaultReasonScore when highestReasonScore is missing', async () => {
    const { db, setFn } = makeMockDb();
    const handler = createAdminTaskHandler({ config: TEST_CONFIG, db });

    // defaultReasonScore(3) * post(1.0) + 0 = 3
    await handler({ reportedItemType: 'post', totalReports: 1 }, 'g4');
    expect(setFn.mock.calls[0][0].priority).toBe(3);
  });

  it('generates summary with "1 report" (singular) for single report with username', async () => {
    const { db, setFn } = makeMockDb();
    const handler = createAdminTaskHandler({ config: TEST_CONFIG, db });

    await handler(
      { reportedItemType: 'post', totalReports: 1, highestReasonScore: 5, reportedUsername: 'alice' },
      'g5',
    );
    expect(setFn.mock.calls[0][0].summary).toBe('1 report for user alice');
  });

  it('generates summary with "reports" (plural) for count > 1', async () => {
    const { db, setFn } = makeMockDb();
    const handler = createAdminTaskHandler({ config: TEST_CONFIG, db });

    await handler(
      { reportedItemType: 'post', totalReports: 3, highestReasonScore: 5, reportedUsername: 'bob' },
      'g6',
    );
    expect(setFn.mock.calls[0][0].summary).toBe('3 reports for user bob');
  });

  it('uses item type in summary when no username', async () => {
    const { db, setFn } = makeMockDb();
    const handler = createAdminTaskHandler({ config: TEST_CONFIG, db });

    await handler({ reportedItemType: 'post', totalReports: 2, highestReasonScore: 5 }, 'g7');
    expect(setFn.mock.calls[0][0].summary).toBe('2 reports for post');
  });

  it('uses correct adminTask doc ID: "userReport-{groupId}"', async () => {
    const { db, docFn } = makeMockDb();
    const handler = createAdminTaskHandler({ config: TEST_CONFIG, db });

    await handler({ reportedItemType: 'post', totalReports: 1, highestReasonScore: 5 }, 'myGroupId');
    expect(docFn).toHaveBeenCalledWith('userReport-myGroupId');
  });

  it('skips when groupData is falsy', async () => {
    const { db, setFn } = makeMockDb();
    const handler = createAdminTaskHandler({ config: TEST_CONFIG, db });

    await handler(null as any, 'g8');
    expect(setFn).not.toHaveBeenCalled();
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
