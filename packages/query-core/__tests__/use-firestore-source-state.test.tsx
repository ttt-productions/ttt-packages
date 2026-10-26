import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { firestoreTestWrapper } from '../src/react/testing/firestore-test-wrapper.js';
import { renderHook, act, waitFor } from '@testing-library/react';

const store = await vi.hoisted(async () => {
  const { makeInMemoryClientFirestore } =
    await import('@ttt-productions/firebase-helpers/firestore-client/testing');
  return makeInMemoryClientFirestore();
});

vi.mock(import('firebase/firestore'), async (importOriginal) => {
  const { clientFirestoreFake } = await import('../../../test/client-firestore-fake.js');
  return clientFirestoreFake(importOriginal, store);
});

import { firestoreError } from '@ttt-productions/firebase-helpers/firestore-client/testing';
import { useFirestoreDoc } from '../src/react/firestore/use-firestore-doc.js';
import { useFirestoreCollection } from '../src/react/firestore/use-firestore-collection.js';
import { RESUBSCRIBE_DELAYS_MS } from '../src/react/firestore/resubscribe.js';
import { failNext, lastOpened, listensTo } from './helpers/listener-controls.js';

beforeEach(() => {
  store.reset();
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  vi.useRealTimers();
});

const unavailable = () => firestoreError('unavailable', 'unavailable');

describe('useFirestoreCollection — sourceState (metadata-derived)', () => {
  it('subscribes with includeMetadataChanges and starts connecting', () => {
    const { Wrapper } = firestoreTestWrapper(store.db);
    const { result } = renderHook(
      () =>
        useFirestoreCollection({ collectionPath: 'items', queryKey: ['items'], subscribe: true }),
      { wrapper: Wrapper },
    );
    expect(result.current.sourceState).toBe('connecting');
    expect(lastOpened(store, listensTo('items'))?.includeMetadataChanges).toBe(true);
  });

  it('cache-first snapshot stays connecting until a server-confirmed snapshot makes it live', async () => {
    store.seed('items/i1', { name: 'x' });
    store.answerFromCache(listensTo('items'));
    const { Wrapper } = firestoreTestWrapper(store.db);
    const { result } = renderHook(
      () =>
        useFirestoreCollection({ collectionPath: 'items', queryKey: ['items'], subscribe: true }),
      { wrapper: Wrapper },
    );
    await waitFor(() => expect(result.current.data).toEqual([{ id: 'i1', name: 'x' }]));
    expect(result.current.sourceState).toBe('connecting');
    await act(async () => store.answerFromServer(listensTo('items')));
    expect(result.current.sourceState).toBe('live');
  });

  it('goes offline after being live, then back to live on reconnect', async () => {
    store.seed('items/i1', { name: 'x' });
    const { Wrapper } = firestoreTestWrapper(store.db);
    const { result } = renderHook(
      () =>
        useFirestoreCollection({ collectionPath: 'items', queryKey: ['items'], subscribe: true }),
      { wrapper: Wrapper },
    );
    await waitFor(() => expect(result.current.sourceState).toBe('live'));
    await act(async () => store.answerFromCache(listensTo('items')));
    expect(result.current.sourceState).toBe('offline');
    await act(async () => store.answerFromServer(listensTo('items')));
    expect(result.current.sourceState).toBe('live');
  });

  it('goes error when the listener fails for a reason it does not retry', async () => {
    store.seed('items/i1', { name: 'x' });
    const { Wrapper } = firestoreTestWrapper(store.db);
    const { result } = renderHook(
      () =>
        useFirestoreCollection({ collectionPath: 'items', queryKey: ['items'], subscribe: true }),
      { wrapper: Wrapper },
    );
    await waitFor(() => expect(result.current.sourceState).toBe('live'));
    await act(async () =>
      store.failListeners(
        listensTo('items'),
        firestoreError('failed-precondition', 'The query requires an index.'),
      ),
    );
    expect(result.current.sourceState).toBe('error');
  });

  it('reads connecting through the re-listen backoff after a permission loss, then error', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    store.seed('items/i1', { name: 'x' });
    const { Wrapper } = firestoreTestWrapper(store.db);
    const { result } = renderHook(
      () =>
        useFirestoreCollection({ collectionPath: 'items', queryKey: ['items'], subscribe: true }),
      { wrapper: Wrapper },
    );
    await vi.waitFor(() => expect(result.current.sourceState).toBe('live'));

    const denial = firestoreError('permission-denied', 'Missing or insufficient permissions.');
    store.failReads(listensTo('items'), denial);
    await act(async () => store.failListeners(listensTo('items'), denial));
    for (const delay of RESUBSCRIBE_DELAYS_MS) {
      expect(result.current.sourceState).toBe('connecting');
      await act(async () => {
        await vi.advanceTimersByTimeAsync(delay);
      });
    }

    await vi.waitFor(() => expect(result.current.sourceState).toBe('error'));
  });

  it('reads connecting for a new subscription identity (uid / admin-claim change)', async () => {
    store.seed('items/i1', { name: 'x' });
    const { Wrapper } = firestoreTestWrapper(store.db);
    const { result, rerender } = renderHook(
      ({ key }: { key: string }) =>
        useFirestoreCollection({
          collectionPath: 'items',
          queryKey: ['items', key],
          subscribe: true,
        }),
      { wrapper: Wrapper, initialProps: { key: 'u1' } },
    );
    await waitFor(() => expect(result.current.sourceState).toBe('live'));

    rerender({ key: 'u2' });
    expect(result.current.sourceState).toBe('connecting');
    await waitFor(() => expect(result.current.sourceState).toBe('live'));
  });
});

describe('useFirestoreDoc — sourceState (metadata-derived)', () => {
  it('connecting → live → offline → live', async () => {
    store.seed('users/u1', { n: 1 });
    const { Wrapper } = firestoreTestWrapper(store.db);
    const { result } = renderHook(
      () => useFirestoreDoc({ docPath: 'users/u1', queryKey: ['user', 'u1'], subscribe: true }),
      { wrapper: Wrapper },
    );
    expect(result.current.sourceState).toBe('connecting');
    await waitFor(() => expect(result.current.sourceState).toBe('live'));
    await act(async () => store.answerFromCache(listensTo('users/u1')));
    expect(result.current.sourceState).toBe('offline');
    await act(async () => store.answerFromServer(listensTo('users/u1')));
    expect(result.current.sourceState).toBe('live');
  });

  it('error callback sets error', async () => {
    failNext(store, listensTo('users/u1'), unavailable());
    const { Wrapper } = firestoreTestWrapper(store.db);
    const { result } = renderHook(
      () => useFirestoreDoc({ docPath: 'users/u1', queryKey: ['user', 'u1'], subscribe: true }),
      { wrapper: Wrapper },
    );
    await waitFor(() => expect(result.current.sourceState).toBe('error'));
  });
});

describe('source state and error belong to the subscription identity that produced them', () => {
  it('a collection never renders the previous identity as live, not even for one render', async () => {
    store.seed('items/i1', { name: 'x' });
    const { Wrapper } = firestoreTestWrapper(store.db);
    const seen: Array<{ key: string; state: string }> = [];
    const { result, rerender } = renderHook(
      ({ key }: { key: string }) => {
        const r = useFirestoreCollection({
          collectionPath: 'items',
          queryKey: ['items', key],
          subscribe: true,
        });
        seen.push({ key, state: r.sourceState });
        return r;
      },
      { wrapper: Wrapper, initialProps: { key: 'u1' } },
    );
    await waitFor(() => expect(result.current.sourceState).toBe('live'));

    rerender({ key: 'u2' });
    const u2States = seen.filter((s) => s.key === 'u2').map((s) => s.state);
    expect(u2States.length).toBeGreaterThan(0);
    expect(u2States.every((s) => s === 'connecting')).toBe(true);
  });

  it('a doc never renders the previous identity’s error under the new path', async () => {
    failNext(store, listensTo('users/u1'), firestoreError('unknown', 'boom'));
    const { Wrapper } = firestoreTestWrapper(store.db);
    const seen: Array<{ path: string; error: unknown; state: string }> = [];
    const { result, rerender } = renderHook(
      ({ path }: { path: string }) => {
        const r = useFirestoreDoc({ docPath: path, queryKey: ['doc', path], subscribe: true });
        seen.push({ path, error: r.error, state: r.sourceState });
        return r;
      },
      { wrapper: Wrapper, initialProps: { path: 'users/u1' } },
    );
    await waitFor(() => expect(result.current.sourceState).toBe('error'));

    rerender({ path: 'users/u2' });
    const u2 = seen.filter((s) => s.path === 'users/u2');
    expect(u2.length).toBeGreaterThan(0);
    expect(u2.every((s) => s.error === null && s.state === 'connecting')).toBe(true);
  });
});
