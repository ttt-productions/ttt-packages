import { describe, it, expect, vi } from 'vitest';
import { recalculateAllPriorities } from '../src/server/recalculateAllPriorities';
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

interface TaskDoc {
  id: string;
  data: Record<string, unknown>;
  ref: any;
}

interface GroupDoc {
  path: string;
  data: Record<string, unknown>;
}

function createMockDb(tasks: TaskDoc[], groups: GroupDoc[]) {
  const groupStore = new Map<string, Record<string, unknown>>();
  for (const g of groups) {
    groupStore.set(g.path, g.data);
  }

  const batchUpdates: Array<{ path: string; data: Record<string, unknown> }> = [];
  const batchCommits: number[] = [];

  const makeDocRef = (path: string) => ({
    id: path.split('/').pop()!,
    _path: path,
    get: vi.fn(async () => {
      const data = groupStore.get(path);
      return { exists: !!data, data: () => data, id: path.split('/').pop()! };
    }),
  });

  const taskDocs = tasks.map((t) => ({
    id: t.id,
    data: () => t.data,
    ref: makeDocRef(`adminTasks/${t.id}`),
  }));

  let batchInstance: any;
  const makeBatch = () => {
    batchInstance = {
      update: vi.fn((ref: any, data: Record<string, unknown>) => {
        batchUpdates.push({ path: ref._path, data });
        return batchInstance;
      }),
      commit: vi.fn(async () => {
        batchCommits.push(1);
      }),
    };
    return batchInstance;
  };

  const db = {
    collection: vi.fn(() => ({
      where: vi.fn(() => ({
        get: vi.fn(async () => ({
          docs: taskDocs,
          empty: taskDocs.length === 0,
          size: taskDocs.length,
        })),
      })),
    })),
    doc: vi.fn((path: string) => makeDocRef(path)),
    batch: vi.fn(makeBatch),
  } as any;

  return { db, batchUpdates, batchCommits };
}

describe('recalculateAllPriorities', () => {
  it('returns { updated: 0, errors: 0 } when no pending tasks', async () => {
    const { db } = createMockDb([], []);
    const result = await recalculateAllPriorities({ config: TEST_CONFIG, db });
    expect(result).toEqual({ updated: 0, errors: 0 });
  });

  it('recalculates priority correctly using config multipliers', async () => {
    const { db, batchUpdates } = createMockDb(
      [
        {
          id: 'task1',
          data: { originalPath: 'activeReportGroups/group1' },
          ref: null,
        },
      ],
      [
        {
          path: 'activeReportGroups/group1',
          data: { reportedItemType: 'post', totalReports: 1, highestReasonScore: 10 },
        },
      ],
    );

    const result = await recalculateAllPriorities({ config: TEST_CONFIG, db });

    expect(result.updated).toBe(1);
    expect(result.errors).toBe(0);
    // harassment(10) * post(1.0) + 0 = 10
    expect(batchUpdates[0].data.priority).toBe(10);
  });

  it('applies bonus for multiple reports', async () => {
    const { db, batchUpdates } = createMockDb(
      [{ id: 'task1', data: { originalPath: 'activeReportGroups/group1' }, ref: null }],
      [
        {
          path: 'activeReportGroups/group1',
          data: { reportedItemType: 'profile', totalReports: 3, highestReasonScore: 20 },
        },
      ],
    );

    await recalculateAllPriorities({ config: TEST_CONFIG, db });

    // violence(20) * profile(1.5) + (3-1)*2 = 30 + 4 = 34
    expect(batchUpdates[0].data.priority).toBe(34);
  });

  it('returns { updated: 0, errors: 1 } when report group not found', async () => {
    const { db } = createMockDb(
      [{ id: 'task1', data: { originalPath: 'activeReportGroups/missing' }, ref: null }],
      [], // no groups in store
    );

    const result = await recalculateAllPriorities({ config: TEST_CONFIG, db });

    expect(result.updated).toBe(0);
    expect(result.errors).toBe(1);
  });

  it('processes multiple tasks and returns correct counts', async () => {
    const { db, batchUpdates } = createMockDb(
      [
        { id: 'task1', data: { originalPath: 'activeReportGroups/group1' }, ref: null },
        { id: 'task2', data: { originalPath: 'activeReportGroups/group2' }, ref: null },
      ],
      [
        {
          path: 'activeReportGroups/group1',
          data: { reportedItemType: 'post', totalReports: 1, highestReasonScore: 5 },
        },
        {
          path: 'activeReportGroups/group2',
          data: { reportedItemType: 'comment', totalReports: 2, highestReasonScore: 10 },
        },
      ],
    );

    const result = await recalculateAllPriorities({ config: TEST_CONFIG, db });

    expect(result.updated).toBe(2);
    expect(result.errors).toBe(0);
    expect(batchUpdates).toHaveLength(2);
  });

  it('commits batch after all updates', async () => {
    const { db, batchCommits } = createMockDb(
      [{ id: 'task1', data: { originalPath: 'activeReportGroups/group1' }, ref: null }],
      [
        {
          path: 'activeReportGroups/group1',
          data: { reportedItemType: 'post', totalReports: 1, highestReasonScore: 5 },
        },
      ],
    );

    await recalculateAllPriorities({ config: TEST_CONFIG, db });

    expect(batchCommits.length).toBeGreaterThanOrEqual(1);
  });

  it('uses defaultReasonScore when highestReasonScore is missing', async () => {
    const { db, batchUpdates } = createMockDb(
      [{ id: 'task1', data: { originalPath: 'activeReportGroups/group1' }, ref: null }],
      [
        {
          path: 'activeReportGroups/group1',
          data: { reportedItemType: 'post', totalReports: 1 }, // no highestReasonScore
        },
      ],
    );

    await recalculateAllPriorities({ config: TEST_CONFIG, db });

    // defaultReasonScore(3) * post(1.0) + 0 = 3
    expect(batchUpdates[0].data.priority).toBe(3);
  });

  it('increments errors for each missing group, still processes others', async () => {
    const { db, batchUpdates } = createMockDb(
      [
        { id: 'task1', data: { originalPath: 'activeReportGroups/missing' }, ref: null },
        { id: 'task2', data: { originalPath: 'activeReportGroups/group2' }, ref: null },
      ],
      [
        {
          path: 'activeReportGroups/group2',
          data: { reportedItemType: 'post', totalReports: 1, highestReasonScore: 5 },
        },
      ],
    );

    const result = await recalculateAllPriorities({ config: TEST_CONFIG, db });

    expect(result.updated).toBe(1);
    expect(result.errors).toBe(1);
    expect(batchUpdates).toHaveLength(1);
  });
});
