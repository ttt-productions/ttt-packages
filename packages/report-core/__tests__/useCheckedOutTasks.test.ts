// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import React from 'react';

const mocks = vi.hoisted(() => ({
  useFirestoreCollection: vi.fn(),
  whereFn: vi.fn((field: string, op: string, value: unknown) => ({ field, op, value })),
  orderByFn: vi.fn((field: string, dir: string) => ({ field, dir })),
}));

vi.mock('@ttt-productions/query-core/react', () => ({
  useFirestoreCollection: mocks.useFirestoreCollection,
}));
vi.mock('firebase/firestore', () => ({
  where: mocks.whereFn,
  orderBy: mocks.orderByFn,
}));

import { useCheckedOutTasks } from '../src/hooks/useCheckedOutTasks.js';
import { ReportCoreProvider } from '../src/context/ReportCoreProvider.js';
import type { ReportCoreConfig } from '../src/config.js';

const config = {
  collections: {
    reports: 'contentReports',
    reportGroups: 'activeReportGroups',
    adminTasks: 'adminTasks',
    activityLog: 'adminActivityLog',
  },
  reportableItems: {},
  reportReasons: [],
  priorityConfig: {},
  taskQueues: {},
  maxReportCommentLength: 4000,
} as unknown as ReportCoreConfig;

function wrapper({ children }: { children: React.ReactNode }) {
  return React.createElement(ReportCoreProvider, { config, callFunction: vi.fn() as never, children });
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.useFirestoreCollection.mockReturnValue({ data: [], isLoading: false, error: null } as never);
});

describe('useCheckedOutTasks', () => {
  it('subscribes (realtime, no poll) to the admin tasks scoped to the user', () => {
    renderHook(() => useCheckedOutTasks('admin-1'), { wrapper });
    const opts = mocks.useFirestoreCollection.mock.calls.at(-1)![0] as Record<string, unknown>;
    expect(opts.collectionPath).toBe('adminTasks');
    expect(opts.subscribe).toBe(true);
    expect(opts.enabled).toBe(true);
    expect(opts.queryKey).toEqual(['report-core', 'checkedOutTasks', 'admin-1']);
    expect(opts.constraints).toHaveLength(4);
    expect(mocks.whereFn).toHaveBeenCalledWith('checkoutDetails.userId', '==', 'admin-1');
    expect(mocks.whereFn).toHaveBeenCalledWith('status', 'in', ['checkedOut', 'workLater']);
  });

  it('is disabled with no constraints when there is no user', () => {
    renderHook(() => useCheckedOutTasks(undefined), { wrapper });
    const opts = mocks.useFirestoreCollection.mock.calls.at(-1)![0] as Record<string, unknown>;
    expect(opts.enabled).toBe(false);
    expect(opts.constraints).toHaveLength(0);
  });

  it('maps a raw task doc to CheckedOutTask (defaults workLaterUntil to null)', () => {
    renderHook(() => useCheckedOutTasks('admin-1'), { wrapper });
    const opts = mocks.useFirestoreCollection.mock.calls.at(-1)![0] as {
      select: (d: Record<string, unknown>) => Record<string, unknown>;
    };
    const mapped = opts.select({
      id: 't1',
      taskType: 'userReport',
      taskId: 'r1',
      originalPath: 'p/1',
      status: 'checkedOut',
      checkoutDetails: { userId: 'admin-1', checkedOutAt: 1, expiresAt: 2 },
      summary: 's',
      priority: 5,
      createdAt: 1,
      lastUpdatedAt: 1,
    });
    expect(mapped).toMatchObject({
      id: 't1',
      taskType: 'userReport',
      checkoutDetails: { workLaterUntil: null },
    });
  });
});
