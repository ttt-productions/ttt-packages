import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';

const { caps, onSnapshotMock } = vi.hoisted(() => {
  const caps: Array<{ next: (snap: unknown) => void }> = [];
  const onSnapshotMock = vi.fn(
    (_target: unknown, _options: unknown, next: (s: unknown) => void) => {
      caps.push({ next });
      return vi.fn();
    },
  );
  return { caps, onSnapshotMock };
});

vi.mock('firebase/firestore', () => ({
  doc: () => ({ __kind: 'doc' }),
  collection: () => ({ __kind: 'col' }),
  query: (ref: unknown) => ref,
  where: (field: string, op: string, value: unknown) => ({ field, op, value }),
  onSnapshot: onSnapshotMock,
  getDoc: vi.fn(async () => ({ exists: () => false })),
  getDocs: vi.fn(async () => ({ docs: [] })),
}));

import { where } from 'firebase/firestore';
import { useFirestoreDoc } from '../src/react/firestore/use-firestore-doc.js';
import { useFirestoreCollection } from '../src/react/firestore/use-firestore-collection.js';
import { FirestoreProvider } from '../src/react/firestore/context.js';

beforeEach(() => {
  caps.length = 0;
  onSnapshotMock.mockClear();
});

function makeWrapper() {
  const db = {} as never;
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: Infinity } },
  });
  const Wrapper = ({ children }: { children: React.ReactNode }) =>
    React.createElement(
      QueryClientProvider,
      { client: queryClient },
      React.createElement(FirestoreProvider, { db, children }),
    );
  Wrapper.displayName = 'TestWrapper';
  return Wrapper;
}

const collectionSnapshot = (value: number) => ({
  docs: [{ id: 'a', data: () => ({ value }) }],
  metadata: { fromCache: false },
});

describe('useFirestoreCollection — inputs rebuilt each render', () => {
  it('keeps one subscription across renders that pass equal keys, constraints, and a new select', () => {
    const { rerender, result } = renderHook(
      ({ tag }: { tag: string }) =>
        useFirestoreCollection<{ value: number; tag?: string }>({
          collectionPath: 'items',
          queryKey: ['items', 'open'],
          constraints: [where('status', '==', 'open')],
          subscribe: true,
          select: (row) => ({ id: row.id, value: Number(row.value), tag }),
        }),
      { wrapper: makeWrapper(), initialProps: { tag: 'first' } },
    );

    rerender({ tag: 'second' });
    rerender({ tag: 'third' });
    expect(onSnapshotMock).toHaveBeenCalledTimes(1);

    act(() => caps[0].next(collectionSnapshot(1)));
    expect(result.current.data).toEqual([{ id: 'a', value: 1, tag: 'third' }]);
  });

  it('re-subscribes when the constraints change', () => {
    const { rerender } = renderHook(
      ({ status }: { status: string }) =>
        useFirestoreCollection({
          collectionPath: 'items',
          queryKey: ['items', status],
          constraints: [where('status', '==', status)],
          subscribe: true,
        }),
      { wrapper: makeWrapper(), initialProps: { status: 'open' } },
    );

    rerender({ status: 'closed' });
    expect(onSnapshotMock).toHaveBeenCalledTimes(2);
  });
});

describe('useFirestoreDoc — inputs rebuilt each render', () => {
  it('keeps one subscription across renders that pass an equal key and a new select', () => {
    const { rerender, result } = renderHook(
      ({ tag }: { tag: string }) =>
        useFirestoreDoc<{ value: number; tag?: string }>({
          docPath: 'items/a',
          queryKey: ['item', 'a'],
          subscribe: true,
          select: (row) => ({ id: row.id, value: Number(row.value), tag }),
        }),
      { wrapper: makeWrapper(), initialProps: { tag: 'first' } },
    );

    rerender({ tag: 'second' });
    expect(onSnapshotMock).toHaveBeenCalledTimes(1);

    act(() =>
      caps[0].next({
        id: 'a',
        exists: () => true,
        data: () => ({ value: 2 }),
        metadata: { fromCache: false },
      }),
    );
    expect(result.current.data).toEqual({ id: 'a', value: 2, tag: 'second' });
  });

  it('re-subscribes when the key changes', () => {
    const { rerender } = renderHook(
      ({ id }: { id: string }) =>
        useFirestoreDoc({ docPath: `items/${id}`, queryKey: ['item', id], subscribe: true }),
      { wrapper: makeWrapper(), initialProps: { id: 'a' } },
    );

    rerender({ id: 'b' });
    expect(onSnapshotMock).toHaveBeenCalledTimes(2);
  });
});
