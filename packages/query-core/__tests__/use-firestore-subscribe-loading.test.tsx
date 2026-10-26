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

import { firestoreError } from '@ttt-productions/firebase-helpers/firestore-client/testing';
import { useFirestoreDoc } from '../src/react/firestore/use-firestore-doc.js';
import { useFirestoreCollection } from '../src/react/firestore/use-firestore-collection.js';
import { FirestoreProvider } from '../src/react/firestore/context.js';
import { failNext, holdNext, listensTo } from './helpers/listener-controls.js';

beforeEach(() => {
  store.reset();
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
      React.createElement(FirestoreProvider, { db: store.db, children }),
    );
  Wrapper.displayName = 'TestWrapper';
  return { queryClient, Wrapper };
}

describe('a subscribed read before its first snapshot', () => {
  it('useFirestoreDoc is loading and fetching, with no data, until the snapshot answers', async () => {
    const release = holdNext(store, listensTo('users/u1'));
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

    act(release);
    await waitFor(() => expect(result.current).toMatchObject({ isLoading: false, data: null }));
  });

  it('useFirestoreCollection is loading until its first snapshot', async () => {
    store.seed('items/i1', { name: 'x' });
    const release = holdNext(store, listensTo('items'));
    const { Wrapper } = makeWrapper();
    const { result } = renderHook(
      () =>
        useFirestoreCollection({ collectionPath: 'items', queryKey: ['items'], subscribe: true }),
      { wrapper: Wrapper },
    );
    expect(result.current).toMatchObject({ isLoading: true, isFetching: true, data: undefined });
    act(release);
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.data).toHaveLength(1);
  });

  it('a listener that fails before answering is a failure, not loading', async () => {
    failNext(store, listensTo('users/u1'), firestoreError('internal', 'internal'));
    const { Wrapper } = makeWrapper();
    const { result } = renderHook(
      () => useFirestoreDoc({ docPath: 'users/u1', queryKey: ['u1'], subscribe: true }),
      {
        wrapper: Wrapper,
      },
    );
    await waitFor(() => expect(result.current).toMatchObject({ isLoading: false, isError: true }));
  });

  it('a disabled subscribed read is idle, not loading', () => {
    const { Wrapper } = makeWrapper();
    const { result } = renderHook(
      () =>
        useFirestoreDoc({ docPath: 'users/u1', queryKey: ['u1'], subscribe: true, enabled: false }),
      { wrapper: Wrapper },
    );
    expect(result.current.isLoading).toBe(false);
    expect(store.queries()).toEqual([]);
  });
});
