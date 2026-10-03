import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';

// Controllable firebase/firestore mock (4-arg onSnapshot: ref, options, next, error)
// so tests can emit server/cache snapshots + listener errors and drive sourceState.
const { docCaps, colCaps, onSnapshotMock } = vi.hoisted(() => {
  const docCaps: Array<{ next: (snap: unknown) => void; error: (e: Error) => void }> = [];
  const colCaps: Array<{ next: (snap: unknown) => void; error: (e: Error) => void }> = [];
  const onSnapshotMock = vi.fn(
    (target: { __kind: 'doc' | 'col' }, _options: unknown, next: (s: unknown) => void, error: (e: Error) => void) => {
      (target.__kind === 'doc' ? docCaps : colCaps).push({ next, error });
      return vi.fn();
    },
  );
  return { docCaps, colCaps, onSnapshotMock };
});

vi.mock('firebase/firestore', () => ({
  doc: () => ({ __kind: 'doc' }),
  collection: () => ({ __kind: 'col' }),
  query: (ref: unknown) => ref,
  onSnapshot: onSnapshotMock,
  getDoc: vi.fn(async () => ({ exists: () => false })),
  getDocs: vi.fn(async () => ({ docs: [] })),
}));

import { useFirestoreDoc } from '../src/react/firestore/use-firestore-doc.js';
import { useFirestoreCollection } from '../src/react/firestore/use-firestore-collection.js';
import { FirestoreProvider } from '../src/react/firestore/context.js';

beforeEach(() => {
  docCaps.length = 0;
  colCaps.length = 0;
  onSnapshotMock.mockClear();
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

function makeWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: Infinity, staleTime: 0 } },
  });
  const Wrapper = ({ children }: { children: React.ReactNode }) =>
    React.createElement(
      QueryClientProvider,
      { client: queryClient },
      React.createElement(FirestoreProvider, { db: {} as never, children }),
    );
  Wrapper.displayName = 'TestWrapper';
  return { queryClient, Wrapper };
}

const colSnap = (fromCache: boolean) => ({ docs: [{ id: 'i1', data: () => ({ name: 'x' }) }], metadata: { fromCache } });
const docSnap = (fromCache: boolean) => ({ exists: () => true, id: 'u1', data: () => ({ n: 1 }), metadata: { fromCache } });

describe('useFirestoreCollection — sourceState (metadata-derived)', () => {
  it('subscribes with includeMetadataChanges and starts connecting', () => {
    const { Wrapper } = makeWrapper();
    const { result } = renderHook(
      () => useFirestoreCollection({ collectionPath: 'items', queryKey: ['items'], subscribe: true }),
      { wrapper: Wrapper },
    );
    expect(result.current.sourceState).toBe('connecting');
    // 2nd arg is the options object.
    expect(onSnapshotMock.mock.calls[0][1]).toEqual({ includeMetadataChanges: true });
  });

  it('cache-first snapshot stays connecting until a server-confirmed snapshot makes it live', () => {
    const { Wrapper } = makeWrapper();
    const { result } = renderHook(
      () => useFirestoreCollection({ collectionPath: 'items', queryKey: ['items'], subscribe: true }),
      { wrapper: Wrapper },
    );
    act(() => colCaps[0].next(colSnap(true)));
    expect(result.current.sourceState).toBe('connecting');
    act(() => colCaps[0].next(colSnap(false)));
    expect(result.current.sourceState).toBe('live');
  });

  it('goes offline after being live, then back to live on reconnect', () => {
    const { Wrapper } = makeWrapper();
    const { result } = renderHook(
      () => useFirestoreCollection({ collectionPath: 'items', queryKey: ['items'], subscribe: true }),
      { wrapper: Wrapper },
    );
    act(() => colCaps[0].next(colSnap(false)));
    expect(result.current.sourceState).toBe('live');
    act(() => colCaps[0].next(colSnap(true)));
    expect(result.current.sourceState).toBe('offline');
    act(() => colCaps[0].next(colSnap(false)));
    expect(result.current.sourceState).toBe('live');
  });

  it('goes error on a listener error (permission loss)', () => {
    const { Wrapper } = makeWrapper();
    const { result } = renderHook(
      () => useFirestoreCollection({ collectionPath: 'items', queryKey: ['items'], subscribe: true }),
      { wrapper: Wrapper },
    );
    act(() => colCaps[0].next(colSnap(false)));
    act(() => colCaps[0].error(new Error('permission-denied')));
    expect(result.current.sourceState).toBe('error');
  });

  it('reads connecting for a new subscription identity (uid / admin-claim change)', () => {
    const { Wrapper } = makeWrapper();
    const { result, rerender } = renderHook(
      ({ key }: { key: string }) =>
        useFirestoreCollection({ collectionPath: 'items', queryKey: ['items', key], subscribe: true }),
      { wrapper: Wrapper, initialProps: { key: 'u1' } },
    );
    act(() => colCaps[0].next(colSnap(false)));
    expect(result.current.sourceState).toBe('live');

    rerender({ key: 'u2' });
    expect(result.current.sourceState).toBe('connecting');
    // a fresh subscription was opened for the new identity
    act(() => colCaps[colCaps.length - 1].next(colSnap(false)));
    expect(result.current.sourceState).toBe('live');
  });
});

describe('useFirestoreDoc — sourceState (metadata-derived)', () => {
  it('connecting → live → offline → live', () => {
    const { Wrapper } = makeWrapper();
    const { result } = renderHook(
      () => useFirestoreDoc({ docPath: 'users/u1', queryKey: ['user', 'u1'], subscribe: true }),
      { wrapper: Wrapper },
    );
    expect(result.current.sourceState).toBe('connecting');
    act(() => docCaps[0].next(docSnap(false)));
    expect(result.current.sourceState).toBe('live');
    act(() => docCaps[0].next(docSnap(true)));
    expect(result.current.sourceState).toBe('offline');
    act(() => docCaps[0].next(docSnap(false)));
    expect(result.current.sourceState).toBe('live');
  });

  it('error callback sets error', () => {
    const { Wrapper } = makeWrapper();
    const { result } = renderHook(
      () => useFirestoreDoc({ docPath: 'users/u1', queryKey: ['user', 'u1'], subscribe: true }),
      { wrapper: Wrapper },
    );
    act(() => docCaps[0].error(new Error('permission-denied')));
    expect(result.current.sourceState).toBe('error');
  });
});

describe('source state and error belong to the subscription identity that produced them', () => {
  it('a collection never renders the previous identity as live, not even for one render', () => {
    const { Wrapper } = makeWrapper();
    const seen: Array<{ key: string; state: string }> = [];
    const { rerender } = renderHook(
      ({ key }: { key: string }) => {
        const r = useFirestoreCollection({ collectionPath: 'items', queryKey: ['items', key], subscribe: true });
        seen.push({ key, state: r.sourceState });
        return r;
      },
      { wrapper: Wrapper, initialProps: { key: 'u1' } },
    );
    act(() => colCaps[0].next(colSnap(false)));

    rerender({ key: 'u2' });
    const u2States = seen.filter((s) => s.key === 'u2').map((s) => s.state);
    expect(u2States.length).toBeGreaterThan(0);
    expect(u2States.every((s) => s === 'connecting')).toBe(true);
  });

  it('a doc never renders the previous identity’s error under the new path', () => {
    const { Wrapper } = makeWrapper();
    const seen: Array<{ path: string; error: unknown; state: string }> = [];
    const { rerender } = renderHook(
      ({ path }: { path: string }) => {
        const r = useFirestoreDoc({ docPath: path, queryKey: ['doc', path], subscribe: true });
        seen.push({ path, error: r.error, state: r.sourceState });
        return r;
      },
      { wrapper: Wrapper, initialProps: { path: 'users/u1' } },
    );
    act(() => docCaps[0].error(new Error('boom')));

    rerender({ path: 'users/u2' });
    const u2 = seen.filter((s) => s.path === 'users/u2');
    expect(u2.length).toBeGreaterThan(0);
    expect(u2.every((s) => s.error === null && s.state === 'connecting')).toBe(true);
  });

  it('a late callback from the retired listener does not touch the new identity', () => {
    const { Wrapper } = makeWrapper();
    const { result, rerender } = renderHook(
      ({ key }: { key: string }) =>
        useFirestoreCollection({ collectionPath: 'items', queryKey: ['items', key], subscribe: true }),
      { wrapper: Wrapper, initialProps: { key: 'u1' } },
    );
    const retired = colCaps[0];
    rerender({ key: 'u2' });
    act(() => retired.error(new Error('late')));
    expect(result.current.sourceState).toBe('connecting');
    expect(result.current.error).toBeNull();
  });
});
