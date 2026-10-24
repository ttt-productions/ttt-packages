import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';

const { docCaps, colCaps, onSnapshotMock } = vi.hoisted(() => {
  const docCaps: Array<{ next: (snap: unknown) => void; error: (e: Error) => void }> = [];
  const colCaps: Array<{ next: (snap: unknown) => void; error: (e: Error) => void }> = [];
  const onSnapshotMock = vi.fn(
    (
      target: { __kind: 'doc' | 'col' },
      _options: unknown,
      next: (s: unknown) => void,
      error: (e: Error) => void,
    ) => {
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
import { testFirestore } from './helpers/test-firestore.js';

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
      React.createElement(FirestoreProvider, { db: testFirestore(), children }),
    );
  Wrapper.displayName = 'TestWrapper';
  return { queryClient, Wrapper };
}

const colSnap = {
  docs: [{ id: 'i1', data: () => ({ name: 'x' }) }],
  metadata: { fromCache: false },
};
const missingDoc = {
  exists: () => false,
  id: 'u1',
  data: () => undefined,
  metadata: { fromCache: false },
};

describe('a subscribed read before its first snapshot', () => {
  it('useFirestoreDoc is loading and fetching, with no data, until the snapshot answers', () => {
    const { Wrapper } = makeWrapper();
    const { result } = renderHook(
      () => useFirestoreDoc({ docPath: 'users/u1', queryKey: ['u1'], subscribe: true }),
      {
        wrapper: Wrapper,
      },
    );
    expect(result.current).toMatchObject({
      isLoading: true,
      isFetching: true,
      isPending: true,
      data: undefined,
    });

    act(() => docCaps[0].next(missingDoc));
    expect(result.current).toMatchObject({ isLoading: false, data: null });
  });

  it('useFirestoreCollection is loading until its first snapshot', () => {
    const { Wrapper } = makeWrapper();
    const { result } = renderHook(
      () =>
        useFirestoreCollection({ collectionPath: 'items', queryKey: ['items'], subscribe: true }),
      { wrapper: Wrapper },
    );
    expect(result.current).toMatchObject({ isLoading: true, isFetching: true, data: undefined });
    act(() => colCaps[0].next(colSnap));
    expect(result.current.isLoading).toBe(false);
    expect(result.current.data).toHaveLength(1);
  });

  it('a listener that fails before answering is a failure, not loading', () => {
    const { Wrapper } = makeWrapper();
    const { result } = renderHook(
      () => useFirestoreDoc({ docPath: 'users/u1', queryKey: ['u1'], subscribe: true }),
      {
        wrapper: Wrapper,
      },
    );
    act(() => docCaps[0].error(Object.assign(new Error('internal'), { code: 'internal' })));
    expect(result.current).toMatchObject({ isLoading: false, isError: true });
  });

  it('a disabled subscribed read is idle, not loading', () => {
    const { Wrapper } = makeWrapper();
    const { result } = renderHook(
      () =>
        useFirestoreDoc({ docPath: 'users/u1', queryKey: ['u1'], subscribe: true, enabled: false }),
      { wrapper: Wrapper },
    );
    expect(result.current.isLoading).toBe(false);
    expect(onSnapshotMock).not.toHaveBeenCalled();
  });
});
