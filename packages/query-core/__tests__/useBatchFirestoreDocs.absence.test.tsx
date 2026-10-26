import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';

const store = await vi.hoisted(async () => {
  const { makeInMemoryClientFirestore } =
    await import('@ttt-productions/firebase-helpers/firestore-client/testing');
  return makeInMemoryClientFirestore();
});

vi.mock('firebase/firestore', async (importOriginal) => {
  const { clientFirestoreFake } = await import('../../../test/client-firestore-fake.js');
  return clientFirestoreFake(importOriginal, store);
});

import { firestoreError } from '@ttt-productions/firebase-helpers/firestore-client/testing';
import { useBatchFirestoreDocs } from '../src/react/firestore/useBatchFirestoreDocs.js';
import {
  __absenceAttempt,
  __absenceEpisodeCount,
} from '../src/react/firestore/absence-scheduler.js';
import { batchReadIn, readsMatching } from './helpers/batch-docs-reads.js';
import { failNext } from './helpers/listener-controls.js';

const batchReads = () => readsMatching(store, batchReadIn('publicUsers'));

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
  store.reset();
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

async function tick(ms: number) {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });
}

const baseOpts = {
  db: store.db,
  collectionPath: 'publicUsers',
  queryKeyPrefix: 'publicUser',
  staleTime: 30 * 60 * 1000,
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
    expect(batchReads()).toHaveLength(1);
    expect(__absenceAttempt(queryClient, GHOST_KEY)).toBe(0);

    await tick(1000);
    expect(batchReads()).toHaveLength(2);

    await tick(2000);
    expect(batchReads()).toHaveLength(3);
    expect(__absenceAttempt(queryClient, GHOST_KEY)).toBe(2);

    await tick(60_000);
    expect(batchReads()).toHaveLength(3);
  });

  it('shares ONE budget across staggered overlapping consumers', async () => {
    const { Wrapper } = makeWrapper();
    const opts = { ...baseOpts, ids: ['ghost'], absentRetryDelaysMs: [1000, 2000] };

    const first = renderHook(() => useBatchFirestoreDocs(opts), { wrapper: Wrapper });
    await tick(0);
    expect(batchReads()).toHaveLength(1);

    await tick(1000);
    expect(batchReads()).toHaveLength(2);

    const second = renderHook(() => useBatchFirestoreDocs(opts), { wrapper: Wrapper });
    await tick(0);
    expect(batchReads()).toHaveLength(2);

    await tick(2000);
    expect(batchReads()).toHaveLength(3);

    await tick(60_000);
    expect(batchReads()).toHaveLength(3);

    first.unmount();
    second.unmount();
  });

  it('does not restart an exhausted episode on remount', async () => {
    const { Wrapper, queryClient } = makeWrapper();
    const opts = { ...baseOpts, ids: ['ghost'], absentRetryDelaysMs: [1000] };

    const first = renderHook(() => useBatchFirestoreDocs(opts), { wrapper: Wrapper });
    await tick(0);
    await tick(1000);
    expect(batchReads()).toHaveLength(2);
    first.unmount();

    renderHook(() => useBatchFirestoreDocs(opts), { wrapper: Wrapper });
    await tick(0);
    await tick(60_000);

    expect(batchReads()).toHaveLength(2);
    expect(__absenceAttempt(queryClient, GHOST_KEY)).toBe(1);
  });

  it('pauses while no enabled consumer is mounted and resumes on the remaining budget', async () => {
    const { Wrapper, queryClient } = makeWrapper();
    const opts = { ...baseOpts, ids: ['ghost'], absentRetryDelaysMs: [1000, 2000, 4000] };

    const first = renderHook(() => useBatchFirestoreDocs(opts), { wrapper: Wrapper });
    await tick(0);
    await tick(1000);
    expect(batchReads()).toHaveLength(2);

    first.unmount();
    await tick(60_000);
    expect(batchReads()).toHaveLength(2);
    expect(__absenceAttempt(queryClient, GHOST_KEY)).toBe(1);

    renderHook(() => useBatchFirestoreDocs(opts), { wrapper: Wrapper });
    await tick(0);
    expect(batchReads()).toHaveLength(2);

    await tick(2000);
    expect(batchReads()).toHaveLength(3);
    await tick(4000);
    expect(batchReads()).toHaveLength(4);
    await tick(60_000);
    expect(batchReads()).toHaveLength(4);
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
    expect(batchReads()).toHaveLength(1);

    failNext(
      store,
      batchReadIn('publicUsers'),
      firestoreError('permission-denied', 'permission-denied'),
    );
    await tick(1000);
    expect(batchReads()).toHaveLength(2);
    // React Query batches observer notifications on a 0ms timer; let it flush.
    await tick(10);
    expect(result.current.isError).toBe(true);

    await tick(60_000);
    expect(batchReads()).toHaveLength(2);
  });

  it('opens a NEW episode when a present doc goes absent again', async () => {
    const { Wrapper, queryClient } = makeWrapper();
    const opts = { ...baseOpts, ids: ['ghost'], absentRetryDelaysMs: [1000] };

    renderHook(() => useBatchFirestoreDocs(opts), { wrapper: Wrapper });
    await tick(0);
    await tick(1000);
    expect(batchReads()).toHaveLength(2);
    await tick(60_000);
    expect(batchReads()).toHaveLength(2);

    store.seed('publicUsers/ghost', { displayName: 'Arrived' });
    await act(async () => {
      await queryClient.invalidateQueries({ queryKey: GHOST_KEY, exact: true });
    });
    expect(batchReads()).toHaveLength(3);
    expect(__absenceAttempt(queryClient, GHOST_KEY)).toBeNull();

    store.remove('publicUsers/ghost');
    await act(async () => {
      await queryClient.invalidateQueries({ queryKey: GHOST_KEY, exact: true });
    });
    expect(batchReads()).toHaveLength(4);
    expect(__absenceAttempt(queryClient, GHOST_KEY)).toBe(0);

    await tick(1000);
    expect(batchReads()).toHaveLength(5);
    await tick(60_000);
    expect(batchReads()).toHaveLength(5);
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
    expect(batchReads()).toHaveLength(1);
    await tick(1000);
    expect(batchReads()).toHaveLength(2);

    enabledConsumer.unmount();
    await tick(60_000);
    expect(batchReads()).toHaveLength(2);
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
    expect(batchReads()).toHaveLength(2);

    act(() => {
      toggled.rerender({ on: false });
    });

    await tick(2000);
    expect(batchReads()).toHaveLength(3);
  });

  it('polls if ANY registrant wants it, whichever mounts first', async () => {
    const NONE: readonly number[] = [];
    const LADDER: readonly number[] = [1000, 2000];

    for (const order of [
      [NONE, LADDER],
      [LADDER, NONE],
    ] as const) {
      store.reset();
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
      expect(batchReads()).toHaveLength(1);
      await tick(1000);
      expect(batchReads()).toHaveLength(2);
      await tick(2000);
      expect(batchReads()).toHaveLength(3);
      await tick(60_000);
      expect(batchReads()).toHaveLength(3);

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
    expect(batchReads()).toHaveLength(2);
    await tick(2000);
    expect(batchReads()).toHaveLength(3);
    await tick(4000);
    expect(batchReads()).toHaveLength(4);
    await tick(60_000);
    expect(batchReads()).toHaveLength(4);
  });

  it('shrinks the effective ladder when the last polling registrant releases', async () => {
    const { Wrapper } = makeWrapper();
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
    expect(batchReads()).toHaveLength(2);

    poller.unmount();
    await tick(60_000);
    expect(batchReads()).toHaveLength(2);
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
    expect(batchReads()).toHaveLength(1);
    await tick(1000);
    expect(batchReads()).toHaveLength(2);
    await tick(2000);
    expect(batchReads()).toHaveLength(3);
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
    expect(batchReads()).toHaveLength(2);
    expect(__absenceAttempt(queryClient, GHOST_KEY)).toBe(1);

    first.unmount();
    await tick(50);
    expect(queryClient.getQueryState(GHOST_KEY)).toBeUndefined();
    expect(__absenceEpisodeCount(queryClient)).toBe(0);

    renderHook(() => useBatchFirestoreDocs(opts), { wrapper: Wrapper });
    await tick(0);
    expect(batchReads()).toHaveLength(3);
    expect(__absenceAttempt(queryClient, GHOST_KEY)).toBe(0);

    await tick(1000);
    expect(batchReads()).toHaveLength(4);
    await tick(2000);
    expect(batchReads()).toHaveLength(5);
  });
});
