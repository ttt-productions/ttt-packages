import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';

type DocData = Record<string, unknown>;

const { docs, denials, batchFailure, pendingGets, setAutoResolve, caps, getDocsMock, getDocMock, onSnapshotMock } =
  vi.hoisted(() => {
    const docs = new Map<string, DocData>();
    const denials = new Map<string, Error>();
    const batchFailure: { error: Error | null } = { error: null };
    const pendingGets: Array<() => void> = [];
    let autoResolve = true;
    const caps = new Map<string, { next: (snap: unknown) => void; error: (e: Error) => void }>();

    const getDocsMock = vi.fn((q: { __ids: string[] }) => {
      if (batchFailure.error) return Promise.reject(batchFailure.error);
      return Promise.resolve({
        forEach: (cb: (d: { id: string; data: () => DocData }) => void) => {
          for (const id of q.__ids) {
            const data = docs.get(id);
            if (data !== undefined) cb({ id, data: () => data });
          }
        },
      });
    });

    const getDocMock = vi.fn((ref: { __id: string }) => {
      const answer = () => {
        const denial = denials.get(ref.__id);
        if (denial) return Promise.reject(denial);
        const data = docs.get(ref.__id);
        return Promise.resolve({ exists: () => data !== undefined, id: ref.__id, data: () => data });
      };
      if (autoResolve) return answer();
      return new Promise((resolve, reject) => {
        pendingGets.push(() => {
          answer().then(resolve, reject);
        });
      });
    });

    const onSnapshotMock = vi.fn(
      (ref: { __id: string }, next: (s: unknown) => void, error: (e: Error) => void) => {
        caps.set(ref.__id, { next, error });
        return vi.fn();
      },
    );

    return {
      docs,
      denials,
      batchFailure,
      pendingGets,
      setAutoResolve: (value: boolean) => {
        autoResolve = value;
      },
      caps,
      getDocsMock,
      getDocMock,
      onSnapshotMock,
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
  onSnapshot: onSnapshotMock,
}));

import { useBatchFirestoreDocs } from '../src/react/firestore/useBatchFirestoreDocs.js';

beforeEach(() => {
  docs.clear();
  denials.clear();
  batchFailure.error = null;
  pendingGets.length = 0;
  setAutoResolve(true);
  caps.clear();
  getDocsMock.mockClear();
  getDocMock.mockClear();
  onSnapshotMock.mockClear();
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
  collectionPath: 'publicWorks',
  queryKeyPrefix: 'publicWork',
  staleTime: 30 * 60 * 1000,
  absentRetryDelaysMs: [] as readonly number[],
};

function emit(id: string, data: DocData | null) {
  act(() => {
    caps.get(id)!.next({ exists: () => data != null, id, data: () => data });
  });
}

function emitError(id: string, error: Error) {
  act(() => {
    caps.get(id)!.error(error);
  });
}

describe('useBatchFirestoreDocs outcomes — one-shot reads', () => {
  it('reports present, absent, and failed per id, each failure with its own error', async () => {
    docs.set('w1', { title: 'One' });
    const deniedA = new Error('permission-denied: a');
    const deniedB = new Error('permission-denied: b');
    denials.set('hiddenA', deniedA);
    denials.set('hiddenB', deniedB);

    const { Wrapper } = makeWrapper();
    const { result } = renderHook(
      () => useBatchFirestoreDocs({ ...baseOpts, transport: 'get', ids: ['w1', 'ghost', 'hiddenA', 'hiddenB'] }),
      { wrapper: Wrapper },
    );

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.outcomes).toEqual({
      w1: { status: 'present', data: { id: 'w1', title: 'One' } },
      ghost: { status: 'absent' },
      hiddenA: { status: 'failed', error: deniedA },
      hiddenB: { status: 'failed', error: deniedB },
    });
    expect(result.current.outcomes.hiddenB).toEqual({ status: 'failed', error: deniedB });
    expect((result.current.outcomes.hiddenB as { error: Error }).error).toBe(deniedB);
    expect(result.current.data).toEqual({ w1: { id: 'w1', title: 'One' } });
    expect(result.current.isError).toBe(true);
    expect(result.current.error).toBe(deniedA);
  });

  it('keeps an id loading until its own read answers', async () => {
    setAutoResolve(false);
    docs.set('w1', { title: 'One' });
    const { Wrapper } = makeWrapper();
    const { result } = renderHook(
      () => useBatchFirestoreDocs({ ...baseOpts, transport: 'get', ids: ['w1', 'ghost'] }),
      { wrapper: Wrapper },
    );

    await waitFor(() => expect(pendingGets).toHaveLength(2));
    expect(result.current.outcomes).toEqual({ w1: { status: 'loading' }, ghost: { status: 'loading' } });

    act(() => pendingGets[0]());
    await waitFor(() => expect(result.current.outcomes.w1.status).toBe('present'));
    expect(result.current.outcomes.ghost).toEqual({ status: 'loading' });
  });

  it('reports a document read before a failed refetch as failed, never present', async () => {
    docs.set('w1', { title: 'One' });
    const { Wrapper } = makeWrapper();
    const { result } = renderHook(
      () => useBatchFirestoreDocs({ ...baseOpts, transport: 'get', ids: ['w1'] }),
      { wrapper: Wrapper },
    );
    await waitFor(() => expect(result.current.outcomes.w1.status).toBe('present'));

    const denied = new Error('permission-denied');
    denials.set('w1', denied);
    await act(async () => {
      await result.current.refetch();
    });

    await waitFor(() => expect(result.current.outcomes.w1).toEqual({ status: 'failed', error: denied }));
    expect(result.current.data).toEqual({});
  });

  it('marks every id of a failed batch query failed, with that query error', async () => {
    const unavailable = new Error('unavailable');
    batchFailure.error = unavailable;
    const { Wrapper } = makeWrapper();
    const { result } = renderHook(() => useBatchFirestoreDocs({ ...baseOpts, ids: ['w1', 'w2'] }), {
      wrapper: Wrapper,
    });

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.outcomes).toEqual({
      w1: { status: 'failed', error: unavailable },
      w2: { status: 'failed', error: unavailable },
    });
  });

  it('has one entry per requested id, empty ids and duplicates dropped', async () => {
    docs.set('w1', { title: 'One' });
    const { Wrapper } = makeWrapper();
    const { result } = renderHook(() => useBatchFirestoreDocs({ ...baseOpts, ids: ['w1', 'w1', ''] }), {
      wrapper: Wrapper,
    });

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(Object.keys(result.current.outcomes)).toEqual(['w1']);
  });

  it('keeps the outcomes map and each unchanged entry identical across renders', async () => {
    docs.set('w1', { title: 'One' });
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
  it('records a listener error on its own id while the other ids keep their answers', () => {
    const { Wrapper } = makeWrapper();
    const { result } = renderHook(
      () => useBatchFirestoreDocs({ ...baseOpts, subscribe: true, ids: ['hidden', 'w1', 'ghost'] }),
      { wrapper: Wrapper },
    );

    const denied = new Error('permission-denied');
    emitError('hidden', denied);
    emit('w1', { title: 'One' });
    emit('ghost', null);

    expect(result.current.outcomes).toEqual({
      hidden: { status: 'failed', error: denied },
      w1: { status: 'present', data: { id: 'w1', title: 'One' } },
      ghost: { status: 'absent' },
    });
    expect(result.current.isError).toBe(true);
    expect(result.current.error).toBe(denied);
  });

  it('keeps two listener errors with their own ids', () => {
    const { Wrapper } = makeWrapper();
    const { result } = renderHook(
      () => useBatchFirestoreDocs({ ...baseOpts, subscribe: true, ids: ['a', 'b'] }),
      { wrapper: Wrapper },
    );

    const errorA = new Error('permission-denied: a');
    const errorB = new Error('unavailable: b');
    emitError('a', errorA);
    emitError('b', errorB);

    expect((result.current.outcomes.a as { error: Error }).error).toBe(errorA);
    expect((result.current.outcomes.b as { error: Error }).error).toBe(errorB);
  });

  it('gives a consumer that joins an already-failed listener the failure, not an absence', () => {
    const { Wrapper } = makeWrapper();
    renderHook(() => useBatchFirestoreDocs({ ...baseOpts, subscribe: true, ids: ['hidden'] }), {
      wrapper: Wrapper,
    });
    const denied = new Error('permission-denied');
    emitError('hidden', denied);

    const late = renderHook(() => useBatchFirestoreDocs({ ...baseOpts, subscribe: true, ids: ['hidden'] }), {
      wrapper: Wrapper,
    });

    expect(late.result.current.outcomes.hidden).toEqual({ status: 'failed', error: denied });
    expect(late.result.current.isError).toBe(true);
  });

  it("clears an id's failure when a later snapshot lands", () => {
    const { Wrapper } = makeWrapper();
    const { result } = renderHook(() => useBatchFirestoreDocs({ ...baseOpts, subscribe: true, ids: ['w1'] }), {
      wrapper: Wrapper,
    });

    emitError('w1', new Error('permission-denied'));
    emit('w1', { title: 'One' });

    expect(result.current.outcomes.w1).toEqual({ status: 'present', data: { id: 'w1', title: 'One' } });
    expect(result.current.isError).toBe(false);
  });
});

describe('useBatchFirestoreDocs outcomes — a one-shot reader beside a failed listener', () => {
  it('reads failed, not absent, for a key whose shared listener has errored', () => {
    const { Wrapper } = makeWrapper();
    renderHook(() => useBatchFirestoreDocs({ ...baseOpts, subscribe: true, ids: ['w1'] }), { wrapper: Wrapper });
    const denied = new Error('permission-denied');
    emitError('w1', denied);

    const oneShot = renderHook(() => useBatchFirestoreDocs({ ...baseOpts, ids: ['w1'] }), { wrapper: Wrapper });

    expect(oneShot.result.current.outcomes.w1).toEqual({ status: 'failed', error: denied });
    expect(oneShot.result.current.isError).toBe(true);
  });

  it('answers a refetch with the listener error, never with its null placeholder', async () => {
    docs.set('w1', { title: 'One' });
    const { Wrapper } = makeWrapper();
    const oneShot = renderHook(() => useBatchFirestoreDocs({ ...baseOpts, ids: ['w1'] }), { wrapper: Wrapper });
    await waitFor(() => expect(oneShot.result.current.outcomes.w1.status).toBe('present'));

    renderHook(() => useBatchFirestoreDocs({ ...baseOpts, subscribe: true, ids: ['w1'] }), { wrapper: Wrapper });
    const denied = new Error('permission-denied');
    emitError('w1', denied);
    await act(async () => {
      await oneShot.result.current.refetch();
    });

    await waitFor(() => expect(oneShot.result.current.outcomes.w1).toEqual({ status: 'failed', error: denied }));
  });

  it('reads the document for itself once the failed listener has no subscriber left', async () => {
    docs.set('w1', { title: 'One' });
    const { Wrapper } = makeWrapper();
    const live = renderHook(() => useBatchFirestoreDocs({ ...baseOpts, subscribe: true, ids: ['w1'] }), {
      wrapper: Wrapper,
    });
    emitError('w1', new Error('permission-denied'));
    const oneShot = renderHook(() => useBatchFirestoreDocs({ ...baseOpts, ids: ['w1'] }), { wrapper: Wrapper });
    expect(oneShot.result.current.outcomes.w1.status).toBe('failed');

    live.unmount();

    await waitFor(() =>
      expect(oneShot.result.current.outcomes.w1).toEqual({ status: 'present', data: { id: 'w1', title: 'One' } }),
    );
  });
});
