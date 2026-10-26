import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
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
import { batchReadIn, idsOf, readsMatching } from './helpers/batch-docs-reads.js';
import { failNext } from './helpers/listener-controls.js';

const batchReads = () => readsMatching(store, batchReadIn('publicUsers'));
const batchCalls = () => batchReads().map(idsOf);
const seed = (id: string, data: Record<string, unknown>) => store.seed(`publicUsers/${id}`, data);

beforeEach(() => {
  store.reset();
});

function makeWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: Infinity, staleTime: 0 } },
  });
  const Wrapper = ({ children }: { children: React.ReactNode }) =>
    React.createElement(QueryClientProvider, { client: queryClient }, children);
  Wrapper.displayName = 'TestWrapper';
  return { queryClient, Wrapper };
}

function makeAppDefaultsWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        gcTime: Infinity,
        refetchOnMount: false,
        refetchOnWindowFocus: false,
        refetchOnReconnect: true,
        staleTime: 5 * 60 * 1000,
      },
    },
  });
  const Wrapper = ({ children }: { children: React.ReactNode }) =>
    React.createElement(QueryClientProvider, { client: queryClient }, children);
  Wrapper.displayName = 'AppDefaultsWrapper';
  return { queryClient, Wrapper };
}

const baseOpts = {
  db: store.db,
  collectionPath: 'publicUsers',
  queryKeyPrefix: 'publicUser',
  staleTime: 30 * 60 * 1000,
  absentRetryDelaysMs: [] as readonly number[],
};

describe('useBatchFirestoreDocs — one-shot mode', () => {
  it('returns existing docs and excludes missing ones', async () => {
    seed('u1', { displayName: 'Alice' });

    const { Wrapper } = makeWrapper();
    const { result } = renderHook(
      () => useBatchFirestoreDocs({ ...baseOpts, ids: ['u1', 'ghost'] }),
      { wrapper: Wrapper },
    );

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.data).toEqual({ u1: { id: 'u1', displayName: 'Alice' } });
  });

  it('negative-caches missing ids as null', async () => {
    seed('u1', { displayName: 'Alice' });

    const { Wrapper, queryClient } = makeWrapper();
    const { result } = renderHook(
      () => useBatchFirestoreDocs({ ...baseOpts, ids: ['u1', 'ghost'] }),
      { wrapper: Wrapper },
    );

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(queryClient.getQueryData(['publicUser', 'ghost'])).toBeNull();
    expect(queryClient.getQueryData(['publicUser', 'u1'])).toMatchObject({ displayName: 'Alice' });
  });

  it('does not re-fetch a known-missing id while fresh', async () => {
    const { Wrapper } = makeWrapper();

    const first = renderHook(() => useBatchFirestoreDocs({ ...baseOpts, ids: ['ghost'] }), {
      wrapper: Wrapper,
    });
    await waitFor(() => expect(first.result.current.isLoading).toBe(false));
    expect(batchReads()).toHaveLength(1);
    first.unmount();

    const second = renderHook(() => useBatchFirestoreDocs({ ...baseOpts, ids: ['ghost'] }), {
      wrapper: Wrapper,
    });
    await waitFor(() => expect(second.result.current.isLoading).toBe(false));
    expect(second.result.current.data).toEqual({});
    expect(batchReads()).toHaveLength(1);
  });

  it('does not mutate the caller-supplied id array', async () => {
    seed('a', { v: 1 });
    seed('b', { v: 2 });

    const ids = ['b', 'a'];
    const { Wrapper } = makeWrapper();
    const { result } = renderHook(() => useBatchFirestoreDocs({ ...baseOpts, ids }), {
      wrapper: Wrapper,
    });

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(ids).toEqual(['b', 'a']);
    expect(Object.keys(result.current.data).sort()).toEqual(['a', 'b']);
  });
});

describe('useBatchFirestoreDocs — per-id cache participation', () => {
  it('refetches on exact per-id invalidation while mounted', async () => {
    seed('u1', { displayName: 'Alice' });
    seed('u2', { displayName: 'Bob' });

    const { Wrapper, queryClient } = makeWrapper();
    const { result } = renderHook(() => useBatchFirestoreDocs({ ...baseOpts, ids: ['u1', 'u2'] }), {
      wrapper: Wrapper,
    });

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(batchReads()).toHaveLength(1);

    seed('u1', { displayName: 'Alice Smith' });
    await act(async () => {
      await queryClient.invalidateQueries({ queryKey: ['publicUser', 'u1'], exact: true });
    });

    await waitFor(() =>
      expect(result.current.data.u1).toMatchObject({ displayName: 'Alice Smith' }),
    );
    expect(batchReads()).toHaveLength(2);
    expect(batchCalls()[1]).toEqual(['u1']);
    expect(result.current.data.u2).toMatchObject({ displayName: 'Bob' });
  });

  it('refetches on exact per-id invalidation even on an all-cache-hit mount', async () => {
    seed('u1', { displayName: 'Alice' });

    const { Wrapper, queryClient } = makeWrapper();
    const first = renderHook(() => useBatchFirestoreDocs({ ...baseOpts, ids: ['u1'] }), {
      wrapper: Wrapper,
    });
    await waitFor(() => expect(first.result.current.isLoading).toBe(false));
    first.unmount();

    const second = renderHook(() => useBatchFirestoreDocs({ ...baseOpts, ids: ['u1'] }), {
      wrapper: Wrapper,
    });
    await waitFor(() => expect(second.result.current.data.u1).toBeTruthy());
    expect(batchReads()).toHaveLength(1);

    seed('u1', { displayName: 'Alice Smith' });
    await act(async () => {
      await queryClient.invalidateQueries({ queryKey: ['publicUser', 'u1'], exact: true });
    });

    await waitFor(() =>
      expect(second.result.current.data.u1).toMatchObject({ displayName: 'Alice Smith' }),
    );
    expect(batchReads()).toHaveLength(2);
  });

  it('delivers one cache update to every consumer of that id', async () => {
    seed('u1', { displayName: 'Alice' });

    const { Wrapper, queryClient } = makeWrapper();
    const a = renderHook(() => useBatchFirestoreDocs({ ...baseOpts, ids: ['u1'] }), {
      wrapper: Wrapper,
    });
    const b = renderHook(() => useBatchFirestoreDocs({ ...baseOpts, ids: ['u1', 'u2'] }), {
      wrapper: Wrapper,
    });

    await waitFor(() => expect(a.result.current.data.u1).toBeTruthy());
    await waitFor(() => expect(b.result.current.data.u1).toBeTruthy());

    act(() => {
      queryClient.setQueryData(['publicUser', 'u1'], { id: 'u1', displayName: 'Renamed' });
    });

    await waitFor(() => expect(a.result.current.data.u1).toMatchObject({ displayName: 'Renamed' }));
    await waitFor(() => expect(b.result.current.data.u1).toMatchObject({ displayName: 'Renamed' }));
  });

  it('refetch() re-reads every id on an all-cache-hit mount', async () => {
    seed('u1', { displayName: 'Alice' });
    seed('u2', { displayName: 'Bob' });

    const { Wrapper } = makeWrapper();
    const first = renderHook(() => useBatchFirestoreDocs({ ...baseOpts, ids: ['u1', 'u2'] }), {
      wrapper: Wrapper,
    });
    await waitFor(() => expect(first.result.current.isLoading).toBe(false));
    first.unmount();

    const second = renderHook(() => useBatchFirestoreDocs({ ...baseOpts, ids: ['u1', 'u2'] }), {
      wrapper: Wrapper,
    });
    await waitFor(() => expect(Object.keys(second.result.current.data)).toHaveLength(2));
    expect(batchReads()).toHaveLength(1);

    seed('u1', { displayName: 'Alice Smith' });
    seed('u2', { displayName: 'Bobby' });
    await act(async () => {
      await second.result.current.refetch();
    });

    expect(batchReads()).toHaveLength(2);
    expect(batchCalls()[1].sort()).toEqual(['u1', 'u2']);
    await waitFor(() =>
      expect(second.result.current.data.u1).toMatchObject({ displayName: 'Alice Smith' }),
    );
    expect(second.result.current.data.u2).toMatchObject({ displayName: 'Bobby' });
  });

  it('is covered by an active-type refetchQueries', async () => {
    seed('u1', { displayName: 'Alice' });

    const { Wrapper, queryClient } = makeWrapper();
    const { result } = renderHook(() => useBatchFirestoreDocs({ ...baseOpts, ids: ['u1'] }), {
      wrapper: Wrapper,
    });
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(batchReads()).toHaveLength(1);

    seed('u1', { displayName: 'Alice Smith' });
    await act(async () => {
      await queryClient.refetchQueries({ type: 'active' });
    });

    expect(batchReads()).toHaveLength(2);
    await waitFor(() =>
      expect(result.current.data.u1).toMatchObject({ displayName: 'Alice Smith' }),
    );
  });
});

describe('useBatchFirestoreDocs — freshness on remount (app defaults)', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  const advance = (ms: number) => {
    vi.setSystemTime(new Date(Date.now() + ms));
  };

  it('a fresh remount fetches nothing', async () => {
    seed('u1', { displayName: 'Alice' });

    const { Wrapper } = makeAppDefaultsWrapper();
    const first = renderHook(() => useBatchFirestoreDocs({ ...baseOpts, ids: ['u1'] }), {
      wrapper: Wrapper,
    });
    await waitFor(() => expect(first.result.current.isLoading).toBe(false));
    expect(batchReads()).toHaveLength(1);
    first.unmount();

    const second = renderHook(() => useBatchFirestoreDocs({ ...baseOpts, ids: ['u1'] }), {
      wrapper: Wrapper,
    });
    await waitFor(() => expect(second.result.current.data.u1).toBeTruthy());
    expect(batchReads()).toHaveLength(1);
  });

  it('a stale ABSENT remount fetches (absentStaleTime is short)', async () => {
    const { Wrapper } = makeAppDefaultsWrapper();
    const first = renderHook(() => useBatchFirestoreDocs({ ...baseOpts, ids: ['ghost'] }), {
      wrapper: Wrapper,
    });
    await waitFor(() => expect(first.result.current.isLoading).toBe(false));
    expect(batchReads()).toHaveLength(1);
    first.unmount();

    advance(31_000);

    seed('ghost', { displayName: 'Arrived' });
    const second = renderHook(() => useBatchFirestoreDocs({ ...baseOpts, ids: ['ghost'] }), {
      wrapper: Wrapper,
    });
    await waitFor(() => expect(second.result.current.data.ghost).toBeTruthy());
    expect(batchReads()).toHaveLength(2);
  });

  it('a stale PRESENT remount fetches', async () => {
    seed('u1', { displayName: 'Alice' });

    const { Wrapper } = makeAppDefaultsWrapper();
    const first = renderHook(
      () => useBatchFirestoreDocs({ ...baseOpts, staleTime: 60_000, ids: ['u1'] }),
      { wrapper: Wrapper },
    );
    await waitFor(() => expect(first.result.current.isLoading).toBe(false));
    expect(batchReads()).toHaveLength(1);
    first.unmount();

    advance(61_000);

    seed('u1', { displayName: 'Alice Smith' });
    const second = renderHook(
      () => useBatchFirestoreDocs({ ...baseOpts, staleTime: 60_000, ids: ['u1'] }),
      { wrapper: Wrapper },
    );
    await waitFor(() =>
      expect(second.result.current.data.u1).toMatchObject({ displayName: 'Alice Smith' }),
    );
    expect(batchReads()).toHaveLength(2);
  });
});

describe('useBatchFirestoreDocs — error semantics', () => {
  it('excludes an errored id from data while reporting isError', async () => {
    const { Wrapper } = makeWrapper();
    failNext(
      store,
      batchReadIn('publicUsers'),
      firestoreError('permission-denied', 'permission-denied'),
    );

    const { result } = renderHook(() => useBatchFirestoreDocs({ ...baseOpts, ids: ['u1'] }), {
      wrapper: Wrapper,
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.data).toEqual({});
    expect(result.current.error?.message).toBe('permission-denied');
  });

  it('stops exposing a previously readable doc once access to it fails', async () => {
    seed('u1', { displayName: 'Alice' });

    const { Wrapper, queryClient } = makeWrapper();
    const { result } = renderHook(() => useBatchFirestoreDocs({ ...baseOpts, ids: ['u1'] }), {
      wrapper: Wrapper,
    });
    await waitFor(() => expect(result.current.data.u1).toBeTruthy());

    failNext(
      store,
      batchReadIn('publicUsers'),
      firestoreError('permission-denied', 'permission-denied'),
    );
    await act(async () => {
      await queryClient.refetchQueries({ queryKey: ['publicUser', 'u1'], exact: true });
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(queryClient.getQueryData(['publicUser', 'u1'])).toMatchObject({
      displayName: 'Alice',
    });
    expect(result.current.data).toEqual({});
  });
});
