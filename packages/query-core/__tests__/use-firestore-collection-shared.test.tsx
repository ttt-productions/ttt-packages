import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { firestoreTestWrapper } from '../src/react/testing/firestore-test-wrapper.js';
import { render, renderHook, act, waitFor } from '@testing-library/react';
import { StrictMode } from 'react';
import { QueryClient } from '@tanstack/react-query';

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
import { limit, orderBy } from 'firebase/firestore';
import { useFirestoreCollection } from '../src/react/firestore/use-firestore-collection.js';
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

const seedItems = (count: number) => {
  for (let i = 1; i <= count; i++) store.seed(`items/i${i}`, { rank: 100 - i });
};
const listens = () => opened(store, listensTo('items'));
const ids = (rows: Array<{ id: string }> | undefined) => rows?.map((row) => row.id);
const useItems = (size = 10) =>
  useFirestoreCollection<{ rank: number }>({
    collectionPath: 'items',
    queryKey: ['items'],
    constraints: [orderBy('rank', 'desc'), limit(size)],
    subscribe: true,
  });
const widerListener = (size: number) => (read: { listen: boolean; limit: number }) =>
  read.listen && read.limit === size;

describe('useFirestoreCollection — one shared listener per query key', () => {
  it('opens one listener for two mounts, and the second mount is live in its first render', async () => {
    seedItems(2);
    const { Wrapper } = firestoreTestWrapper(store.db);
    const first = renderHook(() => useItems(), { wrapper: Wrapper });
    await waitFor(() => expect(first.result.current.sourceState).toBe('live'));

    const firstRender: Array<{ state: string; rows: string[] | undefined }> = [];
    const second = renderHook(
      () => {
        const read = useItems();
        firstRender.push({ state: read.sourceState, rows: ids(read.data) });
        return read;
      },
      { wrapper: Wrapper },
    );
    expect(firstRender[0]).toEqual({ state: 'live', rows: ['i1', 'i2'] });
    expect(second.result.current.isLoading).toBe(false);
    expect(listens()).toBe(1);
    expect(store.liveListeners()).toBe(1);
  });

  it('keeps the listener while any mount remains and stops it with the last one', async () => {
    seedItems(1);
    const { Wrapper } = firestoreTestWrapper(store.db);
    const first = renderHook(() => useItems(), { wrapper: Wrapper });
    const second = renderHook(() => useItems(), { wrapper: Wrapper });
    await waitFor(() => expect(second.result.current.sourceState).toBe('live'));

    first.unmount();
    expect(store.liveListeners()).toBe(1);
    act(() => store.seed('items/i0', { rank: 200 }));
    await waitFor(() => expect(ids(second.result.current.data)).toEqual(['i0', 'i1']));

    second.unmount();
    await afterCommit();
    expect(store.liveListeners()).toBe(0);
  });

  it('starts a fresh listener on a remount after the last unmount, connecting until the server answers', async () => {
    seedItems(2);
    const { Wrapper } = firestoreTestWrapper(store.db);
    const first = renderHook(() => useItems(), { wrapper: Wrapper });
    await waitFor(() => expect(first.result.current.sourceState).toBe('live'));
    first.unmount();
    await afterCommit();

    const release = holdNext(store, listensTo('items'));
    const again = renderHook(() => useItems(), { wrapper: Wrapper });
    expect(listens()).toBe(2);
    expect(again.result.current.data).toHaveLength(2);
    expect(again.result.current.sourceState).toBe('connecting');
    expect(again.result.current.isPlaceholderData).toBe(false);

    act(release);
    await waitFor(() => expect(again.result.current.sourceState).toBe('live'));
  });

  it('hands one listener failure to every mount', async () => {
    seedItems(1);
    const { Wrapper } = firestoreTestWrapper(store.db);
    const first = renderHook(() => useItems(), { wrapper: Wrapper });
    const second = renderHook(() => useItems(), { wrapper: Wrapper });
    await waitFor(() => expect(second.result.current.sourceState).toBe('live'));

    const failure = firestoreError('failed-precondition', 'The query requires an index.');
    await act(async () => store.failListeners(listensTo('items'), failure));
    for (const mount of [first, second]) {
      expect(mount.result.current.sourceState).toBe('error');
      expect(mount.result.current.error).toBe(failure);
    }
  });

  it('restarts the listener once for a refetch from either mount, and settles both', async () => {
    failNext(store, listensTo('items'), firestoreError('unavailable', 'unavailable'));
    seedItems(1);
    const { Wrapper } = firestoreTestWrapper(store.db);
    const first = renderHook(() => useItems(), { wrapper: Wrapper });
    const second = renderHook(() => useItems(), { wrapper: Wrapper });
    await waitFor(() => expect(second.result.current.sourceState).toBe('error'));
    expect(listens()).toBe(1);

    const release = holdNext(store, listensTo('items'));
    let fromFirst!: Promise<unknown>;
    let fromSecond!: Promise<unknown>;
    act(() => {
      fromFirst = first.result.current.refetch();
      fromSecond = second.result.current.refetch();
    });
    expect(listens()).toBe(2);
    expect(first.result.current.isFetching).toBe(true);
    expect(second.result.current.isFetching).toBe(true);

    act(release);
    await act(async () => {
      await Promise.all([fromFirst, fromSecond]);
    });
    expect(first.result.current.sourceState).toBe('live');
    expect(ids(second.result.current.data)).toEqual(['i1']);
    expect(listens()).toBe(2);
  });

  it('runs the permission-denied resubscribe ladder once for every mount', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    const denial = firestoreError('permission-denied', 'Missing or insufficient permissions.');
    store.failReads(listensTo('items'), denial);
    const { Wrapper } = firestoreTestWrapper(store.db);
    const first = renderHook(() => useItems(), { wrapper: Wrapper });
    const second = renderHook(() => useItems(), { wrapper: Wrapper });

    for (const delay of RESUBSCRIBE_DELAYS_MS) {
      await act(async () => {
        await vi.advanceTimersByTimeAsync(delay);
      });
    }
    await vi.waitFor(() => expect(second.result.current.sourceState).toBe('error'));
    expect(first.result.current.sourceState).toBe('error');
    expect(listens()).toBe(1 + RESUBSCRIBE_DELAYS_MS.length);
  });

  it('follows the latest constraints for one key: one restart, the rows carried for every mount', async () => {
    seedItems(4);
    const { Wrapper } = firestoreTestWrapper(store.db);
    const first = renderHook(({ size }: { size: number }) => useItems(size), {
      wrapper: Wrapper,
      initialProps: { size: 2 },
    });
    const second = renderHook(({ size }: { size: number }) => useItems(size), {
      wrapper: Wrapper,
      initialProps: { size: 2 },
    });
    await waitFor(() => expect(second.result.current.sourceState).toBe('live'));

    const release = holdNext(store, widerListener(4));
    first.rerender({ size: 4 });
    await waitFor(() => expect(second.result.current.isPlaceholderData).toBe(true));
    expect(ids(second.result.current.data)).toEqual(['i1', 'i2']);
    expect(first.result.current.isPlaceholderData).toBe(true);
    second.rerender({ size: 4 });
    expect(opened(store, widerListener(4))).toBe(1);
    expect(listens()).toBe(2);

    act(release);
    await waitFor(() => expect(first.result.current.sourceState).toBe('live'));
    expect(second.result.current.sourceState).toBe('live');
    expect(ids(second.result.current.data)).toEqual(['i1', 'i2', 'i3', 'i4']);
    expect(store.liveListeners()).toBe(1);
  });

  it('keeps one listener per key: another key opens its own', async () => {
    seedItems(1);
    const { Wrapper } = firestoreTestWrapper(store.db);
    renderHook(() => useItems(), { wrapper: Wrapper });
    const other = renderHook(
      () =>
        useFirestoreCollection({ collectionPath: 'items', queryKey: ['other'], subscribe: true }),
      { wrapper: Wrapper },
    );
    await waitFor(() => expect(other.result.current.sourceState).toBe('live'));
    expect(listens()).toBe(2);
  });

  it('shares nothing between two query clients', async () => {
    seedItems(1);
    const first = renderHook(() => useItems(), {
      wrapper: firestoreTestWrapper(store.db).Wrapper,
    });
    const second = renderHook(() => useItems(), {
      wrapper: firestoreTestWrapper(store.db).Wrapper,
    });
    expect(second.result.current.sourceState).toBe('connecting');
    await waitFor(() => expect(first.result.current.sourceState).toBe('live'));
    await waitFor(() => expect(second.result.current.sourceState).toBe('live'));
    expect(listens()).toBe(2);
  });
});

describe('useFirestoreCollection — the shared listener and its cache entry', () => {
  it('re-listens when its cache entry is removed, connecting until the rows return', async () => {
    seedItems(2);
    const { Wrapper, queryClient } = firestoreTestWrapper(store.db);
    const { result } = renderHook(() => useItems(), { wrapper: Wrapper });
    await waitFor(() => expect(result.current.sourceState).toBe('live'));

    const release = holdNext(store, listensTo('items'));
    act(() => queryClient.removeQueries({ queryKey: ['items'], exact: true }));
    expect(listens()).toBe(2);
    await waitFor(() => expect(result.current.sourceState).toBe('connecting'));
    expect(result.current.isPlaceholderData).toBe(false);

    act(release);
    await waitFor(() => expect(ids(result.current.data)).toEqual(['i1', 'i2']));
    expect(result.current.sourceState).toBe('live');
    expect(listens()).toBe(2);
  });

  it('re-listens when its cache entry is reset', async () => {
    seedItems(1);
    const { Wrapper, queryClient } = firestoreTestWrapper(store.db);
    const { result } = renderHook(() => useItems(), { wrapper: Wrapper });
    await waitFor(() => expect(result.current.sourceState).toBe('live'));

    await act(async () => {
      await queryClient.resetQueries({ queryKey: ['items'], exact: true });
    });
    await waitFor(() => expect(ids(result.current.data)).toEqual(['i1']));
    expect(result.current.sourceState).toBe('live');
    expect(listens()).toBe(2);
  });

  it('refills every mount when the cache is cleared and another mount arrives', async () => {
    seedItems(2);
    const { Wrapper, queryClient } = firestoreTestWrapper(store.db);
    const first = renderHook(() => useItems(), { wrapper: Wrapper });
    await waitFor(() => expect(first.result.current.sourceState).toBe('live'));

    act(() => queryClient.clear());
    const second = renderHook(() => useItems(), { wrapper: Wrapper });
    await waitFor(() => expect(ids(second.result.current.data)).toEqual(['i1', 'i2']));
    await waitFor(() => expect(ids(first.result.current.data)).toEqual(['i1', 'i2']));
    expect(first.result.current.sourceState).toBe('live');
    expect(second.result.current.sourceState).toBe('live');
    expect(store.liveListeners()).toBe(1);
  });

  it('does not re-listen on its own snapshot writes', async () => {
    seedItems(1);
    const { Wrapper } = firestoreTestWrapper(store.db);
    const { result } = renderHook(() => useItems(), { wrapper: Wrapper });
    await waitFor(() => expect(result.current.sourceState).toBe('live'));

    for (let i = 2; i <= 4; i++) {
      act(() => store.seed(`items/i${i}`, { rank: 100 - i }));
      await waitFor(() => expect(result.current.data).toHaveLength(i));
    }
    expect(listens()).toBe(1);
  });

  it('opens nothing for a cache removal after the last mount left', async () => {
    seedItems(1);
    const { Wrapper, queryClient } = firestoreTestWrapper(store.db);
    const mount = renderHook(() => useItems(), { wrapper: Wrapper });
    await waitFor(() => expect(mount.result.current.sourceState).toBe('live'));
    mount.unmount();

    act(() => queryClient.removeQueries({ queryKey: ['items'], exact: true }));
    await afterCommit();
    act(() => queryClient.removeQueries({ queryKey: ['items'], exact: true }));
    expect(listens()).toBe(1);
    expect(store.liveListeners()).toBe(0);
  });

  it('stops the listener and drops its cache watch a tick after the last mount leaves', async () => {
    seedItems(1);
    const { Wrapper, queryClient } = firestoreTestWrapper(store.db);
    const mount = renderHook(() => useItems(), { wrapper: Wrapper });
    await waitFor(() => expect(mount.result.current.sourceState).toBe('live'));
    expect(queryClient.getQueryCache().hasListeners()).toBe(true);

    mount.unmount();
    await afterCommit();
    expect(store.liveListeners()).toBe(0);
    expect(queryClient.getQueryCache().hasListeners()).toBe(false);
  });
});

describe('useFirestoreCollection — mounts that hand the key over', () => {
  it('keeps the listener when one mount leaves and another arrives in the same commit', async () => {
    seedItems(2);
    const { Wrapper } = firestoreTestWrapper(store.db);
    const leaving: string[] = [];
    const arriving: string[] = [];
    function Leaving() {
      leaving.push(useItems().sourceState);
      return null;
    }
    function Arriving() {
      arriving.push(useItems().sourceState);
      return null;
    }
    function Swap({ second }: { second: boolean }) {
      return second ? <Arriving /> : <Leaving />;
    }
    const view = render(<Swap second={false} />, { wrapper: Wrapper });
    await waitFor(() => expect(leaving.at(-1)).toBe('live'));

    view.rerender(<Swap second />);
    await afterCommit();
    expect(arriving.length).toBeGreaterThan(0);
    expect({ arriving, listens: listens() }).toEqual({
      arriving: arriving.map(() => 'live'),
      listens: 1,
    });
    expect(store.liveListeners()).toBe(1);
  });

  it('settles to one live listener under StrictMode and leaks nothing after unmount', async () => {
    seedItems(1);
    const { Wrapper } = firestoreTestWrapper(store.db);
    const { result, unmount } = renderHook(() => useItems(), {
      wrapper: ({ children }) => (
        <StrictMode>
          <Wrapper>{children}</Wrapper>
        </StrictMode>
      ),
    });
    await waitFor(() => expect(result.current.sourceState).toBe('live'));
    expect(ids(result.current.data)).toEqual(['i1']);
    expect(store.liveListeners()).toBe(1);

    unmount();
    await afterCommit();
    expect(store.liveListeners()).toBe(0);
  });
});

describe('useFirestoreCollection — keyed by the query client hash of its key', () => {
  it('shares one listener between keys that differ only in object key order', async () => {
    seedItems(1);
    const { Wrapper } = firestoreTestWrapper(store.db);
    const keyed = (queryKey: unknown[]) => () =>
      useFirestoreCollection({ collectionPath: 'items', queryKey, subscribe: true });
    const first = renderHook(keyed(['items', { a: 1, b: 2 }]), { wrapper: Wrapper });
    await waitFor(() => expect(first.result.current.sourceState).toBe('live'));
    const second = renderHook(keyed(['items', { b: 2, a: 1 }]), { wrapper: Wrapper });

    expect(second.result.current.sourceState).toBe('live');
    expect(listens()).toBe(1);
  });

  it('re-listens on a cache removal under a custom queryKeyHashFn', async () => {
    seedItems(1);
    const queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          retry: false,
          gcTime: Infinity,
          queryKeyHashFn: (key) => `custom:${JSON.stringify(key)}`,
        },
      },
    });
    const { Wrapper } = firestoreTestWrapper(store.db, { queryClient });
    const { result } = renderHook(() => useItems(), { wrapper: Wrapper });
    await waitFor(() => expect(result.current.sourceState).toBe('live'));

    act(() => queryClient.removeQueries({ queryKey: ['items'], exact: true }));
    await waitFor(() => expect(ids(result.current.data)).toEqual(['i1']));
    expect(listens()).toBe(2);
    expect(result.current.sourceState).toBe('live');
  });
});
