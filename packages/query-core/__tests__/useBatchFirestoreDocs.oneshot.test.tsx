import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';

type DocData = Record<string, unknown>;

// One-shot path mock: the `in` query returns only the requested ids that "exist"; the hook
// must resolve the rest to null (negative caching) so they are not re-fetched while fresh.
const { existingDocs, batchCalls, getDocsMock, failNextWith } = vi.hoisted(() => {
  const existingDocs = new Map<string, DocData>();
  const batchCalls: string[][] = [];
  let pendingFailure: Error | null = null;

  const getDocsMock = vi.fn((q: { __ids: string[] }) => {
    batchCalls.push(q.__ids);
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

  const failNextWith = (error: Error) => {
    pendingFailure = error;
  };

  return { existingDocs, batchCalls, getDocsMock, failNextWith };
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
  doc: () => ({}),
  getDoc: async () => ({ exists: () => false }),
  onSnapshot: vi.fn(),
}));

import { useBatchFirestoreDocs } from '../src/react/firestore/useBatchFirestoreDocs.js';

beforeEach(() => {
  existingDocs.clear();
  batchCalls.length = 0;
  getDocsMock.mockClear();
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

/**
 * The consuming app's real global query defaults. Freshness behaviour on mount only means
 * anything when the surrounding defaults are the ones production actually uses.
 */
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
  db: {} as never,
  collectionPath: 'publicUsers',
  queryKeyPrefix: 'publicUser',
  staleTime: 30 * 60 * 1000,
  // The absence ladder has its own suite; keep its timers out of these reads.
  absentRetryDelaysMs: [] as readonly number[],
};

describe('useBatchFirestoreDocs — one-shot mode', () => {
  it('returns existing docs and excludes missing ones', async () => {
    existingDocs.set('u1', { displayName: 'Alice' });

    const { Wrapper } = makeWrapper();
    const { result } = renderHook(
      () => useBatchFirestoreDocs({ ...baseOpts, ids: ['u1', 'ghost'] }),
      { wrapper: Wrapper },
    );

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.data).toEqual({ u1: { id: 'u1', displayName: 'Alice' } });
  });

  it('negative-caches missing ids as null', async () => {
    existingDocs.set('u1', { displayName: 'Alice' });

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
    expect(getDocsMock).toHaveBeenCalledTimes(1);
    first.unmount();

    // A second consumer of the same id within absentStaleTime must hit the negative
    // cache instead of issuing another Firestore query.
    const second = renderHook(() => useBatchFirestoreDocs({ ...baseOpts, ids: ['ghost'] }), {
      wrapper: Wrapper,
    });
    await waitFor(() => expect(second.result.current.isLoading).toBe(false));
    expect(second.result.current.data).toEqual({});
    expect(getDocsMock).toHaveBeenCalledTimes(1);
  });

  it('does not mutate the caller-supplied id array', async () => {
    existingDocs.set('a', { v: 1 });
    existingDocs.set('b', { v: 2 });

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
    existingDocs.set('u1', { displayName: 'Alice' });
    existingDocs.set('u2', { displayName: 'Bob' });

    const { Wrapper, queryClient } = makeWrapper();
    const { result } = renderHook(
      () => useBatchFirestoreDocs({ ...baseOpts, ids: ['u1', 'u2'] }),
      { wrapper: Wrapper },
    );

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(getDocsMock).toHaveBeenCalledTimes(1);

    existingDocs.set('u1', { displayName: 'Alice Smith' });
    await act(async () => {
      await queryClient.invalidateQueries({ queryKey: ['publicUser', 'u1'], exact: true });
    });

    await waitFor(() =>
      expect(result.current.data.u1).toMatchObject({ displayName: 'Alice Smith' }),
    );
    expect(getDocsMock).toHaveBeenCalledTimes(2);
    expect(batchCalls[1]).toEqual(['u1']);
    // The untouched id was not re-read.
    expect(result.current.data.u2).toMatchObject({ displayName: 'Bob' });
  });

  it('refetches on exact per-id invalidation even on an all-cache-hit mount', async () => {
    existingDocs.set('u1', { displayName: 'Alice' });

    const { Wrapper, queryClient } = makeWrapper();
    const first = renderHook(() => useBatchFirestoreDocs({ ...baseOpts, ids: ['u1'] }), {
      wrapper: Wrapper,
    });
    await waitFor(() => expect(first.result.current.isLoading).toBe(false));
    first.unmount();

    // Every id is already cached and fresh — the old design fetched nothing here, so no
    // query observed the per-id key and an exact invalidation was a silent no-op.
    const second = renderHook(() => useBatchFirestoreDocs({ ...baseOpts, ids: ['u1'] }), {
      wrapper: Wrapper,
    });
    await waitFor(() => expect(second.result.current.data.u1).toBeTruthy());
    expect(getDocsMock).toHaveBeenCalledTimes(1);

    existingDocs.set('u1', { displayName: 'Alice Smith' });
    await act(async () => {
      await queryClient.invalidateQueries({ queryKey: ['publicUser', 'u1'], exact: true });
    });

    await waitFor(() =>
      expect(second.result.current.data.u1).toMatchObject({ displayName: 'Alice Smith' }),
    );
    expect(getDocsMock).toHaveBeenCalledTimes(2);
  });

  it('delivers one cache update to every consumer of that id', async () => {
    existingDocs.set('u1', { displayName: 'Alice' });

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

    await waitFor(() =>
      expect(a.result.current.data.u1).toMatchObject({ displayName: 'Renamed' }),
    );
    await waitFor(() =>
      expect(b.result.current.data.u1).toMatchObject({ displayName: 'Renamed' }),
    );
  });

  it('refetch() re-reads every id on an all-cache-hit mount', async () => {
    existingDocs.set('u1', { displayName: 'Alice' });
    existingDocs.set('u2', { displayName: 'Bob' });

    const { Wrapper } = makeWrapper();
    const first = renderHook(
      () => useBatchFirestoreDocs({ ...baseOpts, ids: ['u1', 'u2'] }),
      { wrapper: Wrapper },
    );
    await waitFor(() => expect(first.result.current.isLoading).toBe(false));
    first.unmount();

    const second = renderHook(
      () => useBatchFirestoreDocs({ ...baseOpts, ids: ['u1', 'u2'] }),
      { wrapper: Wrapper },
    );
    await waitFor(() => expect(Object.keys(second.result.current.data)).toHaveLength(2));
    expect(getDocsMock).toHaveBeenCalledTimes(1);

    existingDocs.set('u1', { displayName: 'Alice Smith' });
    existingDocs.set('u2', { displayName: 'Bobby' });
    await act(async () => {
      await second.result.current.refetch();
    });

    expect(getDocsMock).toHaveBeenCalledTimes(2);
    expect(batchCalls[1].sort()).toEqual(['u1', 'u2']);
    await waitFor(() =>
      expect(second.result.current.data.u1).toMatchObject({ displayName: 'Alice Smith' }),
    );
    expect(second.result.current.data.u2).toMatchObject({ displayName: 'Bobby' });
  });

  it("is covered by an active-type refetchQueries", async () => {
    existingDocs.set('u1', { displayName: 'Alice' });

    const { Wrapper, queryClient } = makeWrapper();
    const { result } = renderHook(() => useBatchFirestoreDocs({ ...baseOpts, ids: ['u1'] }), {
      wrapper: Wrapper,
    });
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(getDocsMock).toHaveBeenCalledTimes(1);

    existingDocs.set('u1', { displayName: 'Alice Smith' });
    await act(async () => {
      await queryClient.refetchQueries({ type: 'active' });
    });

    expect(getDocsMock).toHaveBeenCalledTimes(2);
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
    existingDocs.set('u1', { displayName: 'Alice' });

    const { Wrapper } = makeAppDefaultsWrapper();
    const first = renderHook(() => useBatchFirestoreDocs({ ...baseOpts, ids: ['u1'] }), {
      wrapper: Wrapper,
    });
    await waitFor(() => expect(first.result.current.isLoading).toBe(false));
    expect(getDocsMock).toHaveBeenCalledTimes(1);
    first.unmount();

    const second = renderHook(() => useBatchFirestoreDocs({ ...baseOpts, ids: ['u1'] }), {
      wrapper: Wrapper,
    });
    await waitFor(() => expect(second.result.current.data.u1).toBeTruthy());
    expect(getDocsMock).toHaveBeenCalledTimes(1);
  });

  it('a stale ABSENT remount fetches (absentStaleTime is short)', async () => {
    const { Wrapper } = makeAppDefaultsWrapper();
    const first = renderHook(() => useBatchFirestoreDocs({ ...baseOpts, ids: ['ghost'] }), {
      wrapper: Wrapper,
    });
    await waitFor(() => expect(first.result.current.isLoading).toBe(false));
    expect(getDocsMock).toHaveBeenCalledTimes(1);
    first.unmount();

    // Past the 30s absent window but far inside the 5m present window: the doc may have
    // been created since, so the remount must re-read.
    advance(31_000);

    existingDocs.set('ghost', { displayName: 'Arrived' });
    const second = renderHook(() => useBatchFirestoreDocs({ ...baseOpts, ids: ['ghost'] }), {
      wrapper: Wrapper,
    });
    await waitFor(() => expect(second.result.current.data.ghost).toBeTruthy());
    expect(getDocsMock).toHaveBeenCalledTimes(2);
  });

  it('a stale PRESENT remount fetches', async () => {
    existingDocs.set('u1', { displayName: 'Alice' });

    const { Wrapper } = makeAppDefaultsWrapper();
    const first = renderHook(
      () => useBatchFirestoreDocs({ ...baseOpts, staleTime: 60_000, ids: ['u1'] }),
      { wrapper: Wrapper },
    );
    await waitFor(() => expect(first.result.current.isLoading).toBe(false));
    expect(getDocsMock).toHaveBeenCalledTimes(1);
    first.unmount();

    advance(61_000);

    existingDocs.set('u1', { displayName: 'Alice Smith' });
    const second = renderHook(
      () => useBatchFirestoreDocs({ ...baseOpts, staleTime: 60_000, ids: ['u1'] }),
      { wrapper: Wrapper },
    );
    await waitFor(() =>
      expect(second.result.current.data.u1).toMatchObject({ displayName: 'Alice Smith' }),
    );
    expect(getDocsMock).toHaveBeenCalledTimes(2);
  });
});

describe('useBatchFirestoreDocs — error semantics', () => {
  it('excludes an errored id from data while reporting isError', async () => {
    const { Wrapper } = makeWrapper();
    failNextWith(new Error('permission-denied'));

    const { result } = renderHook(() => useBatchFirestoreDocs({ ...baseOpts, ids: ['u1'] }), {
      wrapper: Wrapper,
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.data).toEqual({});
    expect(result.current.error?.message).toBe('permission-denied');
  });

  it('stops exposing a previously readable doc once access to it fails', async () => {
    existingDocs.set('u1', { displayName: 'Alice' });

    const { Wrapper, queryClient } = makeWrapper();
    const { result } = renderHook(() => useBatchFirestoreDocs({ ...baseOpts, ids: ['u1'] }), {
      wrapper: Wrapper,
    });
    await waitFor(() => expect(result.current.data.u1).toBeTruthy());

    failNextWith(new Error('permission-denied'));
    await act(async () => {
      await queryClient.refetchQueries({ queryKey: ['publicUser', 'u1'], exact: true });
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
    // React Query still holds the last good data; the hook must not present it as readable.
    expect(queryClient.getQueryData(['publicUser', 'u1'])).toMatchObject({
      displayName: 'Alice',
    });
    expect(result.current.data).toEqual({});
  });
});
