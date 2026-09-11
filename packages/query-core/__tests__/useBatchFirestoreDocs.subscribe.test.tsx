import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';

// Controllable firebase/firestore mock: capture per-id snapshot callbacks so tests can
// emit snapshots, and provide inert stubs for the one-shot path's imports.
const { caps, onSnapshotMock, oneShotDocs, batchCalls, getDocsMock, getDocMock, setAutoResolve } =
  vi.hoisted(() => {
    const caps = new Map<
      string,
      { next: (snap: unknown) => void; error?: (e: Error) => void; unsub: () => void }
    >();
    const onSnapshotMock = vi.fn(
      (ref: { __id: string }, next: (s: unknown) => void, error: (e: Error) => void) => {
        const unsub = vi.fn();
        caps.set(ref.__id, { next, error, unsub });
        return unsub;
      },
    );

    // One-shot leg, so the mode-switch tests can drive a real read.
    const oneShotDocs = new Map<string, Record<string, unknown>>();
    const batchCalls: { ids: string[]; release: () => void }[] = [];
    let autoResolve = true;

    const snapshotFor = (ids: string[]) => ({
      forEach: (cb: (d: { id: string; data: () => Record<string, unknown> }) => void) => {
        for (const id of ids) {
          const data = oneShotDocs.get(id);
          if (data !== undefined) cb({ id, data: () => data });
        }
      },
    });

    const getDocsMock = vi.fn((q: { __ids: string[] }) => {
      const call = { ids: q.__ids, release: () => {} };
      batchCalls.push(call);
      if (autoResolve) return Promise.resolve(snapshotFor(q.__ids));
      return new Promise((resolve) => {
        call.release = () => resolve(snapshotFor(q.__ids));
      });
    });

    const getDocMock = vi.fn(async () => ({ exists: () => false }));

    const setAutoResolve = (value: boolean) => {
      autoResolve = value;
    };

    return {
      caps,
      onSnapshotMock,
      oneShotDocs,
      batchCalls,
      getDocsMock,
      getDocMock,
      setAutoResolve,
    };
  });

vi.mock('firebase/firestore', () => ({
  doc: (_db: unknown, _path: unknown, id: string) => ({ __id: id }),
  onSnapshot: onSnapshotMock,
  collection: (db: unknown, path: string) => ({ __db: db, __path: path }),
  query: (source: { __db: unknown; __path: string }, constraint: { __ids: string[] }) => ({
    __db: source.__db,
    __path: source.__path,
    __ids: constraint.__ids,
  }),
  where: (_field: unknown, _op: unknown, ids: string[]) => ({ __ids: ids }),
  documentId: () => '__name__',
  getDocs: getDocsMock,
  getDoc: getDocMock,
}));

import { useBatchFirestoreDocs } from '../src/react/firestore/useBatchFirestoreDocs.js';
import { __activeListenerCount } from '../src/react/firestore/doc-subscription-registry.js';

function emit(id: string, data: Record<string, unknown> | null) {
  act(() => {
    caps.get(id)!.next({ exists: () => data != null, id, data: () => data });
  });
}

function emitError(id: string, error: Error) {
  act(() => {
    caps.get(id)!.error!(error);
  });
}

beforeEach(() => {
  caps.clear();
  onSnapshotMock.mockClear();
  oneShotDocs.clear();
  batchCalls.length = 0;
  getDocsMock.mockClear();
  getDocMock.mockClear();
  setAutoResolve(true);
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
  db: {} as never,
  collectionPath: 'publicUsers',
  queryKeyPrefix: 'publicUser',
  subscribe: true,
};

describe('useBatchFirestoreDocs — subscribe mode', () => {
  it('starts loading, then populates data from a snapshot', () => {
    const { Wrapper } = makeWrapper();
    const { result } = renderHook(() => useBatchFirestoreDocs({ ...baseOpts, ids: ['u1'] }), { wrapper: Wrapper });

    expect(result.current.isLoading).toBe(true);
    expect(result.current.data).toEqual({});

    emit('u1', { displayName: 'Alice' });

    expect(result.current.isLoading).toBe(false);
    expect(result.current.data).toEqual({ u1: { id: 'u1', displayName: 'Alice' } });
  });

  it('caches a missing doc as resolved (negative caching) and excludes it from data', () => {
    const { Wrapper, queryClient } = makeWrapper();
    const { result } = renderHook(() => useBatchFirestoreDocs({ ...baseOpts, ids: ['ghost'] }), { wrapper: Wrapper });

    emit('ghost', null);

    expect(result.current.isLoading).toBe(false);
    expect(result.current.data).toEqual({});
    // Resolved-missing is cached as null (not undefined) so it won't stay blank.
    expect(queryClient.getQueryData(['publicUser', 'ghost'])).toBeNull();
  });

  it('pushes live updates when the doc changes', () => {
    const { Wrapper } = makeWrapper();
    const { result } = renderHook(() => useBatchFirestoreDocs({ ...baseOpts, ids: ['u1'] }), { wrapper: Wrapper });

    emit('u1', { displayName: 'Alice' });
    expect(result.current.data.u1).toMatchObject({ displayName: 'Alice' });

    emit('u1', { displayName: 'Alice Smith' });
    expect(result.current.data.u1).toMatchObject({ displayName: 'Alice Smith' });
  });

  it('shares ONE listener per id across hook instances (reference-counted)', () => {
    const { Wrapper, queryClient } = makeWrapper();
    const a = renderHook(() => useBatchFirestoreDocs({ ...baseOpts, ids: ['u1'] }), { wrapper: Wrapper });
    const b = renderHook(() => useBatchFirestoreDocs({ ...baseOpts, ids: ['u1'] }), { wrapper: Wrapper });

    // Two consumers of the same id → exactly one underlying Firestore listener.
    expect(__activeListenerCount(queryClient)).toBe(1);
    expect(onSnapshotMock).toHaveBeenCalledTimes(1);

    emit('u1', { displayName: 'Alice' });
    expect(a.result.current.data.u1).toMatchObject({ displayName: 'Alice' });
    expect(b.result.current.data.u1).toMatchObject({ displayName: 'Alice' });

    // Unmounting one keeps the listener alive for the other.
    a.unmount();
    expect(__activeListenerCount(queryClient)).toBe(1);
    expect(caps.get('u1')!.unsub).not.toHaveBeenCalled();

    // Unmounting the last detaches the shared listener.
    b.unmount();
    expect(__activeListenerCount(queryClient)).toBe(0);
    expect(caps.get('u1')!.unsub).toHaveBeenCalledTimes(1);
  });

  it('does not open listeners in the default (one-shot) mode', () => {
    const { Wrapper } = makeWrapper();
    renderHook(() => useBatchFirestoreDocs({ ...baseOpts, subscribe: false, ids: ['u1'] }), { wrapper: Wrapper });
    expect(onSnapshotMock).not.toHaveBeenCalled();
  });

  it('a listener error negative-caches the id: resolved-absent, never forever-loading', () => {
    const { Wrapper, queryClient } = makeWrapper();
    const { result } = renderHook(() => useBatchFirestoreDocs({ ...baseOpts, ids: ['hidden'] }), { wrapper: Wrapper });

    expect(result.current.isLoading).toBe(true);

    // A rules-denied doc (hidden, or non-existent when the rule references
    // resource.data) errors instead of landing a snapshot.
    emitError('hidden', new Error('permission-denied'));

    expect(result.current.isLoading).toBe(false);
    expect(result.current.data).toEqual({});
    expect(result.current.isError).toBe(true);
    expect(result.current.error?.message).toBe('permission-denied');
    expect(queryClient.getQueryData(['publicUser', 'hidden'])).toBeNull();
  });

  it('an errored id resolves while other ids in the batch still load and land', () => {
    const { Wrapper } = makeWrapper();
    const { result } = renderHook(() => useBatchFirestoreDocs({ ...baseOpts, ids: ['hidden', 'u1'] }), { wrapper: Wrapper });

    emitError('hidden', new Error('permission-denied'));
    // u1 has no snapshot yet — the batch is still loading on its account.
    expect(result.current.isLoading).toBe(true);

    emit('u1', { displayName: 'Alice' });
    expect(result.current.isLoading).toBe(false);
    expect(result.current.data).toEqual({ u1: { id: 'u1', displayName: 'Alice' } });
    expect(result.current.isError).toBe(true);
  });

  it('a later snapshot replaces the error negative-cache (e.g. doc un-hidden)', () => {
    const { Wrapper, queryClient } = makeWrapper();
    const { result } = renderHook(() => useBatchFirestoreDocs({ ...baseOpts, ids: ['u1'] }), { wrapper: Wrapper });

    emitError('u1', new Error('permission-denied'));
    expect(queryClient.getQueryData(['publicUser', 'u1'])).toBeNull();

    emit('u1', { displayName: 'Alice' });
    expect(result.current.data.u1).toMatchObject({ displayName: 'Alice' });
  });

  it('refetch() is a no-op — it never issues reads against the disabled queries', async () => {
    const { Wrapper } = makeWrapper();
    const { result } = renderHook(() => useBatchFirestoreDocs({ ...baseOpts, ids: ['u1', 'u2'] }), {
      wrapper: Wrapper,
    });

    emit('u1', { displayName: 'Alice' });
    emit('u2', null);

    await act(async () => {
      await result.current.refetch();
    });

    expect(getDocsMock).not.toHaveBeenCalled();
    expect(getDocMock).not.toHaveBeenCalled();
    expect(result.current.data).toEqual({ u1: { id: 'u1', displayName: 'Alice' } });
  });

  it('switches one-shot → subscribe → one-shot without losing the entry', async () => {
    oneShotDocs.set('u1', { displayName: 'FromRead' });

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
    expect(onSnapshotMock).not.toHaveBeenCalled();
    expect(getDocsMock).toHaveBeenCalledTimes(1);

    act(() => {
      rerender({ subscribe: true });
    });
    expect(onSnapshotMock).toHaveBeenCalledTimes(1);

    emit('u1', { displayName: 'FromListener' });
    expect(result.current.data.u1).toMatchObject({ displayName: 'FromListener' });

    act(() => {
      rerender({ subscribe: false });
    });
    expect(caps.get('u1')!.unsub).toHaveBeenCalledTimes(1);
    // The listener's value is fresh, so returning to one-shot reads nothing new.
    await waitFor(() =>
      expect(result.current.data.u1).toMatchObject({ displayName: 'FromListener' }),
    );
    expect(getDocsMock).toHaveBeenCalledTimes(1);
  });

  it('a one-shot read still in flight cannot clobber the listener value', async () => {
    setAutoResolve(false);
    oneShotDocs.set('u1', { displayName: 'InFlight' });

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

    await waitFor(() => expect(batchCalls).toHaveLength(1));

    act(() => {
      rerender({ subscribe: true });
    });
    emit('u1', { displayName: 'FromListener' });
    expect(result.current.data.u1).toMatchObject({ displayName: 'FromListener' });

    // The abandoned read lands late with the value it captured before the switch.
    oneShotDocs.set('u1', { displayName: 'Stale' });
    await act(async () => {
      batchCalls[0].release();
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(queryClient.getQueryData(['publicUser', 'u1'])).toMatchObject({
      displayName: 'FromListener',
    });
    expect(result.current.data.u1).toMatchObject({ displayName: 'FromListener' });
  });

  it("a sibling consumer's in-flight one-shot read resolves without clobbering the listener", async () => {
    setAutoResolve(false);
    oneShotDocs.set('u1', { displayName: 'InFlight' });

    const { Wrapper, queryClient } = makeWrapper();
    // A stays in one-shot mode throughout, so its ENABLED observer keeps the read alive —
    // the guard has to be value-based, not a cancel.
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
    await waitFor(() => expect(batchCalls).toHaveLength(1));

    const subscribed = renderHook(
      () => useBatchFirestoreDocs({ ...baseOpts, ids: ['u1'] }),
      { wrapper: Wrapper },
    );
    emit('u1', { displayName: 'FromListener' });

    oneShotDocs.set('u1', { displayName: 'FromRead' });
    await act(async () => {
      batchCalls[0].release();
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(queryClient.getQueryData(['publicUser', 'u1'])).toMatchObject({
      displayName: 'FromListener',
    });
    // The sibling's read still settled — it was never cancelled — and it sees the listener's
    // value rather than its own stale one.
    await waitFor(() => expect(oneShot.result.current.isLoading).toBe(false));
    expect(oneShot.result.current.data.u1).toMatchObject({ displayName: 'FromListener' });
    expect(subscribed.result.current.data.u1).toMatchObject({ displayName: 'FromListener' });
  });
});
