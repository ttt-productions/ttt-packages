import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';

const { store, readDbs } = await vi.hoisted(async () => {
  const { makeInMemoryClientFirestore } =
    await import('@ttt-productions/firebase-helpers/firestore-client/testing');
  const readDbs: Firestore[] = [];
  return { store: makeInMemoryClientFirestore(), readDbs };
});

vi.mock('firebase/firestore', async (importOriginal) => {
  const { clientFirestoreFake } = await import('../../../test/client-firestore-fake.js');
  return clientFirestoreFake(importOriginal, store, {
    getDocs: (query) => {
      readDbs.push(query.firestore);
      return store.reads.getDocs(query);
    },
  });
});

import type { Firestore } from 'firebase/firestore';
import { firestoreError } from '@ttt-productions/firebase-helpers/firestore-client/testing';
import { useBatchFirestoreDocs } from '../src/react/firestore/useBatchFirestoreDocs.js';
import { testFirestore } from './helpers/test-firestore.js';
import {
  getDocLoader,
  MAX_CONCURRENT_BATCH_REQUESTS,
  MAX_CONCURRENT_DOC_GETS,
} from '../src/react/firestore/batch-doc-loader.js';
import {
  batchReadIn,
  docGetIn,
  docGetOf,
  holdReads,
  idsOf,
  readsMatching,
} from './helpers/batch-docs-reads.js';

const batchCalls = () => readsMatching(store, batchReadIn('publicUsers')).map(idsOf);
const getCalls = () => readsMatching(store, docGetIn('publicUsers')).flatMap(idsOf);
const seed = (id: string, data: Record<string, unknown>) => store.seed(`publicUsers/${id}`, data);

beforeEach(() => {
  store.reset();
  readDbs.length = 0;
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
  db: store.db,
  collectionPath: 'publicUsers',
  queryKeyPrefix: 'publicUser',
  staleTime: 30 * 60 * 1000,
  absentRetryDelaysMs: [] as readonly number[],
};

describe("useBatchFirestoreDocs — 'batch' transport", () => {
  it('coalesces ids enqueued in one microtask and chunks them at 30', async () => {
    const ids = Array.from({ length: 60 }, (_, i) => `u${i}`);
    for (const id of ids) seed(id, { v: id });

    const { Wrapper } = makeWrapper();
    const { result } = renderHook(() => useBatchFirestoreDocs({ ...baseOpts, ids }), {
      wrapper: Wrapper,
    });

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(batchCalls()).toHaveLength(2);
    expect(batchCalls().map((ids) => ids.length)).toEqual([30, 30]);
    expect(Object.keys(result.current.data)).toHaveLength(60);
  });

  it('sends one request at exactly 30 ids and two at 31', async () => {
    const ids30 = Array.from({ length: 30 }, (_, i) => `a${i}`);
    for (const id of ids30) seed(id, { v: id });

    const first = renderHook(() => useBatchFirestoreDocs({ ...baseOpts, ids: ids30 }), {
      wrapper: makeWrapper().Wrapper,
    });
    await waitFor(() => expect(first.result.current.isLoading).toBe(false));
    expect(batchCalls()).toHaveLength(1);
    expect(batchCalls()[0]).toHaveLength(30);

    const sentBefore = batchCalls().length;
    const ids31 = Array.from({ length: 31 }, (_, i) => `b${i}`);
    for (const id of ids31) seed(id, { v: id });

    const second = renderHook(() => useBatchFirestoreDocs({ ...baseOpts, ids: ids31 }), {
      wrapper: makeWrapper().Wrapper,
    });
    await waitFor(() => expect(second.result.current.isLoading).toBe(false));
    const sent = batchCalls().slice(sentBefore);
    expect(sent).toHaveLength(2);
    expect(sent.map((ids) => ids.length).sort((a, b) => a - b)).toEqual([1, 30]);
  });

  it('drops an id nobody is waiting on before the request goes out', async () => {
    seed('u2', { v: 2 });
    const loader = getDocLoader(new QueryClient(), baseOpts.db, 'publicUsers');

    const controller = new AbortController();
    const cancelled = loader.loadBatched('u1', controller.signal).catch(() => 'aborted');
    const kept = loader.loadBatched('u2');
    controller.abort();

    expect(await cancelled).toBe('aborted');
    expect(await kept).toMatchObject({ v: 2 });
    expect(batchCalls()).toEqual([['u2']]);
  });

  it('issues ceil(N/30) requests for a non-multiple id count', async () => {
    const ids = Array.from({ length: 45 }, (_, i) => `u${i}`);
    for (const id of ids) seed(id, { v: id });

    const { Wrapper } = makeWrapper();
    const { result } = renderHook(() => useBatchFirestoreDocs({ ...baseOpts, ids }), {
      wrapper: Wrapper,
    });

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(batchCalls()).toHaveLength(2);
    expect(
      batchCalls()
        .map((ids) => ids.length)
        .sort((a, b) => a - b),
    ).toEqual([15, 30]);
  });

  it('never shares a request between two db instances on the same collection path', async () => {
    seed('u1', { v: 1 });
    const dbA = testFirestore();
    const dbB = testFirestore();

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

    expect(batchCalls()).toHaveLength(2);
    expect(readDbs).toEqual([dbA, dbB]);
  });

  it('cancelling one id leaves its batch-mates intact', async () => {
    const hold = holdReads(store, batchReadIn('publicUsers'));
    seed('u1', { v: 1 });
    seed('u2', { v: 2 });

    const { Wrapper, queryClient } = makeWrapper();
    const { result } = renderHook(() => useBatchFirestoreDocs({ ...baseOpts, ids: ['u1', 'u2'] }), {
      wrapper: Wrapper,
    });

    await waitFor(() => expect(hold.waiting).toHaveLength(1));

    await act(async () => {
      await queryClient.cancelQueries({ queryKey: ['publicUser', 'u1'], exact: true });
    });

    await act(async () => {
      hold.waiting[0].release();
      await Promise.resolve();
    });

    await waitFor(() => expect(result.current.data.u2).toMatchObject({ v: 2 }));
    expect(batchCalls()).toHaveLength(1);
  });

  it('a post-cancellation refetch joins a NEW batch, never the dispatched one', async () => {
    holdReads(store, batchReadIn('publicUsers'));
    seed('u1', { v: 1 });
    seed('u2', { v: 2 });

    const { Wrapper, queryClient } = makeWrapper();
    renderHook(() => useBatchFirestoreDocs({ ...baseOpts, ids: ['u1', 'u2'] }), {
      wrapper: Wrapper,
    });

    await waitFor(() => expect(batchCalls()).toHaveLength(1));
    expect(batchCalls()[0].sort()).toEqual(['u1', 'u2']);

    await act(async () => {
      await queryClient.cancelQueries({ queryKey: ['publicUser', 'u1'], exact: true });
    });

    await act(async () => {
      void queryClient.refetchQueries({ queryKey: ['publicUser', 'u1'], exact: true });
      await Promise.resolve();
      await Promise.resolve();
    });

    await waitFor(() => expect(batchCalls()).toHaveLength(2));
    expect(batchCalls()[1]).toEqual(['u1']);
  });

  it('a late batch result cannot overwrite a newer per-id result', async () => {
    seed('u1', { v: 'old' });

    const { Wrapper, queryClient } = makeWrapper();
    const { result } = renderHook(() => useBatchFirestoreDocs({ ...baseOpts, ids: ['u1'] }), {
      wrapper: Wrapper,
    });

    await waitFor(() => expect(result.current.data.u1).toMatchObject({ v: 'old' }));

    const hold = holdReads(store, batchReadIn('publicUsers'));

    // TanStack cancels the first refetch when a second starts because the query already holds data.
    await act(async () => {
      void queryClient.refetchQueries({ queryKey: ['publicUser', 'u1'], exact: true });
      await Promise.resolve();
      await Promise.resolve();
    });
    await waitFor(() => expect(batchCalls()).toHaveLength(2));

    await act(async () => {
      void queryClient.refetchQueries({ queryKey: ['publicUser', 'u1'], exact: true });
      await Promise.resolve();
      await Promise.resolve();
    });
    await waitFor(() => expect(batchCalls()).toHaveLength(3));
    const [cancelled, latest] = hold.waiting;

    seed('u1', { v: 'new' });
    await act(async () => {
      latest.release();
      await Promise.resolve();
    });
    await waitFor(() => expect(result.current.data.u1).toMatchObject({ v: 'new' }));

    seed('u1', { v: 'stale' });
    await act(async () => {
      cancelled.release();
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(queryClient.getQueryData(['publicUser', 'u1'])).toMatchObject({ v: 'new' });
    expect(result.current.data.u1).toMatchObject({ v: 'new' });
  });

  it('bounds the number of in-flight batch requests', async () => {
    const hold = holdReads(store, batchReadIn('publicUsers'));
    const ids = Array.from({ length: 30 * (MAX_CONCURRENT_BATCH_REQUESTS + 1) }, (_, i) => `u${i}`);
    for (const id of ids) seed(id, { v: id });

    const { Wrapper } = makeWrapper();
    renderHook(() => useBatchFirestoreDocs({ ...baseOpts, ids }), { wrapper: Wrapper });

    await waitFor(() => expect(batchCalls()).toHaveLength(MAX_CONCURRENT_BATCH_REQUESTS));
    await act(async () => {
      await Promise.resolve();
    });
    expect(batchCalls()).toHaveLength(MAX_CONCURRENT_BATCH_REQUESTS);

    await act(async () => {
      hold.waiting[0].release();
      await Promise.resolve();
    });
    await waitFor(() => expect(batchCalls()).toHaveLength(MAX_CONCURRENT_BATCH_REQUESTS + 1));
  });
});

describe("useBatchFirestoreDocs — 'get' transport", () => {
  const getOpts = { ...baseOpts, transport: 'get' as const };

  it('isolates a denied id: it errors alone and is excluded from data', async () => {
    seed('readable', { v: 1 });
    store.failReads(
      docGetOf('publicUsers', 'hidden'),
      firestoreError('permission-denied', 'permission-denied'),
    );

    const { Wrapper } = makeWrapper();
    const { result } = renderHook(
      () => useBatchFirestoreDocs({ ...getOpts, ids: ['readable', 'hidden', 'missing'] }),
      { wrapper: Wrapper },
    );

    await waitFor(() => expect(result.current.isError).toBe(true));
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.data).toEqual({ readable: { id: 'readable', v: 1 } });
    expect(result.current.error?.message).toBe('permission-denied');
    expect(getCalls().sort()).toEqual(['hidden', 'missing', 'readable']);
    expect(batchCalls()).toEqual([]);
  });

  it('bounds the number of in-flight document gets', async () => {
    const hold = holdReads(store, docGetIn('publicUsers'));
    const ids = Array.from({ length: MAX_CONCURRENT_DOC_GETS + 3 }, (_, i) => `u${i}`);
    for (const id of ids) seed(id, { v: id });

    const { Wrapper } = makeWrapper();
    renderHook(() => useBatchFirestoreDocs({ ...getOpts, ids }), { wrapper: Wrapper });

    await waitFor(() => expect(getCalls()).toHaveLength(MAX_CONCURRENT_DOC_GETS));
    await act(async () => {
      await Promise.resolve();
    });
    expect(getCalls()).toHaveLength(MAX_CONCURRENT_DOC_GETS);

    await act(async () => {
      hold.waiting[0].release();
      await Promise.resolve();
    });
    await waitFor(() => expect(getCalls()).toHaveLength(MAX_CONCURRENT_DOC_GETS + 1));
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
