import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';

const store = await vi.hoisted(async () => {
  const { makeInMemoryClientFirestore } =
    await import('@ttt-productions/firebase-helpers/firestore-client/testing');
  return makeInMemoryClientFirestore();
});

vi.mock('firebase/firestore', async (importOriginal) => {
  const { clientFirestoreFake } = await import('../../../test/client-firestore-fake.js');
  return clientFirestoreFake(importOriginal, store);
});

import { where } from 'firebase/firestore';
import { useFirestoreDoc } from '../src/react/firestore/use-firestore-doc.js';
import { useFirestoreCollection } from '../src/react/firestore/use-firestore-collection.js';
import { FirestoreProvider } from '../src/react/firestore/context.js';
import { anyListener, holdNext, listensTo, opened } from './helpers/listener-controls.js';

beforeEach(() => {
  store.reset();
});

function makeWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: Infinity } },
  });
  const Wrapper = ({ children }: { children: React.ReactNode }) =>
    React.createElement(
      QueryClientProvider,
      { client: queryClient },
      React.createElement(FirestoreProvider, { db: store.db, children }),
    );
  Wrapper.displayName = 'TestWrapper';
  return Wrapper;
}

const listens = () => opened(store, anyListener);

describe('useFirestoreCollection — inputs rebuilt each render', () => {
  it('keeps one subscription across renders that pass equal keys, constraints, and a new select', async () => {
    store.seed('items/a', { status: 'open', value: 1 });
    const release = holdNext(store, listensTo('items'));
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
    expect(opened(store, listensTo('items'))).toBe(1);

    act(release);
    await waitFor(() => expect(result.current.data).toEqual([{ id: 'a', value: 1, tag: 'third' }]));
    expect(listens()).toBe(1);
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
    expect(store.queries().filter((read) => read.listen)).toEqual([
      expect.objectContaining({
        path: 'items',
        filters: [{ field: 'status', op: '==', value: { t: 'str', v: 'open' } }],
      }),
      expect.objectContaining({
        path: 'items',
        filters: [{ field: 'status', op: '==', value: { t: 'str', v: 'closed' } }],
      }),
    ]);
  });
});

describe('useFirestoreDoc — inputs rebuilt each render', () => {
  it('keeps one subscription across renders that pass an equal key and a new select', async () => {
    store.seed('items/a', { value: 2 });
    const release = holdNext(store, listensTo('items/a'));
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
    expect(opened(store, listensTo('items/a'))).toBe(1);

    act(release);
    await waitFor(() => expect(result.current.data).toEqual({ id: 'a', value: 2, tag: 'second' }));
    expect(listens()).toBe(1);
  });

  it('re-subscribes when the key changes', () => {
    const { rerender } = renderHook(
      ({ id }: { id: string }) =>
        useFirestoreDoc({ docPath: `items/${id}`, queryKey: ['item', id], subscribe: true }),
      { wrapper: makeWrapper(), initialProps: { id: 'a' } },
    );

    rerender({ id: 'b' });
    expect(store.queries().filter((read) => read.listen)).toEqual([
      expect.objectContaining({ kind: 'doc', path: 'items/a' }),
      expect.objectContaining({ kind: 'doc', path: 'items/b' }),
    ]);
  });
});
