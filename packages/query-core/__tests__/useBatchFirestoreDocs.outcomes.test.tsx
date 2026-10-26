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

import type { FirestoreError } from 'firebase/firestore';
import { firestoreError } from '@ttt-productions/firebase-helpers/firestore-client/testing';
import { useBatchFirestoreDocs } from '../src/react/firestore/useBatchFirestoreDocs.js';
import { RESUBSCRIBE_DELAYS_MS } from '../src/react/firestore/resubscribe.js';
import {
  batchReadIn,
  docGetIn,
  docGetOf,
  holdReads,
  listenerOf,
  type ReadHold,
} from './helpers/batch-docs-reads.js';
import { failNext } from './helpers/listener-controls.js';

beforeEach(() => {
  store.reset();
});

afterEach(() => {
  vi.useRealTimers();
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
  collectionPath: 'publicWorks',
  queryKeyPrefix: 'publicWork',
  staleTime: 30 * 60 * 1000,
  absentRetryDelaysMs: [] as readonly number[],
};

const seed = (id: string, data: Record<string, unknown>) => store.seed(`publicWorks/${id}`, data);
const permissionDenied = () => firestoreError('permission-denied', 'permission-denied');
const unavailable = () => firestoreError('unavailable', 'unavailable');

function failListenerOnOpen(id: string, error: FirestoreError) {
  store.failReads(listenerOf('publicWorks', id), error);
}

function heldFor(hold: ReadHold, id: string) {
  const entry = hold.waiting.find((held) => held.ids.includes(id));
  if (!entry) throw new Error(`no read waiting for ${id}`);
  return entry;
}

describe('useBatchFirestoreDocs outcomes — one-shot reads', () => {
  it('reports present, absent, and failed per id, each failure with its own error', async () => {
    seed('w1', { title: 'One' });
    const deniedA = firestoreError('permission-denied', 'permission-denied: a');
    const deniedB = firestoreError('permission-denied', 'permission-denied: b');
    store.failReads(docGetOf('publicWorks', 'hiddenA'), deniedA);
    store.failReads(docGetOf('publicWorks', 'hiddenB'), deniedB);

    const { Wrapper } = makeWrapper();
    const { result } = renderHook(
      () =>
        useBatchFirestoreDocs({
          ...baseOpts,
          transport: 'get',
          ids: ['w1', 'ghost', 'hiddenA', 'hiddenB'],
        }),
      { wrapper: Wrapper },
    );

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.outcomes).toEqual({
      w1: { status: 'present', data: { id: 'w1', title: 'One' } },
      ghost: { status: 'absent' },
      hiddenA: { status: 'failed', error: deniedA, retrying: false },
      hiddenB: { status: 'failed', error: deniedB, retrying: false },
    });
    expect(result.current.outcomes.hiddenB).toEqual({
      status: 'failed',
      error: deniedB,
      retrying: false,
    });
    expect((result.current.outcomes.hiddenB as { error: Error }).error).toBe(deniedB);
    expect(result.current.data).toEqual({ w1: { id: 'w1', title: 'One' } });
    expect(result.current.isError).toBe(true);
    expect(result.current.error).toBe(deniedA);
  });

  it('keeps an id loading until its own read answers', async () => {
    const hold = holdReads(store, docGetIn('publicWorks'));
    seed('w1', { title: 'One' });
    const { Wrapper } = makeWrapper();
    const { result } = renderHook(
      () => useBatchFirestoreDocs({ ...baseOpts, transport: 'get', ids: ['w1', 'ghost'] }),
      { wrapper: Wrapper },
    );

    await waitFor(() => expect(hold.waiting).toHaveLength(2));
    expect(result.current.outcomes).toEqual({
      w1: { status: 'loading' },
      ghost: { status: 'loading' },
    });

    act(() => heldFor(hold, 'w1').release());
    await waitFor(() => expect(result.current.outcomes.w1.status).toBe('present'));
    expect(result.current.outcomes.ghost).toEqual({ status: 'loading' });
  });

  it('keeps an answered document present beside a later failure of its refetch', async () => {
    seed('w1', { title: 'One' });
    const { Wrapper } = makeWrapper();
    const { result } = renderHook(
      () => useBatchFirestoreDocs({ ...baseOpts, transport: 'get', ids: ['w1'] }),
      { wrapper: Wrapper },
    );
    await waitFor(() => expect(result.current.outcomes.w1.status).toBe('present'));

    const failure = unavailable();
    failNext(store, docGetOf('publicWorks', 'w1'), failure);
    await act(async () => {
      await result.current.refetch();
    });

    await waitFor(() =>
      expect(result.current.outcomes.w1).toEqual({
        status: 'present',
        data: { id: 'w1', title: 'One' },
        failure: { error: failure, retrying: false },
      }),
    );
    expect(result.current.data).toEqual({ w1: { id: 'w1', title: 'One' } });
    expect(result.current.isError).toBe(true);
  });

  it('holds the answer through a retry of its failure and drops the failure once the retry answers', async () => {
    seed('w1', { title: 'One' });
    const { Wrapper } = makeWrapper();
    const { result } = renderHook(
      () => useBatchFirestoreDocs({ ...baseOpts, transport: 'get', ids: ['w1'] }),
      { wrapper: Wrapper },
    );
    await waitFor(() => expect(result.current.outcomes.w1.status).toBe('present'));
    const failure = unavailable();
    failNext(store, docGetOf('publicWorks', 'w1'), failure);
    await act(async () => {
      await result.current.refetch();
    });
    await waitFor(() => expect(result.current.isError).toBe(true));

    seed('w1', { title: 'One, again' });
    const hold = holdReads(store, docGetIn('publicWorks'));
    let retry!: Promise<void>;
    act(() => {
      retry = result.current.refetch();
    });
    await waitFor(() => expect(hold.waiting).toHaveLength(1));
    expect(result.current.outcomes.w1).toEqual({
      status: 'present',
      data: { id: 'w1', title: 'One' },
      failure: { error: failure, retrying: true },
    });

    await act(async () => {
      hold.waiting[0].release();
      await retry;
    });
    await waitFor(() =>
      expect(result.current.outcomes.w1).toEqual({
        status: 'present',
        data: { id: 'w1', title: 'One, again' },
      }),
    );
  });

  it('drops an answered document once a refetch of it is denied permission', async () => {
    seed('w1', { title: 'One' });
    const { Wrapper } = makeWrapper();
    const { result } = renderHook(
      () => useBatchFirestoreDocs({ ...baseOpts, transport: 'get', ids: ['w1'] }),
      { wrapper: Wrapper },
    );
    await waitFor(() => expect(result.current.outcomes.w1.status).toBe('present'));

    const denied = permissionDenied();
    failNext(store, docGetOf('publicWorks', 'w1'), denied);
    await act(async () => {
      await result.current.refetch();
    });

    await waitFor(() =>
      expect(result.current.outcomes.w1).toEqual({
        status: 'failed',
        error: denied,
        retrying: false,
      }),
    );
    expect(result.current.data).toEqual({});
  });

  it('marks every id of a failed batch query failed, with that query error', async () => {
    const failure = unavailable();
    store.failReads(batchReadIn('publicWorks'), failure);
    const { Wrapper } = makeWrapper();
    const { result } = renderHook(() => useBatchFirestoreDocs({ ...baseOpts, ids: ['w1', 'w2'] }), {
      wrapper: Wrapper,
    });

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.outcomes).toEqual({
      w1: { status: 'failed', error: failure, retrying: false },
      w2: { status: 'failed', error: failure, retrying: false },
    });
  });

  it('has one entry per requested id, empty ids and duplicates dropped', async () => {
    seed('w1', { title: 'One' });
    const { Wrapper } = makeWrapper();
    const { result } = renderHook(
      () => useBatchFirestoreDocs({ ...baseOpts, ids: ['w1', 'w1', ''] }),
      {
        wrapper: Wrapper,
      },
    );

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(Object.keys(result.current.outcomes)).toEqual(['w1']);
  });

  it('keeps the outcomes map and each unchanged entry identical across renders', async () => {
    seed('w1', { title: 'One' });
    const { Wrapper } = makeWrapper();
    const { result, rerender } = renderHook(
      () => useBatchFirestoreDocs({ ...baseOpts, ids: ['w1', 'ghost'] }),
      { wrapper: Wrapper },
    );
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    const before = result.current.outcomes;
    const presentBefore = before.w1;
    rerender();

    expect(result.current.outcomes).toBe(before);
    expect(result.current.outcomes.w1).toBe(presentBefore);
  });
});

describe('useBatchFirestoreDocs outcomes — subscribe mode', () => {
  it('records a listener error on its own id while the other ids keep their answers', async () => {
    const denied = permissionDenied();
    failListenerOnOpen('hidden', denied);
    seed('w1', { title: 'One' });
    const { Wrapper } = makeWrapper();
    const { result } = renderHook(
      () => useBatchFirestoreDocs({ ...baseOpts, subscribe: true, ids: ['hidden', 'w1', 'ghost'] }),
      { wrapper: Wrapper },
    );

    await waitFor(() =>
      expect(result.current.outcomes).toEqual({
        hidden: { status: 'failed', error: denied, retrying: false },
        w1: { status: 'present', data: { id: 'w1', title: 'One' } },
        ghost: { status: 'absent' },
      }),
    );
    expect(result.current.isError).toBe(true);
    expect(result.current.error).toBe(denied);
  });

  it('keeps two listener errors with their own ids', async () => {
    const errorA = firestoreError('permission-denied', 'permission-denied: a');
    const errorB = firestoreError('unavailable', 'unavailable: b');
    failListenerOnOpen('a', errorA);
    failListenerOnOpen('b', errorB);
    const { Wrapper } = makeWrapper();
    const { result } = renderHook(
      () => useBatchFirestoreDocs({ ...baseOpts, subscribe: true, ids: ['a', 'b'] }),
      { wrapper: Wrapper },
    );

    await waitFor(() => {
      expect((result.current.outcomes.a as { error: Error }).error).toBe(errorA);
      expect((result.current.outcomes.b as { error: Error }).error).toBe(errorB);
    });
  });

  it('gives a consumer that joins an already-failed listener the failure, not an absence', async () => {
    const denied = permissionDenied();
    failListenerOnOpen('hidden', denied);
    const { Wrapper } = makeWrapper();
    const first = renderHook(
      () => useBatchFirestoreDocs({ ...baseOpts, subscribe: true, ids: ['hidden'] }),
      { wrapper: Wrapper },
    );
    await waitFor(() => expect(first.result.current.outcomes.hidden.status).toBe('failed'));

    const late = renderHook(
      () => useBatchFirestoreDocs({ ...baseOpts, subscribe: true, ids: ['hidden'] }),
      { wrapper: Wrapper },
    );

    expect(late.result.current.outcomes.hidden).toEqual({
      status: 'failed',
      error: denied,
      retrying: false,
    });
    expect(late.result.current.isError).toBe(true);
  });

  it('keeps an answered id present beside a later listener failure', async () => {
    seed('w1', { title: 'One' });
    const { Wrapper } = makeWrapper();
    const { result } = renderHook(
      () => useBatchFirestoreDocs({ ...baseOpts, subscribe: true, ids: ['w1'] }),
      { wrapper: Wrapper },
    );
    await waitFor(() => expect(result.current.outcomes.w1.status).toBe('present'));

    const failure = unavailable();
    await act(async () => store.failListeners(listenerOf('publicWorks', 'w1'), failure));

    expect(result.current.outcomes.w1).toEqual({
      status: 'present',
      data: { id: 'w1', title: 'One' },
      failure: { error: failure, retrying: false },
    });
    expect(result.current.data).toEqual({ w1: { id: 'w1', title: 'One' } });
    expect(result.current.isError).toBe(true);
  });

  it('drops an answered id once its listener is denied permission', async () => {
    seed('w1', { title: 'One' });
    const { Wrapper } = makeWrapper();
    const { result } = renderHook(
      () => useBatchFirestoreDocs({ ...baseOpts, subscribe: true, ids: ['w1'] }),
      { wrapper: Wrapper },
    );
    await waitFor(() => expect(result.current.outcomes.w1.status).toBe('present'));

    const denied = permissionDenied();
    await act(async () => store.failListeners(listenerOf('publicWorks', 'w1'), denied));

    expect(result.current.outcomes.w1).toEqual({
      status: 'failed',
      error: denied,
      retrying: false,
    });
    expect(result.current.data).toEqual({});
  });

  it("clears an id's failure when its re-listen after a denial answers", async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    let hidden = true;
    store.failReads((read) => hidden && listenerOf('publicWorks', 'w1')(read), permissionDenied());
    const { Wrapper } = makeWrapper();
    const { result } = renderHook(
      () => useBatchFirestoreDocs({ ...baseOpts, subscribe: true, ids: ['w1'] }),
      { wrapper: Wrapper },
    );
    await vi.waitFor(() => expect(result.current.outcomes.w1.status).toBe('failed'));

    hidden = false;
    seed('w1', { title: 'One' });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(RESUBSCRIBE_DELAYS_MS[0]);
    });

    await vi.waitFor(() =>
      expect(result.current.outcomes.w1).toEqual({
        status: 'present',
        data: { id: 'w1', title: 'One' },
      }),
    );
    expect(result.current.isError).toBe(false);
  });
});

describe('useBatchFirestoreDocs outcomes — a one-shot reader beside a failed listener', () => {
  it('reads failed, not absent, for a key whose shared listener has errored', async () => {
    const denied = permissionDenied();
    failListenerOnOpen('w1', denied);
    const { Wrapper } = makeWrapper();
    const live = renderHook(
      () => useBatchFirestoreDocs({ ...baseOpts, subscribe: true, ids: ['w1'] }),
      { wrapper: Wrapper },
    );
    await waitFor(() => expect(live.result.current.outcomes.w1.status).toBe('failed'));

    const oneShot = renderHook(() => useBatchFirestoreDocs({ ...baseOpts, ids: ['w1'] }), {
      wrapper: Wrapper,
    });

    expect(oneShot.result.current.outcomes.w1).toEqual({
      status: 'failed',
      error: denied,
      retrying: false,
    });
    expect(oneShot.result.current.isError).toBe(true);
  });

  it('answers a refetch with the listener error, never with its null placeholder', async () => {
    seed('w1', { title: 'One' });
    const { Wrapper } = makeWrapper();
    const oneShot = renderHook(() => useBatchFirestoreDocs({ ...baseOpts, ids: ['w1'] }), {
      wrapper: Wrapper,
    });
    await waitFor(() => expect(oneShot.result.current.outcomes.w1.status).toBe('present'));

    const denied = permissionDenied();
    failListenerOnOpen('w1', denied);
    const live = renderHook(
      () => useBatchFirestoreDocs({ ...baseOpts, subscribe: true, ids: ['w1'] }),
      { wrapper: Wrapper },
    );
    await waitFor(() => expect(live.result.current.outcomes.w1.status).toBe('failed'));
    await act(async () => {
      await oneShot.result.current.refetch();
    });

    await waitFor(() =>
      expect(oneShot.result.current.outcomes.w1).toEqual({
        status: 'failed',
        error: denied,
        retrying: false,
      }),
    );
  });

  it('reads the document for itself once the failed listener has no subscriber left', async () => {
    seed('w1', { title: 'One' });
    failListenerOnOpen('w1', permissionDenied());
    const { Wrapper } = makeWrapper();
    const live = renderHook(
      () => useBatchFirestoreDocs({ ...baseOpts, subscribe: true, ids: ['w1'] }),
      { wrapper: Wrapper },
    );
    await waitFor(() => expect(live.result.current.outcomes.w1.status).toBe('failed'));
    const oneShot = renderHook(() => useBatchFirestoreDocs({ ...baseOpts, ids: ['w1'] }), {
      wrapper: Wrapper,
    });
    expect(oneShot.result.current.outcomes.w1.status).toBe('failed');

    live.unmount();

    await waitFor(() =>
      expect(oneShot.result.current.outcomes.w1).toEqual({
        status: 'present',
        data: { id: 'w1', title: 'One' },
      }),
    );
  });
});
