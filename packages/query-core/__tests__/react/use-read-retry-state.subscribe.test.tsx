import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';

// Capture each opened listener so a test can fail it, retry, and answer the re-opened one.
const h = vi.hoisted(() => ({
  listeners: [] as Array<{ next: (snap: unknown) => void; error: (e: Error) => void }>,
}));

vi.mock('firebase/firestore', () => ({
  collection: () => ({}),
  query: (ref: unknown) => ref,
  onSnapshot: (_target: unknown, _options: unknown, next: (s: unknown) => void, error: (e: Error) => void) => {
    h.listeners.push({ next, error });
    return vi.fn();
  },
  getDocs: vi.fn(async () => ({ docs: [] })),
}));

import { useFirestoreCollection } from '../../src/react/firestore/use-firestore-collection.js';
import { FirestoreProvider } from '../../src/react/firestore/context.js';
import { useReadRetryState } from '../../src/react/use-read-retry-state.js';

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
  return Wrapper;
}

const unavailable = () => Object.assign(new Error('unavailable'), { code: 'unavailable' });
const snapshot = () => ({ docs: [{ id: 'g1', data: () => ({ score: 1 }) }], metadata: { fromCache: false } });
const last = () => h.listeners[h.listeners.length - 1];

function renderSubscribed() {
  return renderHook(
    () => {
      const queryKey = ['games', 'l1'];
      const query = useFirestoreCollection({ collectionPath: 'leagues/l1/games', queryKey, subscribe: true });
      return { query, state: useReadRetryState(query, queryKey) };
    },
    { wrapper: makeWrapper() },
  );
}

beforeEach(() => {
  h.listeners.length = 0;
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('useReadRetryState over a subscribed read', () => {
  it('keeps a failed listener’s error on screen while its re-opened listener connects, and clears it on the first snapshot', () => {
    const { result } = renderSubscribed();
    const failure = unavailable();
    act(() => last().error(failure));
    expect(result.current.state).toEqual({ error: failure, isRetrying: false, isLoading: false });

    act(() => void result.current.query.refetch());
    // The subscribed read itself clears the listener error while the listener re-opens.
    expect(result.current.query.error).toBeNull();
    expect(result.current.state).toEqual({ error: failure, isRetrying: true, isLoading: false });

    act(() => last().next(snapshot()));
    expect(result.current.state).toEqual({ error: null, isRetrying: false, isLoading: false });
  });

  it('shows the re-opened listener’s own failure when it fails too', () => {
    const { result } = renderSubscribed();
    act(() => last().error(unavailable()));
    act(() => void result.current.query.refetch());

    const second = unavailable();
    act(() => last().error(second));
    expect(result.current.state).toEqual({ error: second, isRetrying: false, isLoading: false });
  });
});
