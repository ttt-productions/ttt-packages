import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';

type DocData = Record<string, unknown>;

type BatchCall = {
  ids: string[];
  db: unknown;
  path: string;
  release: () => void;
  fail: (error: unknown) => void;
};

type DocGetCall = {
  id: string;
  release: () => void;
};

const {
  docs,
  denied,
  batchCalls,
  getCalls,
  docGetCalls,
  getDocsMock,
  getDocMock,
  setAutoResolve,
} = vi.hoisted(() => {
  const docs = new Map<string, DocData>();
  const denied = new Set<string>();
  const batchCalls: BatchCall[] = [];
  const getCalls: string[] = [];
  const docGetCalls: DocGetCall[] = [];
  let autoResolve = true;

    const snapshotFor = (ids: string[]) => ({
      forEach: (cb: (d: { id: string; data: () => DocData }) => void) => {
        for (const id of ids) {
          const data = docs.get(id);
          if (data !== undefined) cb({ id, data: () => data });
        }
      },
    });

    const getDocsMock = vi.fn((q: { __ids: string[]; __db: unknown; __path: string }) => {
      const call: BatchCall = {
        ids: q.__ids,
        db: q.__db,
        path: q.__path,
        release: () => {},
        fail: () => {},
      };
      batchCalls.push(call);
      if (autoResolve) return Promise.resolve(snapshotFor(q.__ids));
      return new Promise((resolve, reject) => {
        call.release = () => resolve(snapshotFor(q.__ids));
        call.fail = (error: unknown) => reject(error);
      });
    });

    const getDocMock = vi.fn((ref: { __id: string }) => {
      getCalls.push(ref.__id);
      const call: DocGetCall = { id: ref.__id, release: () => {} };
      docGetCalls.push(call);
      if (denied.has(ref.__id)) return Promise.reject(new Error('permission-denied'));
      const data = docs.get(ref.__id);
      const snapshot = {
        exists: () => data !== undefined,
        id: ref.__id,
        data: () => data,
      };
      if (autoResolve) return Promise.resolve(snapshot);
      return new Promise((resolve) => {
        call.release = () => resolve(snapshot);
      });
    });

    const setAutoResolve = (value: boolean) => {
      autoResolve = value;
    };

  return {
    docs,
    denied,
    batchCalls,
    getCalls,
    docGetCalls,
    getDocsMock,
    getDocMock,
    setAutoResolve,
  };
});

vi.mock('firebase/firestore', () => ({
  collection: (db: unknown, path: string) => ({ __db: db, __path: path }),
  where: (_field: unknown, _op: unknown, ids: string[]) => ({ __ids: ids }),
  query: (source: { __db: unknown; __path: string }, constraint: { __ids: string[] }) => ({
    __db: source.__db,
    __path: source.__path,
    __ids: constraint.__ids,
  }),
  documentId: () => '__name__',
  getDocs: getDocsMock,
  doc: (_db: unknown, _path: string, id: string) => ({ __id: id }),
  getDoc: getDocMock,
  onSnapshot: vi.fn(),
}));

import { useBatchFirestoreDocs } from '../src/react/firestore/useBatchFirestoreDocs.js';
import {
  getDocLoader,
  MAX_CONCURRENT_BATCH_REQUESTS,
  MAX_CONCURRENT_DOC_GETS,
} from '../src/react/firestore/batch-doc-loader.js';

beforeEach(() => {
  docs.clear();
  denied.clear();
  batchCalls.length = 0;
  getCalls.length = 0;
  docGetCalls.length = 0;
  getDocsMock.mockClear();
  getDocMock.mockClear();
  setAutoResolve(true);
});

function makeWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: Infinity } },
  });
  const Wrapper = ({ children }: { children: React.ReactNode }) =>
    React.createElement(QueryClientProvider, { client: queryClient }, children);
  Wrapper.displayName = 'TestWrapper';
  return { queryClient, Wrapper };
}

const baseOpts = {
  db: { name: 'primary' } as never,
  collectionPath: 'publicUsers',
  queryKeyPrefix: 'publicUser',
  staleTime: 30 * 60 * 1000,
  // The absence ladder is exercised in its own suite; keep it out of these reads.
  absentRetryDelaysMs: [] as readonly number[],
};

describe("useBatchFirestoreDocs — 'batch' transport", () => {
  it('coalesces ids enqueued in one microtask and chunks them at 30', async () => {
    const ids = Array.from({ length: 60 }, (_, i) => `u${i}`);
    for (const id of ids) docs.set(id, { v: id });

    const { Wrapper } = makeWrapper();
    const { result } = renderHook(() => useBatchFirestoreDocs({ ...baseOpts, ids }), {
      wrapper: Wrapper,
    });

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(getDocsMock).toHaveBeenCalledTimes(2);
    expect(batchCalls.map((c) => c.ids.length).sort()).toEqual([30, 30]);
    expect(Object.keys(result.current.data)).toHaveLength(60);
  });

  it('sends one request at exactly 30 ids and two at 31', async () => {
    const ids30 = Array.from({ length: 30 }, (_, i) => `a${i}`);
    for (const id of ids30) docs.set(id, { v: id });

    const first = renderHook(
      () => useBatchFirestoreDocs({ ...baseOpts, ids: ids30 }),
      { wrapper: makeWrapper().Wrapper },
    );
    await waitFor(() => expect(first.result.current.isLoading).toBe(false));
    expect(batchCalls).toHaveLength(1);
    expect(batchCalls[0].ids).toHaveLength(30);

    batchCalls.length = 0;
    const ids31 = Array.from({ length: 31 }, (_, i) => `b${i}`);
    for (const id of ids31) docs.set(id, { v: id });

    const second = renderHook(
      () => useBatchFirestoreDocs({ ...baseOpts, ids: ids31 }),
      { wrapper: makeWrapper().Wrapper },
    );
    await waitFor(() => expect(second.result.current.isLoading).toBe(false));
    expect(batchCalls).toHaveLength(2);
    expect(batchCalls.map((c) => c.ids.length).sort((a, b) => a - b)).toEqual([1, 30]);
  });

  it('drops an id nobody is waiting on before the request goes out', async () => {
    docs.set('u2', { v: 2 });
    const loader = getDocLoader(new QueryClient(), baseOpts.db, 'publicUsers');

    const controller = new AbortController();
    const cancelled = loader.loadBatched('u1', controller.signal).catch(() => 'aborted');
    const kept = loader.loadBatched('u2');
    controller.abort();

    expect(await cancelled).toBe('aborted');
    expect(await kept).toMatchObject({ v: 2 });
    // u1 never rode into the billed `in` query.
    expect(batchCalls).toHaveLength(1);
    expect(batchCalls[0].ids).toEqual(['u2']);
  });

  it('issues ceil(N/30) requests for a non-multiple id count', async () => {
    const ids = Array.from({ length: 45 }, (_, i) => `u${i}`);
    for (const id of ids) docs.set(id, { v: id });

    const { Wrapper } = makeWrapper();
    const { result } = renderHook(() => useBatchFirestoreDocs({ ...baseOpts, ids }), {
      wrapper: Wrapper,
    });

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(getDocsMock).toHaveBeenCalledTimes(2);
    expect(batchCalls.map((c) => c.ids.length).sort((a, b) => a - b)).toEqual([15, 30]);
  });

  it('never shares a request between two db instances on the same collection path', async () => {
    docs.set('u1', { v: 1 });
    const dbA = { name: 'a' } as never;
    const dbB = { name: 'b' } as never;

    const { Wrapper } = makeWrapper();
    const a = renderHook(
      () => useBatchFirestoreDocs({ ...baseOpts, db: dbA, queryKeyPrefix: 'a', ids: ['u1'] }),
      { wrapper: Wrapper },
    );
    const b = renderHook(
      () => useBatchFirestoreDocs({ ...baseOpts, db: dbB, queryKeyPrefix: 'b', ids: ['u1'] }),
      { wrapper: Wrapper },
    );

    await waitFor(() => expect(a.result.current.isLoading).toBe(false));
    await waitFor(() => expect(b.result.current.isLoading).toBe(false));

    expect(getDocsMock).toHaveBeenCalledTimes(2);
    expect(batchCalls.map((c) => c.db)).toEqual([dbA, dbB]);
  });

  it('cancelling one id leaves its batch-mates intact', async () => {
    setAutoResolve(false);
    docs.set('u1', { v: 1 });
    docs.set('u2', { v: 2 });

    const { Wrapper, queryClient } = makeWrapper();
    const { result } = renderHook(
      () => useBatchFirestoreDocs({ ...baseOpts, ids: ['u1', 'u2'] }),
      { wrapper: Wrapper },
    );

    await waitFor(() => expect(batchCalls).toHaveLength(1));

    await act(async () => {
      await queryClient.cancelQueries({ queryKey: ['publicUser', 'u1'], exact: true });
    });

    await act(async () => {
      batchCalls[0].release();
      await Promise.resolve();
    });

    await waitFor(() => expect(result.current.data.u2).toMatchObject({ v: 2 }));
    // One shared request served the whole batch; cancelling u1 did not cancel it.
    expect(getDocsMock).toHaveBeenCalledTimes(1);
  });

  it('a post-cancellation refetch joins a NEW batch, never the dispatched one', async () => {
    setAutoResolve(false);
    docs.set('u1', { v: 1 });
    docs.set('u2', { v: 2 });

    const { Wrapper, queryClient } = makeWrapper();
    renderHook(() => useBatchFirestoreDocs({ ...baseOpts, ids: ['u1', 'u2'] }), {
      wrapper: Wrapper,
    });

    await waitFor(() => expect(batchCalls).toHaveLength(1));
    expect(batchCalls[0].ids.sort()).toEqual(['u1', 'u2']);

    await act(async () => {
      await queryClient.cancelQueries({ queryKey: ['publicUser', 'u1'], exact: true });
    });

    await act(async () => {
      void queryClient.refetchQueries({ queryKey: ['publicUser', 'u1'], exact: true });
      await Promise.resolve();
      await Promise.resolve();
    });

    await waitFor(() => expect(batchCalls).toHaveLength(2));
    expect(batchCalls[1].ids).toEqual(['u1']);
  });

  it('a late batch result cannot overwrite a newer per-id result', async () => {
    docs.set('u1', { v: 'old' });

    const { Wrapper, queryClient } = makeWrapper();
    const { result } = renderHook(() => useBatchFirestoreDocs({ ...baseOpts, ids: ['u1'] }), {
      wrapper: Wrapper,
    });

    await waitFor(() => expect(result.current.data.u1).toMatchObject({ v: 'old' }));

    setAutoResolve(false);

    // Refetch #1 goes in flight, then a second refetch supersedes it (TanStack cancels the
    // first fetch because the query already holds data).
    await act(async () => {
      void queryClient.refetchQueries({ queryKey: ['publicUser', 'u1'], exact: true });
      await Promise.resolve();
      await Promise.resolve();
    });
    await waitFor(() => expect(batchCalls).toHaveLength(2));

    await act(async () => {
      void queryClient.refetchQueries({ queryKey: ['publicUser', 'u1'], exact: true });
      await Promise.resolve();
      await Promise.resolve();
    });
    await waitFor(() => expect(batchCalls).toHaveLength(3));

    // The NEWER request lands first…
    docs.set('u1', { v: 'new' });
    await act(async () => {
      batchCalls[2].release();
      await Promise.resolve();
    });
    await waitFor(() => expect(result.current.data.u1).toMatchObject({ v: 'new' }));

    // …and the superseded one lands afterwards with a stale value.
    docs.set('u1', { v: 'stale' });
    await act(async () => {
      batchCalls[1].release();
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(queryClient.getQueryData(['publicUser', 'u1'])).toMatchObject({ v: 'new' });
    expect(result.current.data.u1).toMatchObject({ v: 'new' });
  });

  it('bounds the number of in-flight batch requests', async () => {
    setAutoResolve(false);
    const ids = Array.from({ length: 30 * (MAX_CONCURRENT_BATCH_REQUESTS + 1) }, (_, i) => `u${i}`);
    for (const id of ids) docs.set(id, { v: id });

    const { Wrapper } = makeWrapper();
    renderHook(() => useBatchFirestoreDocs({ ...baseOpts, ids }), { wrapper: Wrapper });

    await waitFor(() => expect(batchCalls).toHaveLength(MAX_CONCURRENT_BATCH_REQUESTS));
    // Still capped after the microtask queue drains.
    await act(async () => {
      await Promise.resolve();
    });
    expect(batchCalls).toHaveLength(MAX_CONCURRENT_BATCH_REQUESTS);

    await act(async () => {
      batchCalls[0].release();
      await Promise.resolve();
    });
    await waitFor(() => expect(batchCalls).toHaveLength(MAX_CONCURRENT_BATCH_REQUESTS + 1));
  });
});

describe("useBatchFirestoreDocs — 'get' transport", () => {
  const getOpts = { ...baseOpts, transport: 'get' as const };

  it('isolates a denied id: it errors alone and is excluded from data', async () => {
    docs.set('readable', { v: 1 });
    denied.add('hidden');

    const { Wrapper } = makeWrapper();
    const { result } = renderHook(
      () => useBatchFirestoreDocs({ ...getOpts, ids: ['readable', 'hidden', 'missing'] }),
      { wrapper: Wrapper },
    );

    await waitFor(() => expect(result.current.isError).toBe(true));
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.data).toEqual({ readable: { id: 'readable', v: 1 } });
    expect(result.current.error?.message).toBe('permission-denied');
    expect(getCalls.sort()).toEqual(['hidden', 'missing', 'readable']);
    // Per-document gets — never a list query.
    expect(getDocsMock).not.toHaveBeenCalled();
  });

  it('bounds the number of in-flight document gets', async () => {
    setAutoResolve(false);
    const ids = Array.from({ length: MAX_CONCURRENT_DOC_GETS + 3 }, (_, i) => `u${i}`);
    for (const id of ids) docs.set(id, { v: id });

    const { Wrapper } = makeWrapper();
    renderHook(() => useBatchFirestoreDocs({ ...getOpts, ids }), { wrapper: Wrapper });

    await waitFor(() => expect(docGetCalls).toHaveLength(MAX_CONCURRENT_DOC_GETS));
    await act(async () => {
      await Promise.resolve();
    });
    expect(docGetCalls).toHaveLength(MAX_CONCURRENT_DOC_GETS);

    await act(async () => {
      docGetCalls[0].release();
      await Promise.resolve();
    });
    await waitFor(() => expect(docGetCalls).toHaveLength(MAX_CONCURRENT_DOC_GETS + 1));
  });

  it('negative-caches a missing id as null', async () => {
    const { Wrapper, queryClient } = makeWrapper();
    const { result } = renderHook(() => useBatchFirestoreDocs({ ...getOpts, ids: ['ghost'] }), {
      wrapper: Wrapper,
    });

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(queryClient.getQueryData(['publicUser', 'ghost'])).toBeNull();
    expect(result.current.data).toEqual({});
  });
});
