import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';

type DocData = Record<string, unknown>;

const { existingDocs, getDocsMock, onSnapshotMock, failNextWith } = vi.hoisted(() => {
  const existingDocs = new Map<string, DocData>();
  let pendingFailure: Error | null = null;

  const getDocsMock = vi.fn((q: { __ids: string[] }) => {
    if (pendingFailure) {
      const error = pendingFailure;
      pendingFailure = null;
      return Promise.reject(error);
    }
    return Promise.resolve({
      forEach: (cb: (d: { id: string; data: () => DocData }) => void) => {
        for (const id of q.__ids) {
          const data = existingDocs.get(id);
          if (data !== undefined) cb({ id, data: () => data });
        }
      },
    });
  });

  const onSnapshotMock = vi.fn(() => vi.fn());

  const failNextWith = (error: Error) => {
    pendingFailure = error;
  };

  return { existingDocs, getDocsMock, onSnapshotMock, failNextWith };
});

vi.mock('firebase/firestore', () => ({
  collection: (db: unknown, path: string) => ({ __db: db, __path: path }),
  query: (source: { __db: unknown; __path: string }, constraint: { __ids: string[] }) => ({
    __db: source.__db,
    __path: source.__path,
    __ids: constraint.__ids,
  }),
  where: (_field: unknown, _op: unknown, ids: string[]) => ({ __ids: ids }),
  documentId: () => '__name__',
  getDocs: getDocsMock,
  doc: (_db: unknown, _path: string, id: string) => ({ __id: id }),
  getDoc: async () => ({ exists: () => false }),
  onSnapshot: onSnapshotMock,
}));

import { useBatchFirestoreDocs } from '../src/react/firestore/useBatchFirestoreDocs.js';
import {
  __absenceAttempt,
  __absenceEpisodeCount,
} from '../src/react/firestore/absence-scheduler.js';

beforeEach(() => {
  vi.useFakeTimers();
  existingDocs.clear();
  getDocsMock.mockClear();
  onSnapshotMock.mockClear();
});

afterEach(() => {
  vi.useRealTimers();
});

function makeWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        gcTime: Infinity,
        refetchOnMount: false,
        refetchOnWindowFocus: false,
        refetchOnReconnect: false,
      },
    },
  });
  const Wrapper = ({ children }: { children: React.ReactNode }) =>
    React.createElement(QueryClientProvider, { client: queryClient }, children);
  Wrapper.displayName = 'TestWrapper';
  return { queryClient, Wrapper };
}

/** Advance fake timers and drain the promise jobs they release. */
async function tick(ms: number) {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });
}

const baseOpts = {
  db: {} as never,
  collectionPath: 'publicUsers',
  queryKeyPrefix: 'publicUser',
  staleTime: 30 * 60 * 1000,
  // Long enough that nothing in these suites re-reads because of staleness — every extra
  // read counted here comes from the absence ladder.
  absentStaleTime: 10 * 60 * 1000,
};

const GHOST_KEY = ['publicUser', 'ghost'];

describe('useBatchFirestoreDocs — absence scheduler', () => {
  it('opens an episode on the first absent result and spends exactly its budget', async () => {
    const { Wrapper, queryClient } = makeWrapper();
    renderHook(
      () =>
        useBatchFirestoreDocs({ ...baseOpts, ids: ['ghost'], absentRetryDelaysMs: [1000, 2000] }),
      { wrapper: Wrapper },
    );

    await tick(0);
    expect(getDocsMock).toHaveBeenCalledTimes(1);
    expect(__absenceAttempt(queryClient, GHOST_KEY)).toBe(0);

    await tick(1000);
    expect(getDocsMock).toHaveBeenCalledTimes(2);

    await tick(2000);
    expect(getDocsMock).toHaveBeenCalledTimes(3);
    expect(__absenceAttempt(queryClient, GHOST_KEY)).toBe(2);

    // Budget spent — repeated absent results never buy another rung.
    await tick(60_000);
    expect(getDocsMock).toHaveBeenCalledTimes(3);
  });

  it('shares ONE budget across staggered overlapping consumers', async () => {
    const { Wrapper } = makeWrapper();
    const opts = { ...baseOpts, ids: ['ghost'], absentRetryDelaysMs: [1000, 2000] };

    const first = renderHook(() => useBatchFirestoreDocs(opts), { wrapper: Wrapper });
    await tick(0);
    expect(getDocsMock).toHaveBeenCalledTimes(1);

    await tick(1000);
    expect(getDocsMock).toHaveBeenCalledTimes(2);

    // A second consumer joins mid-episode: it reads the fresh negative cache and does not
    // open a second ladder.
    const second = renderHook(() => useBatchFirestoreDocs(opts), { wrapper: Wrapper });
    await tick(0);
    expect(getDocsMock).toHaveBeenCalledTimes(2);

    await tick(2000);
    expect(getDocsMock).toHaveBeenCalledTimes(3);

    await tick(60_000);
    expect(getDocsMock).toHaveBeenCalledTimes(3);

    first.unmount();
    second.unmount();
  });

  it('does not restart an exhausted episode on remount', async () => {
    const { Wrapper, queryClient } = makeWrapper();
    const opts = { ...baseOpts, ids: ['ghost'], absentRetryDelaysMs: [1000] };

    const first = renderHook(() => useBatchFirestoreDocs(opts), { wrapper: Wrapper });
    await tick(0);
    await tick(1000);
    expect(getDocsMock).toHaveBeenCalledTimes(2);
    first.unmount();

    renderHook(() => useBatchFirestoreDocs(opts), { wrapper: Wrapper });
    await tick(0);
    await tick(60_000);

    expect(getDocsMock).toHaveBeenCalledTimes(2);
    expect(__absenceAttempt(queryClient, GHOST_KEY)).toBe(1);
  });

  it('pauses while no enabled consumer is mounted and resumes on the remaining budget', async () => {
    const { Wrapper, queryClient } = makeWrapper();
    const opts = { ...baseOpts, ids: ['ghost'], absentRetryDelaysMs: [1000, 2000, 4000] };

    const first = renderHook(() => useBatchFirestoreDocs(opts), { wrapper: Wrapper });
    await tick(0);
    await tick(1000);
    expect(getDocsMock).toHaveBeenCalledTimes(2);

    first.unmount();
    await tick(60_000);
    expect(getDocsMock).toHaveBeenCalledTimes(2);
    expect(__absenceAttempt(queryClient, GHOST_KEY)).toBe(1);

    // Resuming picks up at the rung the episode had reached, never at the start.
    renderHook(() => useBatchFirestoreDocs(opts), { wrapper: Wrapper });
    await tick(0);
    expect(getDocsMock).toHaveBeenCalledTimes(2);

    await tick(2000);
    expect(getDocsMock).toHaveBeenCalledTimes(3);
    await tick(4000);
    expect(getDocsMock).toHaveBeenCalledTimes(4);
    await tick(60_000);
    expect(getDocsMock).toHaveBeenCalledTimes(4);
  });

  it('stops polling when an absent id turns into an error', async () => {
    const { Wrapper } = makeWrapper();
    const { result } = renderHook(
      () =>
        useBatchFirestoreDocs({
          ...baseOpts,
          ids: ['ghost'],
          absentRetryDelaysMs: [1000, 2000, 4000],
        }),
      { wrapper: Wrapper },
    );

    await tick(0);
    expect(getDocsMock).toHaveBeenCalledTimes(1);

    failNextWith(new Error('permission-denied'));
    await tick(1000);
    expect(getDocsMock).toHaveBeenCalledTimes(2);
    // React Query batches observer notifications on a 0ms timer; let it flush.
    await tick(10);
    expect(result.current.isError).toBe(true);

    // A denial is not an absence — the ladder must not keep hammering it.
    await tick(60_000);
    expect(getDocsMock).toHaveBeenCalledTimes(2);
  });

  it('opens a NEW episode when a present doc goes absent again', async () => {
    const { Wrapper, queryClient } = makeWrapper();
    const opts = { ...baseOpts, ids: ['ghost'], absentRetryDelaysMs: [1000] };

    renderHook(() => useBatchFirestoreDocs(opts), { wrapper: Wrapper });
    await tick(0);
    await tick(1000);
    expect(getDocsMock).toHaveBeenCalledTimes(2);
    await tick(60_000);
    expect(getDocsMock).toHaveBeenCalledTimes(2);

    // The doc appears: the episode is over.
    existingDocs.set('ghost', { displayName: 'Arrived' });
    await act(async () => {
      await queryClient.invalidateQueries({ queryKey: GHOST_KEY, exact: true });
    });
    expect(getDocsMock).toHaveBeenCalledTimes(3);
    expect(__absenceAttempt(queryClient, GHOST_KEY)).toBeNull();

    // …and disappears again: a fresh budget, not the exhausted one.
    existingDocs.delete('ghost');
    await act(async () => {
      await queryClient.invalidateQueries({ queryKey: GHOST_KEY, exact: true });
    });
    expect(getDocsMock).toHaveBeenCalledTimes(4);
    expect(__absenceAttempt(queryClient, GHOST_KEY)).toBe(0);

    await tick(1000);
    expect(getDocsMock).toHaveBeenCalledTimes(5);
    await tick(60_000);
    expect(getDocsMock).toHaveBeenCalledTimes(5);
  });

  it('is never kept alive by a disabled or subscribe-mode consumer', async () => {
    const { Wrapper } = makeWrapper();
    const ladder = [1000, 2000, 4000];

    const enabledConsumer = renderHook(
      () => useBatchFirestoreDocs({ ...baseOpts, ids: ['ghost'], absentRetryDelaysMs: ladder }),
      { wrapper: Wrapper },
    );
    renderHook(
      () =>
        useBatchFirestoreDocs({
          ...baseOpts,
          ids: ['ghost'],
          enabled: false,
          absentRetryDelaysMs: ladder,
        }),
      { wrapper: Wrapper },
    );
    renderHook(
      () =>
        useBatchFirestoreDocs({
          ...baseOpts,
          ids: ['ghost'],
          subscribe: true,
          absentRetryDelaysMs: ladder,
        }),
      { wrapper: Wrapper },
    );

    await tick(0);
    expect(getDocsMock).toHaveBeenCalledTimes(1);
    await tick(1000);
    expect(getDocsMock).toHaveBeenCalledTimes(2);

    // The only ENABLED consumer goes away; the disabled and subscribed ones must not keep
    // the ladder running.
    enabledConsumer.unmount();
    await tick(60_000);
    expect(getDocsMock).toHaveBeenCalledTimes(2);
  });

  it('keeps polling for a still-enabled consumer when another one is disabled', async () => {
    const { Wrapper } = makeWrapper();
    const ladder = [1000, 2000];

    renderHook(
      () => useBatchFirestoreDocs({ ...baseOpts, ids: ['ghost'], absentRetryDelaysMs: ladder }),
      { wrapper: Wrapper },
    );
    const toggled = renderHook(
      ({ on }: { on: boolean }) =>
        useBatchFirestoreDocs({
          ...baseOpts,
          ids: ['ghost'],
          enabled: on,
          absentRetryDelaysMs: ladder,
        }),
      { wrapper: Wrapper, initialProps: { on: true } },
    );

    await tick(0);
    await tick(1000);
    expect(getDocsMock).toHaveBeenCalledTimes(2);

    act(() => {
      toggled.rerender({ on: false });
    });

    await tick(2000);
    expect(getDocsMock).toHaveBeenCalledTimes(3);
  });

  it('polls if ANY registrant wants it, whichever mounts first', async () => {
    const NONE: readonly number[] = [];
    const LADDER: readonly number[] = [1000, 2000];

    for (const order of [
      [NONE, LADDER],
      [LADDER, NONE],
    ] as const) {
      getDocsMock.mockClear();
      const { Wrapper } = makeWrapper();
      const a = renderHook(
        () => useBatchFirestoreDocs({ ...baseOpts, ids: ['ghost'], absentRetryDelaysMs: order[0] }),
        { wrapper: Wrapper },
      );
      const b = renderHook(
        () => useBatchFirestoreDocs({ ...baseOpts, ids: ['ghost'], absentRetryDelaysMs: order[1] }),
        { wrapper: Wrapper },
      );

      await tick(0);
      expect(getDocsMock).toHaveBeenCalledTimes(1);
      await tick(1000);
      expect(getDocsMock).toHaveBeenCalledTimes(2);
      await tick(2000);
      expect(getDocsMock).toHaveBeenCalledTimes(3);
      await tick(60_000);
      expect(getDocsMock).toHaveBeenCalledTimes(3);

      a.unmount();
      b.unmount();
    }
  });

  it('uses the LONGEST ladder among registrants', async () => {
    const { Wrapper } = makeWrapper();
    renderHook(
      () => useBatchFirestoreDocs({ ...baseOpts, ids: ['ghost'], absentRetryDelaysMs: [1000] }),
      { wrapper: Wrapper },
    );
    renderHook(
      () =>
        useBatchFirestoreDocs({
          ...baseOpts,
          ids: ['ghost'],
          absentRetryDelaysMs: [1000, 2000, 4000],
        }),
      { wrapper: Wrapper },
    );

    await tick(0);
    await tick(1000);
    expect(getDocsMock).toHaveBeenCalledTimes(2);
    await tick(2000);
    expect(getDocsMock).toHaveBeenCalledTimes(3);
    await tick(4000);
    expect(getDocsMock).toHaveBeenCalledTimes(4);
    await tick(60_000);
    expect(getDocsMock).toHaveBeenCalledTimes(4);
  });

  it('shrinks the effective ladder when the last polling registrant releases', async () => {
    const { Wrapper } = makeWrapper();
    // This consumer stays mounted and ENABLED, so the query remains active throughout —
    // what stops the ladder is the union shrinking to empty, not eligibility.
    renderHook(
      () =>
        useBatchFirestoreDocs({
          ...baseOpts,
          ids: ['ghost'],
          absentRetryDelaysMs: [] as readonly number[],
        }),
      { wrapper: Wrapper },
    );
    const poller = renderHook(
      () =>
        useBatchFirestoreDocs({ ...baseOpts, ids: ['ghost'], absentRetryDelaysMs: [1000, 2000] }),
      { wrapper: Wrapper },
    );

    await tick(0);
    await tick(1000);
    expect(getDocsMock).toHaveBeenCalledTimes(2);

    poller.unmount();
    await tick(60_000);
    expect(getDocsMock).toHaveBeenCalledTimes(2);
  });

  it('works under a custom queryKeyHashFn', async () => {
    const queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          retry: false,
          gcTime: Infinity,
          refetchOnMount: false,
          refetchOnWindowFocus: false,
          refetchOnReconnect: false,
          queryKeyHashFn: (key) => `custom:${JSON.stringify(key)}`,
        },
      },
    });
    const Wrapper = ({ children }: { children: React.ReactNode }) =>
      React.createElement(QueryClientProvider, { client: queryClient }, children);
    Wrapper.displayName = 'CustomHashWrapper';

    renderHook(
      () =>
        useBatchFirestoreDocs({ ...baseOpts, ids: ['ghost'], absentRetryDelaysMs: [1000, 2000] }),
      { wrapper: Wrapper },
    );

    await tick(0);
    expect(getDocsMock).toHaveBeenCalledTimes(1);
    await tick(1000);
    expect(getDocsMock).toHaveBeenCalledTimes(2);
    await tick(2000);
    expect(getDocsMock).toHaveBeenCalledTimes(3);
    expect(__absenceAttempt(queryClient, GHOST_KEY)).toBe(2);
  });

  it('discards its bookkeeping when the cache entry is garbage-collected', async () => {
    const { Wrapper, queryClient } = makeWrapper();
    const opts = {
      ...baseOpts,
      ids: ['ghost'],
      gcTime: 5,
      absentRetryDelaysMs: [1000, 2000],
    };

    const first = renderHook(() => useBatchFirestoreDocs(opts), { wrapper: Wrapper });
    await tick(0);
    await tick(1000);
    expect(getDocsMock).toHaveBeenCalledTimes(2);
    expect(__absenceAttempt(queryClient, GHOST_KEY)).toBe(1);

    first.unmount();
    await tick(50);
    expect(queryClient.getQueryState(GHOST_KEY)).toBeUndefined();
    expect(__absenceEpisodeCount(queryClient)).toBe(0);

    // A later re-fetch that lands absent starts from a fresh budget.
    renderHook(() => useBatchFirestoreDocs(opts), { wrapper: Wrapper });
    await tick(0);
    expect(getDocsMock).toHaveBeenCalledTimes(3);
    expect(__absenceAttempt(queryClient, GHOST_KEY)).toBe(0);

    await tick(1000);
    expect(getDocsMock).toHaveBeenCalledTimes(4);
    await tick(2000);
    expect(getDocsMock).toHaveBeenCalledTimes(5);
  });
});
