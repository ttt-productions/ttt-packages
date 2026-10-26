import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
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

import { firestoreError } from '@ttt-productions/firebase-helpers/firestore-client/testing';
import { useBatchFirestoreDocs } from '../src/react/firestore/useBatchFirestoreDocs.js';
import { __activeListenerCount } from '../src/react/firestore/doc-subscription-registry.js';
import { RESUBSCRIBE_DELAYS_MS } from '../src/react/firestore/resubscribe.js';
import {
  batchReadIn,
  holdReads,
  listenerOf,
  listenersIn,
  oneShotReadIn,
  readsMatching,
} from './helpers/batch-docs-reads.js';

const seed = (id: string, data: Record<string, unknown>) => store.seed(`publicUsers/${id}`, data);
const listenersOpened = () => readsMatching(store, listenersIn('publicUsers')).length;
const batchReads = () => readsMatching(store, batchReadIn('publicUsers')).length;
const permissionDenied = () => firestoreError('permission-denied', 'permission-denied');

beforeEach(() => {
  store.reset();
});

afterEach(() => {
  vi.useRealTimers();
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

const baseOpts = {
  db: store.db,
  collectionPath: 'publicUsers',
  queryKeyPrefix: 'publicUser',
  subscribe: true,
};

describe('useBatchFirestoreDocs — subscribe mode', () => {
  it('starts loading, then populates data from a snapshot', async () => {
    seed('u1', { displayName: 'Alice' });
    const { Wrapper } = makeWrapper();
    const { result } = renderHook(() => useBatchFirestoreDocs({ ...baseOpts, ids: ['u1'] }), {
      wrapper: Wrapper,
    });

    expect(result.current.isLoading).toBe(true);
    expect(result.current.data).toEqual({});

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.data).toEqual({ u1: { id: 'u1', displayName: 'Alice' } });
  });

  it('caches a missing doc as resolved (negative caching) and excludes it from data', async () => {
    const { Wrapper, queryClient } = makeWrapper();
    const { result } = renderHook(() => useBatchFirestoreDocs({ ...baseOpts, ids: ['ghost'] }), {
      wrapper: Wrapper,
    });

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.data).toEqual({});
    expect(queryClient.getQueryData(['publicUser', 'ghost'])).toBeNull();
  });

  it('pushes live updates when the doc changes', async () => {
    seed('u1', { displayName: 'Alice' });
    const { Wrapper } = makeWrapper();
    const { result } = renderHook(() => useBatchFirestoreDocs({ ...baseOpts, ids: ['u1'] }), {
      wrapper: Wrapper,
    });

    await waitFor(() => expect(result.current.data.u1).toMatchObject({ displayName: 'Alice' }));

    await act(async () => seed('u1', { displayName: 'Alice Smith' }));
    expect(result.current.data.u1).toMatchObject({ displayName: 'Alice Smith' });
  });

  it('shares ONE listener per id across hook instances (reference-counted)', async () => {
    seed('u1', { displayName: 'Alice' });
    const { Wrapper, queryClient } = makeWrapper();
    const a = renderHook(() => useBatchFirestoreDocs({ ...baseOpts, ids: ['u1'] }), {
      wrapper: Wrapper,
    });
    const b = renderHook(() => useBatchFirestoreDocs({ ...baseOpts, ids: ['u1'] }), {
      wrapper: Wrapper,
    });

    expect(__activeListenerCount(queryClient)).toBe(1);
    expect(listenersOpened()).toBe(1);

    await waitFor(() => expect(a.result.current.data.u1).toMatchObject({ displayName: 'Alice' }));
    expect(b.result.current.data.u1).toMatchObject({ displayName: 'Alice' });

    a.unmount();
    expect(__activeListenerCount(queryClient)).toBe(1);
    expect(store.liveListeners()).toBe(1);

    b.unmount();
    expect(__activeListenerCount(queryClient)).toBe(0);
    expect(store.liveListeners()).toBe(0);
  });

  it('does not open listeners in the default (one-shot) mode', () => {
    const { Wrapper } = makeWrapper();
    renderHook(() => useBatchFirestoreDocs({ ...baseOpts, subscribe: false, ids: ['u1'] }), {
      wrapper: Wrapper,
    });
    expect(listenersOpened()).toBe(0);
  });

  it('a listener error resolves the id with its error, never forever-loading', async () => {
    store.failReads(listenerOf('publicUsers', 'hidden'), permissionDenied());
    const { Wrapper, queryClient } = makeWrapper();
    const { result } = renderHook(() => useBatchFirestoreDocs({ ...baseOpts, ids: ['hidden'] }), {
      wrapper: Wrapper,
    });

    expect(result.current.isLoading).toBe(true);

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.data).toEqual({});
    expect(result.current.isError).toBe(true);
    expect(result.current.error?.message).toBe('permission-denied');
    expect(queryClient.getQueryData(['publicUser', 'hidden'])).toBeNull();
  });

  it('an errored id resolves while other ids in the batch still load and land', async () => {
    const hold = holdReads(store, listenerOf('publicUsers', 'u1'));
    store.failReads(listenerOf('publicUsers', 'hidden'), permissionDenied());
    seed('u1', { displayName: 'Alice' });
    const { Wrapper } = makeWrapper();
    const { result } = renderHook(
      () => useBatchFirestoreDocs({ ...baseOpts, ids: ['hidden', 'u1'] }),
      { wrapper: Wrapper },
    );

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(hold.waiting).toHaveLength(1);
    expect(result.current.isLoading).toBe(true);

    act(() => hold.waiting[0].release());
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.data).toEqual({ u1: { id: 'u1', displayName: 'Alice' } });
    expect(result.current.isError).toBe(true);
  });

  it('re-listens on the backoff after a denial and shows the doc once it is readable again', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    let hidden = true;
    store.failReads((read) => hidden && listenerOf('publicUsers', 'u1')(read), permissionDenied());
    const { Wrapper, queryClient } = makeWrapper();
    const { result } = renderHook(() => useBatchFirestoreDocs({ ...baseOpts, ids: ['u1'] }), {
      wrapper: Wrapper,
    });

    await vi.waitFor(() => expect(result.current.isError).toBe(true));
    expect(queryClient.getQueryData(['publicUser', 'u1'])).toBeNull();

    hidden = false;
    seed('u1', { displayName: 'Alice' });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(RESUBSCRIBE_DELAYS_MS[0]);
    });

    await vi.waitFor(() => expect(result.current.data.u1).toMatchObject({ displayName: 'Alice' }));
    expect(result.current.isError).toBe(false);
  });

  it('stays failed once every re-listen on the backoff has been denied', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    const denial = permissionDenied();
    store.failReads(listenerOf('publicUsers', 'u1'), denial);
    const { Wrapper } = makeWrapper();
    const { result } = renderHook(() => useBatchFirestoreDocs({ ...baseOpts, ids: ['u1'] }), {
      wrapper: Wrapper,
    });
    await vi.waitFor(() => expect(result.current.isError).toBe(true));

    for (const delay of RESUBSCRIBE_DELAYS_MS) {
      await act(async () => {
        await vi.advanceTimersByTimeAsync(delay);
      });
    }
    await act(async () => {
      await vi.advanceTimersByTimeAsync(RESUBSCRIBE_DELAYS_MS.at(-1) ?? 0);
    });

    expect(listenersOpened()).toBe(1 + RESUBSCRIBE_DELAYS_MS.length);
    expect(result.current.outcomes.u1).toEqual({
      status: 'failed',
      error: denial,
      retrying: false,
    });
  });

  it('cancels a pending re-listen when the last subscriber unmounts', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    store.failReads(listenerOf('publicUsers', 'u1'), permissionDenied());
    const { Wrapper } = makeWrapper();
    const { result, unmount } = renderHook(
      () => useBatchFirestoreDocs({ ...baseOpts, ids: ['u1'] }),
      { wrapper: Wrapper },
    );
    await vi.waitFor(() => expect(result.current.isError).toBe(true));

    unmount();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(RESUBSCRIBE_DELAYS_MS[0]);
    });

    expect(listenersOpened()).toBe(1);
  });

  it('refetch() is a no-op — it never issues reads against the disabled queries', async () => {
    seed('u1', { displayName: 'Alice' });
    const { Wrapper } = makeWrapper();
    const { result } = renderHook(() => useBatchFirestoreDocs({ ...baseOpts, ids: ['u1', 'u2'] }), {
      wrapper: Wrapper,
    });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    await act(async () => {
      await result.current.refetch();
    });

    expect(readsMatching(store, oneShotReadIn('publicUsers'))).toEqual([]);
    expect(result.current.data).toEqual({ u1: { id: 'u1', displayName: 'Alice' } });
  });

  it('switches one-shot → subscribe → one-shot without losing the entry', async () => {
    seed('u1', { displayName: 'FromRead' });

    const { Wrapper } = makeWrapper();
    const { result, rerender } = renderHook(
      ({ subscribe }: { subscribe: boolean }) =>
        useBatchFirestoreDocs({
          ...baseOpts,
          subscribe,
          ids: ['u1'],
          staleTime: 30 * 60 * 1000,
          absentRetryDelaysMs: [] as readonly number[],
        }),
      { wrapper: Wrapper, initialProps: { subscribe: false } },
    );

    await waitFor(() => expect(result.current.data.u1).toMatchObject({ displayName: 'FromRead' }));
    expect(listenersOpened()).toBe(0);
    expect(batchReads()).toBe(1);

    act(() => {
      rerender({ subscribe: true });
    });
    expect(listenersOpened()).toBe(1);

    await waitFor(() => expect(store.liveListeners()).toBe(1));
    await act(async () => seed('u1', { displayName: 'FromListener' }));
    expect(result.current.data.u1).toMatchObject({ displayName: 'FromListener' });

    act(() => {
      rerender({ subscribe: false });
    });
    expect(store.liveListeners()).toBe(0);
    await waitFor(() =>
      expect(result.current.data.u1).toMatchObject({ displayName: 'FromListener' }),
    );
    expect(batchReads()).toBe(1);
  });

  it('a one-shot read still in flight cannot clobber the listener value', async () => {
    const hold = holdReads(store, batchReadIn('publicUsers'), 'after-answer');
    seed('u1', { displayName: 'InFlight' });

    const { Wrapper, queryClient } = makeWrapper();
    const { result, rerender } = renderHook(
      ({ subscribe }: { subscribe: boolean }) =>
        useBatchFirestoreDocs({
          ...baseOpts,
          subscribe,
          ids: ['u1'],
          absentRetryDelaysMs: [] as readonly number[],
        }),
      { wrapper: Wrapper, initialProps: { subscribe: false } },
    );

    await waitFor(() => expect(hold.waiting).toHaveLength(1));

    act(() => {
      rerender({ subscribe: true });
    });
    seed('u1', { displayName: 'FromListener' });
    await waitFor(() =>
      expect(result.current.data.u1).toMatchObject({ displayName: 'FromListener' }),
    );

    await act(async () => {
      hold.waiting[0].release();
      await Promise.resolve();
      await Promise.resolve();
    });
    await waitFor(() =>
      expect(queryClient.getQueryState(['publicUser', 'u1'])?.fetchStatus).toBe('idle'),
    );

    expect(queryClient.getQueryData(['publicUser', 'u1'])).toMatchObject({
      displayName: 'FromListener',
    });
    expect(result.current.data.u1).toMatchObject({ displayName: 'FromListener' });
  });

  it("a sibling consumer's in-flight one-shot read resolves without clobbering the listener", async () => {
    const hold = holdReads(store, batchReadIn('publicUsers'), 'after-answer');
    seed('u1', { displayName: 'InFlight' });

    const { Wrapper, queryClient } = makeWrapper();
    const oneShot = renderHook(
      () =>
        useBatchFirestoreDocs({
          ...baseOpts,
          subscribe: false,
          ids: ['u1'],
          absentRetryDelaysMs: [] as readonly number[],
        }),
      { wrapper: Wrapper },
    );
    await waitFor(() => expect(hold.waiting).toHaveLength(1));

    seed('u1', { displayName: 'FromListener' });
    const subscribed = renderHook(() => useBatchFirestoreDocs({ ...baseOpts, ids: ['u1'] }), {
      wrapper: Wrapper,
    });
    await waitFor(() =>
      expect(subscribed.result.current.data.u1).toMatchObject({ displayName: 'FromListener' }),
    );

    await act(async () => {
      hold.waiting[0].release();
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(queryClient.getQueryData(['publicUser', 'u1'])).toMatchObject({
      displayName: 'FromListener',
    });
    await waitFor(() => expect(oneShot.result.current.isLoading).toBe(false));
    expect(oneShot.result.current.data.u1).toMatchObject({ displayName: 'FromListener' });
    expect(subscribed.result.current.data.u1).toMatchObject({ displayName: 'FromListener' });
  });
});
