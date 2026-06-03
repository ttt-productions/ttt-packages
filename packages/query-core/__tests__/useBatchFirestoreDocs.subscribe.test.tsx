import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';

// Controllable firebase/firestore mock: capture per-id snapshot callbacks so tests can
// emit snapshots, and provide inert stubs for the one-shot path's imports.
const { caps, onSnapshotMock } = vi.hoisted(() => {
  const caps = new Map<string, { next: (snap: unknown) => void; error?: (e: Error) => void; unsub: () => void }>();
  const onSnapshotMock = vi.fn((ref: { __id: string }, next: (s: unknown) => void, error: (e: Error) => void) => {
    const unsub = vi.fn();
    caps.set(ref.__id, { next, error, unsub });
    return unsub;
  });
  return { caps, onSnapshotMock };
});

vi.mock('firebase/firestore', () => ({
  doc: (_db: unknown, _path: unknown, id: string) => ({ __id: id }),
  onSnapshot: onSnapshotMock,
  collection: () => ({}),
  query: () => ({}),
  where: () => ({}),
  documentId: () => '__name__',
  getDocs: async () => ({ forEach: () => {} }),
}));

import { useBatchFirestoreDocs } from '../src/react/firestore/useBatchFirestoreDocs.js';
import { __activeListenerCount } from '../src/react/firestore/doc-subscription-registry.js';

function emit(id: string, data: Record<string, unknown> | null) {
  act(() => {
    caps.get(id)!.next({ exists: () => data != null, id, data: () => data });
  });
}

beforeEach(() => {
  caps.clear();
  onSnapshotMock.mockClear();
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
});
