import { describe, it, expect, vi } from 'vitest';
import { buildUserReportAdminTaskDoc } from '../src/server/buildUserReportAdminTaskDoc';
import { createAdminTaskHandler } from '../src/server/createAdminTaskHandler';
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
    reasonScores: { spam: 5, harassment: 10, violence: 20, illegal: 30 },
    itemTypeMultipliers: { post: 1.0, comment: 0.8, profile: 1.5 },
    additionalReportBonus: 2,
    defaultReasonScore: 3,
    defaultItemTypeMultiplier: 1.0,
  },
};

describe('buildUserReportAdminTaskDoc (pure builder)', () => {
  it('is pure: identical inputs produce identical outputs, and the passed `now` is used verbatim', () => {
    const args = {
      config: TEST_CONFIG,
      groupData: { reportedItemType: 'post', totalReports: 2, highestReasonScore: 10 },
      groupId: 'g1',
      now: 42,
    };
    const a = buildUserReportAdminTaskDoc(args);
    const b = buildUserReportAdminTaskDoc(args);
    expect(a).toEqual(b);
    expect(a.doc.createdAt).toBe(42);
    expect(a.doc.lastUpdatedAt).toBe(42);
  });

  it('owns the id convention and originalPath', () => {
    const { adminTaskId, doc } = buildUserReportAdminTaskDoc({
      config: TEST_CONFIG,
      groupData: { reportedItemType: 'post', totalReports: 1, highestReasonScore: 5 },
      groupId: 'myGroup',
      now: 1,
    });
    expect(adminTaskId).toBe('userReport-myGroup');
    expect(doc.taskId).toBe('myGroup');
    expect(doc.originalPath).toBe('activeReportGroups/myGroup');
  });

  it('owns the priority formula: reasonScore * itemTypeMultiplier + (reports-1) * bonus', () => {
    const { doc } = buildUserReportAdminTaskDoc({
      config: TEST_CONFIG,
      groupData: { reportedItemType: 'profile', totalReports: 3, highestReasonScore: 20 },
      groupId: 'g2',
      now: 1,
    });
    // violence(20) * profile(1.5) + 2*2 = 34
    expect(doc.priority).toBe(34);
  });

  it('coalesces missing report-identity fields to null (Admin SDK rejects undefined)', () => {
    const { doc } = buildUserReportAdminTaskDoc({
      config: TEST_CONFIG,
      groupData: { reportedItemType: 'post', totalReports: 1, highestReasonScore: 5 },
      groupId: 'g3',
      now: 1,
    });
    expect(doc.reportedUserId).toBeNull();
    expect(doc.reportedItemId).toBeNull();
    expect(doc.parentItemId).toBeNull();
  });

  it('createAdminTaskHandler writes EXACTLY the built doc — the builder is the one owner of the shape', async () => {
    const setFn = vi.fn().mockResolvedValue(undefined);
    const docFn = vi.fn().mockReturnValue({ set: setFn });
    const db = { collection: vi.fn().mockReturnValue({ doc: docFn }) } as never;
    const handler = createAdminTaskHandler({ config: TEST_CONFIG, db });

    const groupData = {
      reportedItemType: 'post',
      totalReports: 2,
      highestReasonScore: 10,
      reportedUserId: 'owner-1',
      reportedItemId: 'post-1',
      parentItemId: null,
    };
    await handler(groupData, 'g-equiv');

    const written = setFn.mock.calls[0][0];
    const { doc } = buildUserReportAdminTaskDoc({
      config: TEST_CONFIG,
      groupData,
      groupId: 'g-equiv',
      now: written.createdAt, // align the only non-deterministic input
    });
    expect(written).toEqual(doc);
    expect(docFn).toHaveBeenCalledWith('userReport-g-equiv');
  });
});
