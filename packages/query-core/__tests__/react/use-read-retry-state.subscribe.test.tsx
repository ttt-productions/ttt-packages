import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';

const store = await vi.hoisted(async () => {
  const { makeInMemoryClientFirestore } =
    await import('@ttt-productions/firebase-helpers/firestore-client/testing');
  return makeInMemoryClientFirestore();
});

vi.mock('firebase/firestore', async (importOriginal) => {
  const { clientFirestoreFake } = await import('../../../../test/client-firestore-fake.js');
  return clientFirestoreFake(importOriginal, store);
});

import { firestoreError } from '@ttt-productions/firebase-helpers/firestore-client/testing';
import { useFirestoreCollection } from '../../src/react/firestore/use-firestore-collection.js';
import { FirestoreProvider } from '../../src/react/firestore/context.js';
import { useReadRetryState } from '../../src/react/use-read-retry-state.js';
import { failNext, holdNext, listensTo } from '../helpers/listener-controls.js';

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
  return Wrapper;
}

const GAMES = 'leagues/l1/games';
const unavailable = () => firestoreError('unavailable', 'unavailable');

function renderSubscribed() {
  return renderHook(
    () => {
      const queryKey = ['games', 'l1'];
      const query = useFirestoreCollection({
        collectionPath: GAMES,
        queryKey,
        subscribe: true,
      });
      return { query, state: useReadRetryState(query, queryKey) };
    },
    { wrapper: makeWrapper() },
  );
}

beforeEach(() => {
  store.reset();
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('useReadRetryState over a subscribed read', () => {
  it('keeps a failed listener’s error on screen while its re-opened listener connects, and clears it on the first snapshot', async () => {
    const failure = unavailable();
    failNext(store, listensTo(GAMES), failure);
    const { result } = renderSubscribed();
    await waitFor(() =>
      expect(result.current.state).toEqual({ error: failure, isRetrying: false, isLoading: false }),
    );

    const release = holdNext(store, listensTo(GAMES));
    act(() => void result.current.query.refetch());
    expect(result.current.query.error).toBeNull();
    expect(result.current.state).toEqual({ error: failure, isRetrying: true, isLoading: false });

    store.seed(`${GAMES}/g1`, { score: 1 });
    act(release);
    await waitFor(() =>
      expect(result.current.state).toEqual({ error: null, isRetrying: false, isLoading: false }),
    );
  });

  it('shows the re-opened listener’s own failure when it fails too', async () => {
    failNext(store, listensTo(GAMES), unavailable());
    const { result } = renderSubscribed();
    await waitFor(() => expect(result.current.query.isError).toBe(true));

    const second = unavailable();
    failNext(store, listensTo(GAMES), second);
    act(() => void result.current.query.refetch());
    await waitFor(() =>
      expect(result.current.state).toEqual({ error: second, isRetrying: false, isLoading: false }),
    );
  });
});
