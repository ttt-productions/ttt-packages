import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
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
import { RESUBSCRIBE_DELAYS_MS } from '../src/react/firestore/resubscribe.js';
import {
  failNext,
  failUntilStopped,
  holdNext,
  listensTo,
  opened,
} from './helpers/listener-controls.js';

const permissionDenied = () =>
  firestoreError('permission-denied', 'Missing or insufficient permissions.');

beforeEach(() => {
  store.reset();
  vi.spyOn(console, 'error').mockImplementation(() => {});
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
});

afterEach(() => {
  vi.useRealTimers();
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

const [D0, D1, D2] = RESUBSCRIBE_DELAYS_MS;

const advance = (ms: number) =>
  act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });

const targets = [
  {
    name: 'useFirestoreDoc',
    path: 'users/u1',
    seed: () => store.seed('users/u1', { n: 1 }),
    render: () =>
      renderHook(
        () => useFirestoreDoc({ docPath: 'users/u1', queryKey: ['user', 'u1'], subscribe: true }),
        { wrapper: makeWrapper().Wrapper },
      ),
  },
  {
    name: 'useFirestoreCollection',
    path: 'items',
    seed: () => store.seed('items/i1', { name: 'x' }),
    render: () =>
      renderHook(
        () =>
          useFirestoreCollection({ collectionPath: 'items', queryKey: ['items'], subscribe: true }),
        { wrapper: makeWrapper().Wrapper },
      ),
  },
] as const;

for (const target of targets) {
  const listens = () => opened(store, listensTo(target.path));

  describe(`${target.name} — bounded resubscribe on permission-denied`, () => {
    it('does not surface the error; resubscribes after the first delay and heals on the next snapshot', async () => {
      failNext(store, listensTo(target.path), permissionDenied());
      const { result } = target.render();
      expect(listens()).toBe(1);

      await advance(0);
      expect(result.current.isError).toBe(false);
      expect(result.current.sourceState).toBe('connecting');
      expect(listens()).toBe(1);

      target.seed();
      await advance(D0);
      expect(listens()).toBe(2);

      await vi.waitFor(() => expect(result.current.sourceState).toBe('live'));
      expect(result.current.isError).toBe(false);
    });

    it('surfaces the error once the ladder is exhausted (3 retries at 5s/15s/45s)', async () => {
      const boom = permissionDenied();
      failUntilStopped(store, listensTo(target.path), boom);
      const { result } = target.render();

      await advance(0);
      await advance(D0);
      await advance(D1);
      const release = holdNext(store, listensTo(target.path));
      await advance(D2);
      expect(listens()).toBe(4);
      expect(result.current.isError).toBe(false);

      act(release);
      await vi.waitFor(() => expect(result.current.isError).toBe(true));
      expect(result.current.error).toBe(boom);
      expect(result.current.status).toBe('error');
      expect(result.current.sourceState).toBe('error');
    });

    it('surfaces a non-permission-denied error immediately (no retry)', async () => {
      const boom = firestoreError('unavailable', 'unavailable');
      failNext(store, listensTo(target.path), boom);
      const { result } = target.render();

      await vi.waitFor(() => expect(result.current.isError).toBe(true));
      expect(result.current.error).toBe(boom);

      await advance(D0 + D1 + D2);
      expect(listens()).toBe(1);
    });

    it('resets the ladder after a healthy snapshot (a later blip gets a fresh first delay)', async () => {
      failNext(store, listensTo(target.path), permissionDenied());
      const { result } = target.render();

      await advance(0);
      target.seed();
      await advance(D0);
      expect(listens()).toBe(2);
      await vi.waitFor(() => expect(result.current.sourceState).toBe('live'));

      act(() => store.failListeners(listensTo(target.path), permissionDenied()));
      await advance(D0);
      expect(listens()).toBe(3);
    });

    it('clears a pending retry on unmount (no resubscribe after teardown)', async () => {
      failNext(store, listensTo(target.path), permissionDenied());
      const { unmount } = target.render();

      await advance(0);
      unmount();
      await advance(D0 + D1 + D2);
      expect(listens()).toBe(1);
    });
  });
}
