import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';
import type { FirestoreError } from 'firebase/firestore';
import { firestoreError } from '@ttt-productions/firebase-helpers/firestore-client/testing';

const store = await vi.hoisted(async () => {
  const { makeInMemoryClientFirestore } =
    await import('@ttt-productions/firebase-helpers/firestore-client/testing');
  return makeInMemoryClientFirestore();
});

vi.mock('firebase/firestore', async (importOriginal) => {
  const { clientFirestoreFake } = await import('../../../test/client-firestore-fake.js');
  return clientFirestoreFake(importOriginal, store);
});

import { useFirestoreDoc } from '../src/react/firestore/use-firestore-doc.js';
import { useFirestoreCollection } from '../src/react/firestore/use-firestore-collection.js';
import { FirestoreProvider } from '../src/react/firestore/context.js';
import { RESUBSCRIBE_DELAYS_MS } from '../src/react/firestore/resubscribe.js';
import { listensTo } from './helpers/listener-controls.js';

beforeEach(() => {
  store.reset();
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  vi.useRealTimers();
});

const unavailable = () => firestoreError('unavailable', 'unavailable');
const permissionDenied = () => firestoreError('permission-denied', 'denied');

async function denyUntilSurfaced(path: string, denial: FirestoreError) {
  store.failReads(listensTo(path), denial);
  store.failListeners(listensTo(path), denial);
  for (const delay of RESUBSCRIBE_DELAYS_MS) {
    await act(async () => {
      await vi.advanceTimersByTimeAsync(delay);
    });
  }
}

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

const renderUser = () =>
  renderHook(
    () => useFirestoreDoc({ docPath: 'users/u1', queryKey: ['user', 'u1'], subscribe: true }),
    { wrapper: makeWrapper().Wrapper },
  );

const renderItems = () =>
  renderHook(
    () => useFirestoreCollection({ collectionPath: 'items', queryKey: ['items'], subscribe: true }),
    { wrapper: makeWrapper().Wrapper },
  );

describe('useFirestoreDoc — subscribe:true listener errors', () => {
  it('surfaces a listener error as isError/error/status', async () => {
    const boom = unavailable();
    store.failReads(listensTo('users/u1'), boom);
    const { result } = renderUser();

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error).toBe(boom);
    expect(result.current.status).toBe('error');
    expect(result.current.data).toBeUndefined();
  });

  it('refetch() restarts the failed listener and clears its error', async () => {
    store.failReads(listensTo('users/u1'), unavailable());
    const { result } = renderUser();
    await waitFor(() => expect(result.current.isError).toBe(true));

    store.reset();
    store.seed('users/u1', { displayName: 'Alice' });
    act(() => {
      void result.current.refetch();
    });

    await waitFor(() => expect(result.current.isError).toBe(false));
    expect(result.current.error).toBeNull();
    expect(result.current.data).toMatchObject({ id: 'u1', displayName: 'Alice' });
  });

  it('keeps the last snapshot beside a failure after it answered', async () => {
    store.seed('users/u1', { displayName: 'Alice' });
    const { result } = renderUser();
    await waitFor(() => expect(result.current.data).toMatchObject({ displayName: 'Alice' }));

    act(() => store.failListeners(listensTo('users/u1'), unavailable()));

    expect(result.current.isRefetchError).toBe(true);
    expect(result.current.data).toMatchObject({ id: 'u1', displayName: 'Alice' });
  });

  it('drops the last snapshot when the listener is denied after it answered', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    store.seed('users/u1', { displayName: 'Alice' });
    const { result } = renderUser();
    await vi.waitFor(() => expect(result.current.data).toMatchObject({ displayName: 'Alice' }));

    const denial = permissionDenied();
    await denyUntilSurfaced('users/u1', denial);

    await vi.waitFor(() => expect(result.current.status).toBe('error'));
    expect(result.current.error).toBe(denial);
    expect(result.current.isLoadingError).toBe(true);
    expect(result.current.isRefetchError).toBe(false);
    expect(result.current.data).toBeUndefined();
  });

  it('still resolves a missing doc as null (no error)', async () => {
    const { result } = renderUser();

    await waitFor(() => expect(result.current.data).toBeNull());
    expect(result.current.isError).toBe(false);
  });
});

describe('useFirestoreCollection — subscribe:true listener errors', () => {
  it('surfaces a listener error as isError/error/status', async () => {
    const boom = unavailable();
    store.failReads(listensTo('items'), boom);
    const { result } = renderItems();

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error).toBe(boom);
    expect(result.current.status).toBe('error');
    expect(result.current.data).toBeUndefined();
  });

  it('refetch() restarts the failed listener and clears its error', async () => {
    store.failReads(listensTo('items'), unavailable());
    const { result } = renderItems();
    await waitFor(() => expect(result.current.isError).toBe(true));

    store.reset();
    store.seed('items/i1', { name: 'thing' });
    act(() => {
      void result.current.refetch();
    });

    await waitFor(() => expect(result.current.isError).toBe(false));
    expect(result.current.error).toBeNull();
    expect(result.current.data).toEqual([{ id: 'i1', name: 'thing' }]);
  });

  it('keeps the last snapshot beside a failure after it answered', async () => {
    store.seed('items/i1', { name: 'thing' });
    const { result } = renderItems();
    await waitFor(() => expect(result.current.data).toEqual([{ id: 'i1', name: 'thing' }]));

    act(() => store.failListeners(listensTo('items'), unavailable()));

    expect(result.current.isRefetchError).toBe(true);
    expect(result.current.data).toEqual([{ id: 'i1', name: 'thing' }]);
  });

  it('drops the last snapshot when the listener is denied after it answered', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    store.seed('items/i1', { name: 'thing' });
    const { result } = renderItems();
    await vi.waitFor(() => expect(result.current.data).toEqual([{ id: 'i1', name: 'thing' }]));

    const denial = permissionDenied();
    await denyUntilSurfaced('items', denial);

    await vi.waitFor(() => expect(result.current.status).toBe('error'));
    expect(result.current.error).toBe(denial);
    expect(result.current.isLoadingError).toBe(true);
    expect(result.current.isRefetchError).toBe(false);
    expect(result.current.data).toBeUndefined();
  });
});
