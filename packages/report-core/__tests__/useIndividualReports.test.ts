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

import { useIndividualReports } from '../src/hooks/useIndividualReports.js';
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

describe('useIndividualReports', () => {
  it('queries reports for a group key (one-shot, not realtime)', () => {
    renderHook(() => useIndividualReports('item-1'), { wrapper });
    const opts = mocks.useFirestoreCollection.mock.calls.at(-1)![0] as Record<string, unknown>;
    expect(opts.collectionPath).toBe('contentReports');
    expect(opts.enabled).toBe(true);
    expect(opts.subscribe).toBeFalsy();
    expect(opts.queryKey).toEqual(['report-core', 'individualReports', 'item-1']);
    expect(opts.constraints).toHaveLength(2);
    expect(mocks.whereFn).toHaveBeenCalledWith('reportedItemId', '==', 'item-1');
  });

  it('is disabled with no constraints when groupKey is null', () => {
    renderHook(() => useIndividualReports(null), { wrapper });
    const opts = mocks.useFirestoreCollection.mock.calls.at(-1)![0] as Record<string, unknown>;
    expect(opts.enabled).toBe(false);
    expect(opts.constraints).toHaveLength(0);
  });
});
