import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';

// Controllable firebase/firestore mock: capture the snapshot/error callbacks so
// tests can emit listener errors and recovery snapshots.
const { docCaps, colCaps, onSnapshotMock } = vi.hoisted(() => {
  const docCaps: Array<{ next: (snap: unknown) => void; error: (e: Error) => void }> = [];
  const colCaps: Array<{ next: (snap: unknown) => void; error: (e: Error) => void }> = [];
  // 4-arg form: onSnapshot(ref, options, onNext, onError) — the hooks pass
  // { includeMetadataChanges: true } as the 2nd argument.
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

describe('useFirestoreDoc — subscribe:true listener errors', () => {
  it('surfaces a listener error as isError/error/status', () => {
    const { Wrapper } = makeWrapper();
    const { result } = renderHook(
      () => useFirestoreDoc({ docPath: 'users/u1', queryKey: ['user', 'u1'], subscribe: true }),
      { wrapper: Wrapper },
    );

    const boom = new Error('permission-denied');
    act(() => docCaps[0].error(boom));

    expect(result.current.isError).toBe(true);
    expect(result.current.error).toBe(boom);
    expect(result.current.status).toBe('error');
    expect(result.current.data).toBeUndefined();
  });

  it('clears the error when a later snapshot succeeds', () => {
    const { Wrapper } = makeWrapper();
    const { result } = renderHook(
      () => useFirestoreDoc({ docPath: 'users/u1', queryKey: ['user', 'u1'], subscribe: true }),
      { wrapper: Wrapper },
    );

    act(() => docCaps[0].error(new Error('transient')));
    expect(result.current.isError).toBe(true);

    act(() =>
      docCaps[0].next({ exists: () => true, id: 'u1', data: () => ({ displayName: 'Alice' }) }),
    );

    expect(result.current.isError).toBe(false);
    expect(result.current.error).toBeNull();
    expect(result.current.data).toMatchObject({ id: 'u1', displayName: 'Alice' });
  });

  it('still resolves a missing doc as null (no error)', async () => {
    const { Wrapper } = makeWrapper();
    const { result } = renderHook(
      () => useFirestoreDoc({ docPath: 'users/u1', queryKey: ['user', 'u1'], subscribe: true }),
      { wrapper: Wrapper },
    );

    act(() => docCaps[0].next({ exists: () => false }));

    // Cache-driven updates notify observers asynchronously (no local state
    // change forces a re-render here), so wait for the observer flush.
    await waitFor(() => expect(result.current.data).toBeNull());
    expect(result.current.isError).toBe(false);
  });
});

describe('useFirestoreCollection — subscribe:true listener errors', () => {
  it('surfaces a listener error as isError/error/status', () => {
    const { Wrapper } = makeWrapper();
    const { result } = renderHook(
      () =>
        useFirestoreCollection({ collectionPath: 'items', queryKey: ['items'], subscribe: true }),
      { wrapper: Wrapper },
    );

    const boom = new Error('permission-denied');
    act(() => colCaps[0].error(boom));

    expect(result.current.isError).toBe(true);
    expect(result.current.error).toBe(boom);
    expect(result.current.status).toBe('error');
    expect(result.current.data).toBeUndefined();
  });

  it('clears the error when a later snapshot succeeds', () => {
    const { Wrapper } = makeWrapper();
    const { result } = renderHook(
      () =>
        useFirestoreCollection({ collectionPath: 'items', queryKey: ['items'], subscribe: true }),
      { wrapper: Wrapper },
    );

    act(() => colCaps[0].error(new Error('transient')));
    expect(result.current.isError).toBe(true);

    act(() =>
      colCaps[0].next({ docs: [{ id: 'i1', data: () => ({ name: 'thing' }) }] }),
    );

    expect(result.current.isError).toBe(false);
    expect(result.current.error).toBeNull();
    expect(result.current.data).toEqual([{ id: 'i1', name: 'thing' }]);
  });
});
