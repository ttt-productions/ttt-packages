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
import { RESUBSCRIBE_DELAYS_MS } from '../src/react/firestore/resubscribe.js';
import { failNext, holdNext, listensTo, opened } from './helpers/listener-controls.js';

const afterCommit = () =>
  act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
  });

beforeEach(() => {
  store.reset();
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  vi.useRealTimers();
});

const listens = (path = 'users/u1') => opened(store, listensTo(path));
const useUser = (path = 'users/u1') =>
  useFirestoreDoc<{ name: string }>({ docPath: path, queryKey: ['user'], subscribe: true });

describe('useFirestoreDoc — one shared listener per query key', () => {
  it('opens one listener for two mounts, and the second mount is live in its first render', async () => {
    store.seed('users/u1', { name: 'Ada' });
    const { Wrapper } = firestoreTestWrapper(store.db);
    const first = renderHook(() => useUser(), { wrapper: Wrapper });
    await waitFor(() => expect(first.result.current.sourceState).toBe('live'));

    const firstRender: Array<{ state: string; data: unknown }> = [];
    const second = renderHook(
      () => {
        const read = useUser();
        firstRender.push({ state: read.sourceState, data: read.data });
        return read;
      },
      { wrapper: Wrapper },
    );
    expect(firstRender[0]).toEqual({ state: 'live', data: { id: 'u1', name: 'Ada' } });
    expect(second.result.current.isLoading).toBe(false);
    expect(listens()).toBe(1);
    expect(store.liveListeners()).toBe(1);
  });

  it('shares a missing document between two mounts as null, live', async () => {
    const { Wrapper } = firestoreTestWrapper(store.db);
    const first = renderHook(() => useUser(), { wrapper: Wrapper });
    await waitFor(() => expect(first.result.current.sourceState).toBe('live'));
    const second = renderHook(() => useUser(), { wrapper: Wrapper });

    expect(first.result.current.data).toBeNull();
    expect(second.result.current.data).toBeNull();
    expect(second.result.current.sourceState).toBe('live');
    expect(second.result.current.isError).toBe(false);
    expect(listens()).toBe(1);
  });

  it('keeps the listener while any mount remains and stops it with the last one', async () => {
    store.seed('users/u1', { name: 'Ada' });
    const { Wrapper } = firestoreTestWrapper(store.db);
    const first = renderHook(() => useUser(), { wrapper: Wrapper });
    const second = renderHook(() => useUser(), { wrapper: Wrapper });
    await waitFor(() => expect(second.result.current.sourceState).toBe('live'));

    first.unmount();
    expect(store.liveListeners()).toBe(1);
    act(() => store.seed('users/u1', { name: 'Grace' }));
    await waitFor(() => expect(second.result.current.data).toEqual({ id: 'u1', name: 'Grace' }));

    second.unmount();
    await afterCommit();
    expect(store.liveListeners()).toBe(0);
  });

  it('starts a fresh listener on a remount after the last unmount, connecting until the server answers', async () => {
    store.seed('users/u1', { name: 'Ada' });
    const { Wrapper } = firestoreTestWrapper(store.db);
    const first = renderHook(() => useUser(), { wrapper: Wrapper });
    await waitFor(() => expect(first.result.current.sourceState).toBe('live'));
    first.unmount();
    await afterCommit();

    const release = holdNext(store, listensTo('users/u1'));
    const again = renderHook(() => useUser(), { wrapper: Wrapper });
    expect(listens()).toBe(2);
    expect(again.result.current.sourceState).toBe('connecting');

    act(release);
    await waitFor(() => expect(again.result.current.sourceState).toBe('live'));
  });

  it('hands one listener failure to every mount, keeping the held document', async () => {
    store.seed('users/u1', { name: 'Ada' });
    const { Wrapper } = firestoreTestWrapper(store.db);
    const first = renderHook(() => useUser(), { wrapper: Wrapper });
    const second = renderHook(() => useUser(), { wrapper: Wrapper });
    await waitFor(() => expect(second.result.current.sourceState).toBe('live'));

    const failure = firestoreError('unavailable', 'unavailable');
    await act(async () => store.failListeners(listensTo('users/u1'), failure));
    for (const mount of [first, second]) {
      expect(mount.result.current.sourceState).toBe('error');
      expect(mount.result.current.error).toBe(failure);
      expect(mount.result.current.data).toEqual({ id: 'u1', name: 'Ada' });
    }
  });

  it('restarts the listener once for a refetch from either mount, and settles both', async () => {
    failNext(store, listensTo('users/u1'), firestoreError('unavailable', 'unavailable'));
    store.seed('users/u1', { name: 'Ada' });
    const { Wrapper } = firestoreTestWrapper(store.db);
    const first = renderHook(() => useUser(), { wrapper: Wrapper });
    const second = renderHook(() => useUser(), { wrapper: Wrapper });
    await waitFor(() => expect(second.result.current.sourceState).toBe('error'));

    const release = holdNext(store, listensTo('users/u1'));
    let fromFirst!: Promise<unknown>;
    let fromSecond!: Promise<unknown>;
    act(() => {
      fromFirst = first.result.current.refetch();
      fromSecond = second.result.current.refetch();
    });
    expect(listens()).toBe(2);

    act(release);
    await act(async () => {
      await Promise.all([fromFirst, fromSecond]);
    });
    expect(first.result.current.sourceState).toBe('live');
    expect(second.result.current.data).toEqual({ id: 'u1', name: 'Ada' });
    expect(listens()).toBe(2);
  });

  it('runs the permission-denied resubscribe ladder once for every mount', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    const denial = firestoreError('permission-denied', 'Missing or insufficient permissions.');
    store.failReads(listensTo('users/u1'), denial);
    const { Wrapper } = firestoreTestWrapper(store.db);
    const first = renderHook(() => useUser(), { wrapper: Wrapper });
    const second = renderHook(() => useUser(), { wrapper: Wrapper });

    for (const delay of RESUBSCRIBE_DELAYS_MS) {
      await act(async () => {
        await vi.advanceTimersByTimeAsync(delay);
      });
    }
    await vi.waitFor(() => expect(second.result.current.sourceState).toBe('error'));
    expect(first.result.current.sourceState).toBe('error');
    expect(listens()).toBe(1 + RESUBSCRIBE_DELAYS_MS.length);
  });

  it('re-listens when its cache entry is removed', async () => {
    store.seed('users/u1', { name: 'Ada' });
    const { Wrapper, queryClient } = firestoreTestWrapper(store.db);
    const { result } = renderHook(() => useUser(), { wrapper: Wrapper });
    await waitFor(() => expect(result.current.sourceState).toBe('live'));

    act(() => queryClient.removeQueries({ queryKey: ['user'], exact: true }));
    await waitFor(() => expect(result.current.data).toEqual({ id: 'u1', name: 'Ada' }));
    expect(result.current.sourceState).toBe('live');
    expect(listens()).toBe(2);
  });

  it('follows a new path under one key with one restart and no carried answer', async () => {
    store.seed('users/u1', { name: 'Ada' });
    store.seed('users/u2', { name: 'Grace' });
    const { Wrapper } = firestoreTestWrapper(store.db);
    const { result, rerender } = renderHook(({ path }: { path: string }) => useUser(path), {
      wrapper: Wrapper,
      initialProps: { path: 'users/u1' },
    });
    await waitFor(() => expect(result.current.sourceState).toBe('live'));

    const release = holdNext(store, listensTo('users/u2'));
    rerender({ path: 'users/u2' });
    expect(result.current.sourceState).toBe('connecting');
    expect(result.current.isPlaceholderData).toBe(false);

    act(release);
    await waitFor(() => expect(result.current.data).toEqual({ id: 'u2', name: 'Grace' }));
    expect(listens('users/u2')).toBe(1);
    expect(store.liveListeners()).toBe(1);
  });

  it('shares nothing between two query clients', async () => {
    store.seed('users/u1', { name: 'Ada' });
    const first = renderHook(() => useUser(), {
      wrapper: firestoreTestWrapper(store.db).Wrapper,
    });
    const second = renderHook(() => useUser(), {
      wrapper: firestoreTestWrapper(store.db).Wrapper,
    });
    expect(second.result.current.sourceState).toBe('connecting');
    await waitFor(() => expect(first.result.current.sourceState).toBe('live'));
    await waitFor(() => expect(second.result.current.sourceState).toBe('live'));
    expect(listens()).toBe(2);
  });
});
