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
import {
  anyListener,
  anyOneShotRead,
  failNext,
  failUntilStopped,
  holdNext,
  listensTo,
  opened,
} from './helpers/listener-controls.js';

const unavailable = () => firestoreError('unavailable', 'unavailable');
const permissionDenied = () => firestoreError('permission-denied', 'denied');

const hooks = [
  {
    name: 'useFirestoreDoc',
    path: (id = 'g1') => `games/${id}`,
    render: (enabled = true) =>
      renderHook(
        ({ on, id }: { on: boolean; id: string }) =>
          useFirestoreDoc({
            docPath: `games/${id}`,
            queryKey: ['game', id],
            subscribe: true,
            enabled: on,
          }),
        {
          wrapper: firestoreTestWrapper(store.db).Wrapper,
          initialProps: { on: enabled, id: 'g1' },
        },
      ),
    seed: (value: number, id = 'g1') => store.seed(`games/${id}`, { score: value }),
    read: (data: unknown) => (data as { score: number } | undefined)?.score,
  },
  {
    name: 'useFirestoreCollection',
    path: (id = 'g1') => `leagues/${id}/games`,
    render: (enabled = true) =>
      renderHook(
        ({ on, id }: { on: boolean; id: string }) =>
          useFirestoreCollection({
            collectionPath: `leagues/${id}/games`,
            queryKey: ['games', id],
            subscribe: true,
            enabled: on,
          }),
        {
          wrapper: firestoreTestWrapper(store.db).Wrapper,
          initialProps: { on: enabled, id: 'g1' },
        },
      ),
    seed: (value: number, id = 'g1') => store.seed(`leagues/${id}/games/g1`, { score: value }),
    read: (data: unknown) => (data as Array<{ score: number }> | undefined)?.[0]?.score,
  },
] as const;

const listens = () => opened(store, anyListener);
const oneShotReads = () => opened(store, anyOneShotRead);

const advance = (ms: number) =>
  act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });

beforeEach(() => {
  store.reset();
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

for (const hook of hooks) {
  const listener = listensTo(hook.path());

  describe(`${hook.name} — refetch() in subscribe mode re-opens the listener`, () => {
    it('re-opens a listener that failed before it answered, reporting pending with no data until its first snapshot', async () => {
      failNext(store, listener, unavailable());
      const { result } = hook.render();
      await waitFor(() => expect(result.current.isError).toBe(true));
      expect(result.current.data).toBeUndefined();

      const release = holdNext(store, listener);
      let settled: Promise<unknown> = Promise.resolve();
      act(() => {
        settled = result.current.refetch();
      });

      expect(opened(store, listener)).toBe(2);
      expect(result.current.isError).toBe(false);
      expect(result.current.error).toBeNull();
      expect(result.current.isFetching).toBe(true);
      expect(result.current.fetchStatus).toBe('fetching');
      expect(result.current.isPending).toBe(true);
      expect(result.current.data).toBeUndefined();
      expect(result.current.sourceState).toBe('connecting');

      hook.seed(2);
      act(release);
      await waitFor(() => expect(result.current.isFetching).toBe(false));
      expect(result.current.isSuccess).toBe(true);
      expect(hook.read(result.current.data)).toBe(2);

      const resolved = (await settled) as { isSuccess: boolean; data: unknown };
      expect(resolved.isSuccess).toBe(true);
      expect(hook.read(resolved.data)).toBe(2);
    });

    it('holds the last snapshot beside the failure of a listener that had answered, and through its restart', async () => {
      hook.seed(1);
      const { result } = hook.render();
      await waitFor(() => expect(hook.read(result.current.data)).toBe(1));
      const failure = unavailable();
      await act(async () => store.failListeners(listener, failure));

      expect(hook.read(result.current.data)).toBe(1);
      expect(result.current.isError).toBe(true);
      expect(result.current.error).toBe(failure);
      expect(result.current.status).toBe('error');
      expect(result.current.isRefetchError).toBe(true);
      expect(result.current.isLoadingError).toBe(false);

      const release = holdNext(store, listener);
      let settled: Promise<unknown> = Promise.resolve();
      act(() => {
        settled = result.current.refetch();
      });

      expect(opened(store, listener)).toBe(2);
      expect(hook.read(result.current.data)).toBe(1);
      expect(result.current.error).toBe(failure);
      expect(result.current.isFetching).toBe(true);
      expect(result.current.isRefetching).toBe(true);
      expect(result.current.isLoading).toBe(false);
      expect(result.current.sourceState).toBe('connecting');

      hook.seed(2);
      act(release);
      await waitFor(() => expect(result.current.isFetching).toBe(false));
      expect(result.current.isSuccess).toBe(true);
      expect(result.current.error).toBeNull();
      expect(hook.read(result.current.data)).toBe(2);
      expect(result.current.sourceState).toBe('live');

      const resolved = (await settled) as { isSuccess: boolean; data: unknown };
      expect(resolved.isSuccess).toBe(true);
      expect(hook.read(resolved.data)).toBe(2);
    });

    it('holds nothing after a denial of a listener that had answered, nor through its restart', async () => {
      vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
      hook.seed(1);
      const { result } = hook.render();
      await vi.waitFor(() => expect(hook.read(result.current.data)).toBe(1));
      const denial = permissionDenied();
      const stopDenying = failUntilStopped(store, listener, denial);
      await act(async () => store.failListeners(listener, denial));
      for (const delay of RESUBSCRIBE_DELAYS_MS) await advance(delay);

      await vi.waitFor(() => expect(result.current.status).toBe('error'));
      expect(result.current.data).toBeUndefined();
      expect(result.current.error).toBe(denial);
      expect(result.current.isLoadingError).toBe(true);
      expect(result.current.isRefetchError).toBe(false);

      stopDenying();
      const release = holdNext(store, listener);
      let settled: Promise<unknown> = Promise.resolve();
      act(() => {
        settled = result.current.refetch();
      });
      expect(result.current.data).toBeUndefined();
      expect(result.current.error).toBeNull();
      expect(result.current.isPending).toBe(true);
      expect(result.current.isFetching).toBe(true);

      hook.seed(2);
      act(release);
      await vi.waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(hook.read(result.current.data)).toBe(2);
      const resolved = (await settled) as { isSuccess: boolean };
      expect(resolved.isSuccess).toBe(true);
    });

    it('reports the next error when the re-opened listener fails too, and settles the refetch', async () => {
      failNext(store, listener, unavailable());
      const { result } = hook.render();
      await waitFor(() => expect(result.current.isError).toBe(true));

      const again = unavailable();
      const release = holdNext(store, listener);
      failNext(store, listener, again);
      let settled: Promise<unknown> = Promise.resolve();
      act(() => {
        settled = result.current.refetch();
      });
      expect(result.current.isFetching).toBe(true);

      act(release);
      await waitFor(() => expect(result.current.error).toBe(again));
      expect(result.current.isError).toBe(true);
      expect(result.current.isFetching).toBe(false);
      expect(result.current.sourceState).toBe('error');

      const resolved = (await settled) as { isError: boolean; error: unknown };
      expect(resolved.isError).toBe(true);
      expect(resolved.error).toBe(again);
    });

    it('rejects with the next error when asked to throw on error', async () => {
      failNext(store, listener, unavailable());
      const { result } = hook.render();
      await waitFor(() => expect(result.current.isError).toBe(true));

      const again = unavailable();
      failNext(store, listener, again);
      let settled: Promise<unknown> = Promise.resolve();
      act(() => {
        settled = result.current.refetch({ throwOnError: true });
      });
      await expect(settled).rejects.toBe(again);
    });

    it('gives the re-opened listener a fresh resubscribe ladder after the last one was spent', async () => {
      vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
      failUntilStopped(store, listener, permissionDenied());
      const { result } = hook.render();
      await advance(0);
      for (const delay of RESUBSCRIBE_DELAYS_MS) await advance(delay);
      await vi.waitFor(() => expect(result.current.isError).toBe(true));
      const openedBefore = opened(store, listener);

      act(() => {
        void result.current.refetch();
      });
      expect(opened(store, listener)).toBe(openedBefore + 1);

      await advance(0);
      expect(result.current.isError).toBe(false);
      expect(result.current.isFetching).toBe(true);
      await advance(RESUBSCRIBE_DELAYS_MS[0]);
      expect(opened(store, listener)).toBe(openedBefore + 2);
    });

    it('keeps a healthy listener’s data on screen while it re-opens', async () => {
      hook.seed(1);
      const { result } = hook.render();
      await waitFor(() => expect(hook.read(result.current.data)).toBe(1));

      const release = holdNext(store, listener);
      act(() => {
        void result.current.refetch();
      });
      expect(store.liveListeners()).toBe(0);
      expect(opened(store, listener)).toBe(2);
      expect(hook.read(result.current.data)).toBe(1);
      expect(result.current.isRefetching).toBe(true);

      hook.seed(3);
      act(release);
      await waitFor(() => expect(result.current.isFetching).toBe(false));
      expect(hook.read(result.current.data)).toBe(3);
    });

    it('opens no listener and reads nothing for a disabled read', async () => {
      const { result } = hook.render(false);
      await act(async () => {
        await result.current.refetch();
      });
      expect(listens()).toBe(0);
      expect(oneShotReads()).toBe(0);
      expect(result.current.isFetching).toBe(false);
    });

    it('a refetch kept from an earlier read never stalls the current one', async () => {
      failNext(store, listener, unavailable());
      const { result, rerender } = hook.render();
      await waitFor(() => expect(result.current.isError).toBe(true));
      const staleRefetch = result.current.refetch;

      rerender({ on: true, id: 'g2' });
      const current = listensTo(hook.path('g2'));
      expect(listens()).toBe(2);

      await act(async () => {
        await staleRefetch();
      });
      expect(listens()).toBe(2);
      hook.seed(5, 'g2');
      await waitFor(() => expect(hook.read(result.current.data)).toBe(5));
      expect(result.current.sourceState).toBe('live');

      const failure = unavailable();
      await act(async () => store.failListeners(current, failure));
      expect(result.current.isError).toBe(true);
      expect(result.current.error).toBe(failure);
    });

    it('a refetch after unmount settles at once and opens nothing', async () => {
      hook.seed(1);
      const { result, unmount } = hook.render();
      await waitFor(() => expect(hook.read(result.current.data)).toBe(1));
      const refetch = result.current.refetch;
      unmount();

      const openedBefore = listens();
      const settled = (await refetch()) as { data: unknown };
      expect(listens()).toBe(openedBefore);
      expect(hook.read(settled.data)).toBe(1);
    });

    it('a refetch open when the hook unmounts settles instead of hanging', async () => {
      failNext(store, listener, unavailable());
      const { result, unmount } = hook.render();
      await waitFor(() => expect(result.current.isError).toBe(true));
      holdNext(store, listener);
      let settled: Promise<unknown> = Promise.resolve();
      act(() => {
        settled = result.current.refetch();
      });
      unmount();
      await expect(settled).resolves.toBeDefined();
    });
  });
}

describe('useFirestoreDoc — refetch() without subscribe', () => {
  it('re-reads the document once and opens no listener', async () => {
    store.seed('games/g1', { score: 1 });
    const { result } = renderHook(
      () => useFirestoreDoc({ docPath: 'games/g1', queryKey: ['game', 'g1'] }),
      { wrapper: firestoreTestWrapper(store.db).Wrapper },
    );
    await waitFor(() => expect(result.current.data).toEqual({ id: 'g1', score: 1 }));
    const reads = oneShotReads();

    await act(async () => {
      await result.current.refetch();
    });
    expect(oneShotReads()).toBe(reads + 1);
    expect(listens()).toBe(0);
  });
});
