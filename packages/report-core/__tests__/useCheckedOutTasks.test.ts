// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { defineInputFormat } from '@ttt-productions/input-format-core';
import { act, renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { FirestoreProvider } from '@ttt-productions/query-core/react';
import {
  firestoreError,
  type ClientReadPredicate,
} from '@ttt-productions/firebase-helpers/firestore-client/testing';
import React from 'react';

const store = await vi.hoisted(async () => {
  const { makeInMemoryClientFirestore } =
    await import('@ttt-productions/firebase-helpers/firestore-client/testing');
  return makeInMemoryClientFirestore();
});

vi.mock(import('firebase/firestore'), async (importOriginal) => {
  const { clientFirestoreFake } = await import('../../../test/client-firestore-fake.js');
  return clientFirestoreFake(importOriginal, store);
});

import { useCheckedOutTasks } from '../src/react/hooks/useCheckedOutTasks.js';
import { ReportCoreProvider } from '../src/react/context/ReportCoreProvider.js';
import type { ReportCoreConfig } from '../src/contracts/config.js';

const config: ReportCoreConfig = {
  collections: {
    reports: 'testReports',
    reportGroups: 'testReportGroups',
    adminTasks: 'adminTasks',
  },
  reportableItems: {},
  reportReasons: [],
  priorityConfig: {
    reasonScores: {},
    itemTypeMultipliers: {},
    additionalReportBonus: 0,
    defaultReasonScore: 0,
    defaultItemTypeMultiplier: 1,
  },
  taskQueues: {},
  reportCommentInput: defineInputFormat({ format: 'none', min: 1, max: 4000 }),
};

let client: QueryClient;

function wrapper({ children }: { children: React.ReactNode }) {
  return React.createElement(
    QueryClientProvider,
    { client },
    React.createElement(FirestoreProvider, {
      db: store.db,
      children: React.createElement(ReportCoreProvider, {
        config,
        submitReportFn: vi.fn(),
        children,
      }),
    }),
  );
}

const listensToTasks: ClientReadPredicate = (read) => read.listen && read.path === 'adminTasks';

beforeEach(() => {
  store.reset();
  client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
});

describe('useCheckedOutTasks — the failure held through its restart', () => {
  it('is loading before the first snapshot', async () => {
    store.beforeRead(listensToTasks, () => new Promise<void>(() => {}));
    const { result } = renderHook(() => useCheckedOutTasks('admin-1'), { wrapper });
    await waitFor(() => expect(store.queries()).toHaveLength(1));
    expect(result.current.retryState).toEqual({ error: null, isRetrying: false, isLoading: true });
  });

  it('keeps a failed listener failed, with its retry pending, while the restart reconnects', async () => {
    const failure = firestoreError('unavailable', 'The service is currently unavailable.');
    store.failReads(listensToTasks, failure);
    const { result } = renderHook(() => useCheckedOutTasks('admin-1'), { wrapper });
    await waitFor(() =>
      expect(result.current.retryState).toEqual({
        error: failure,
        isRetrying: false,
        isLoading: false,
      }),
    );

    store.reset();
    let reconnect: () => void = () => {};
    store.beforeRead(
      listensToTasks,
      () =>
        new Promise<void>((resolve) => {
          reconnect = resolve;
        }),
    );
    act(() => {
      void result.current.refetch();
    });
    await waitFor(() =>
      expect(result.current.retryState).toEqual({
        error: failure,
        isRetrying: true,
        isLoading: false,
      }),
    );
    expect(store.queries()).toEqual([
      expect.objectContaining({ listen: true, path: 'adminTasks' }),
    ]);

    act(() => reconnect());
    await waitFor(() =>
      expect(result.current.retryState).toEqual({
        error: null,
        isRetrying: false,
        isLoading: false,
      }),
    );
    expect(result.current.data).toEqual([]);
  });
});

describe('useCheckedOutTasks', () => {
  it('subscribes (realtime, no poll) to the admin tasks scoped to the user', async () => {
    const { result } = renderHook(() => useCheckedOutTasks('admin-1'), { wrapper });
    await waitFor(() => expect(result.current.data).toEqual([]));
    expect(store.queries()).toEqual([
      {
        kind: 'query',
        listen: true,
        path: 'adminTasks',
        group: false,
        filters: [
          { field: 'checkoutDetails.userId', op: '==', value: { t: 'str', v: 'admin-1' } },
          {
            field: 'status',
            op: 'in',
            value: {
              t: 'arr',
              v: [
                { t: 'str', v: 'checkedOut' },
                { t: 'str', v: 'workLater' },
              ],
            },
          },
        ],
        orders: [
          { field: 'priority', direction: 'desc' },
          { field: 'createdAt', direction: 'asc' },
        ],
        limit: Infinity,
        limitToLast: false,
        startAt: null,
        endAt: null,
        includeMetadataChanges: true,
      },
    ]);
    expect(
      client
        .getQueryCache()
        .find({ queryKey: ['report-core', 'checkedOutTasks', 'admin-1'], exact: true }),
    ).toBeDefined();
  });

  it('reads nothing when there is no user', async () => {
    const { result } = renderHook(() => useCheckedOutTasks(undefined), { wrapper });
    await act(async () => {});
    expect(result.current.fetchStatus).toBe('idle');
    expect(store.queries()).toEqual([]);
  });

  it('maps a raw task doc to CheckedOutTask (defaults workLaterUntil to null)', async () => {
    store.seed('adminTasks/t1', {
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
    const { result } = renderHook(() => useCheckedOutTasks('admin-1'), { wrapper });
    await waitFor(() => expect(result.current.data).toHaveLength(1));
    expect(result.current.data?.[0]).toMatchObject({
      id: 't1',
      taskType: 'userReport',
      checkoutDetails: { workLaterUntil: null },
    });
  });
});
