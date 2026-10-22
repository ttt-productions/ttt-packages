import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';

const h = vi.hoisted(() => ({
  listeners: [] as Array<{
    kind: 'doc' | 'col';
    next: (snap: unknown) => void;
    error: (e: Error) => void;
    unsubscribe: ReturnType<typeof vi.fn>;
  }>,
  getDoc: vi.fn(),
  getDocs: vi.fn(),
}));

vi.mock('firebase/firestore', () => ({
  doc: () => ({ __kind: 'doc' }),
  collection: () => ({ __kind: 'col' }),
  query: (ref: unknown) => ref,
  onSnapshot: (
    target: { __kind: 'doc' | 'col' },
    _options: unknown,
    next: (s: unknown) => void,
    error: (e: Error) => void,
  ) => {
    const unsubscribe = vi.fn();
    h.listeners.push({ kind: target.__kind, next, error, unsubscribe });
    return unsubscribe;
  },
  getDoc: h.getDoc,
  getDocs: h.getDocs,
}));

import { useFirestoreDoc } from '../src/react/firestore/use-firestore-doc.js';
import { useFirestoreCollection } from '../src/react/firestore/use-firestore-collection.js';
import { FirestoreProvider } from '../src/react/firestore/context.js';
import { RESUBSCRIBE_DELAYS_MS } from '../src/react/firestore/resubscribe.js';

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
const permissionDenied = () => Object.assign(new Error('denied'), { code: 'permission-denied' });

const hooks = [
  {
    name: 'useFirestoreDoc',
    render: (enabled = true) =>
      renderHook(
        ({ on, id }: { on: boolean; id: string }) =>
          useFirestoreDoc({
            docPath: `games/${id}`,
            queryKey: ['game', id],
            subscribe: true,
            enabled: on,
          }),
        { wrapper: makeWrapper(), initialProps: { on: enabled, id: 'g1' } },
      ),
    oneShotReads: () => h.getDoc.mock.calls.length,
    snapshot: (value: number) => ({
      exists: () => true,
      id: 'g1',
      data: () => ({ score: value }),
      metadata: { fromCache: false },
    }),
    read: (data: unknown) => (data as { score: number } | undefined)?.score,
  },
  {
    name: 'useFirestoreCollection',
    render: (enabled = true) =>
      renderHook(
        ({ on, id }: { on: boolean; id: string }) =>
          useFirestoreCollection({
            collectionPath: `leagues/${id}/games`,
            queryKey: ['games', id],
            subscribe: true,
            enabled: on,
          }),
        { wrapper: makeWrapper(), initialProps: { on: enabled, id: 'g1' } },
      ),
    oneShotReads: () => h.getDocs.mock.calls.length,
    snapshot: (value: number) => ({
      docs: [{ id: 'g1', data: () => ({ score: value }) }],
      metadata: { fromCache: false },
    }),
    read: (data: unknown) => (data as Array<{ score: number }> | undefined)?.[0]?.score,
  },
] as const;

const last = () => h.listeners[h.listeners.length - 1];

beforeEach(() => {
  h.listeners.length = 0;
  h.getDoc.mockReset();
  h.getDocs.mockReset();
  h.getDocs.mockResolvedValue({ docs: [] });
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

for (const hook of hooks) {
  describe(`${hook.name} — refetch() in subscribe mode re-opens the listener`, () => {
    it('re-opens a listener that failed before it answered, reporting pending with no data until its first snapshot', async () => {
      const { result } = hook.render();
      const failed = last();
      act(() => failed.error(unavailable()));
      expect(result.current.isError).toBe(true);
      expect(result.current.data).toBeUndefined();

      let settled: Promise<unknown> = Promise.resolve();
      act(() => {
        settled = result.current.refetch();
      });

      expect(h.listeners).toHaveLength(2);
      expect(last()).not.toBe(failed);
      expect(result.current.isError).toBe(false);
      expect(result.current.error).toBeNull();
      expect(result.current.isFetching).toBe(true);
      expect(result.current.fetchStatus).toBe('fetching');
      expect(result.current.isPending).toBe(true);
      expect(result.current.data).toBeUndefined();
      expect(result.current.sourceState).toBe('connecting');

      act(() => last().next(hook.snapshot(2)));
      expect(result.current.isFetching).toBe(false);
      expect(result.current.isSuccess).toBe(true);
      expect(hook.read(result.current.data)).toBe(2);

      const resolved = (await settled) as { isSuccess: boolean; data: unknown };
      expect(resolved.isSuccess).toBe(true);
      expect(hook.read(resolved.data)).toBe(2);
    });

    it('holds the last snapshot beside the failure of a listener that had answered, and through its restart', async () => {
      const { result } = hook.render();
      act(() => last().next(hook.snapshot(1)));
      const failed = last();
      const failure = unavailable();
      act(() => failed.error(failure));

      expect(hook.read(result.current.data)).toBe(1);
      expect(result.current.isError).toBe(true);
      expect(result.current.error).toBe(failure);
      expect(result.current.status).toBe('error');
      expect(result.current.isRefetchError).toBe(true);
      expect(result.current.isLoadingError).toBe(false);

      let settled: Promise<unknown> = Promise.resolve();
      act(() => {
        settled = result.current.refetch();
      });

      expect(h.listeners).toHaveLength(2);
      expect(last()).not.toBe(failed);
      expect(hook.read(result.current.data)).toBe(1);
      expect(result.current.error).toBe(failure);
      expect(result.current.isFetching).toBe(true);
      expect(result.current.isRefetching).toBe(true);
      expect(result.current.isLoading).toBe(false);
      expect(result.current.sourceState).toBe('connecting');

      act(() => last().next(hook.snapshot(2)));
      expect(result.current.isFetching).toBe(false);
      expect(result.current.isSuccess).toBe(true);
      expect(result.current.error).toBeNull();
      expect(hook.read(result.current.data)).toBe(2);
      expect(result.current.sourceState).toBe('live');

      const resolved = (await settled) as { isSuccess: boolean; data: unknown };
      expect(resolved.isSuccess).toBe(true);
      expect(hook.read(resolved.data)).toBe(2);
    });

    it('holds nothing after a denial of a listener that had answered, nor through its restart', async () => {
      vi.useFakeTimers();
      const { result } = hook.render();
      act(() => last().next(hook.snapshot(1)));
      for (const delay of RESUBSCRIBE_DELAYS_MS) {
        act(() => last().error(permissionDenied()));
        act(() => {
          vi.advanceTimersByTime(delay);
        });
      }
      const denial = permissionDenied();
      act(() => last().error(denial));

      expect(result.current.data).toBeUndefined();
      expect(result.current.error).toBe(denial);
      expect(result.current.status).toBe('error');
      expect(result.current.isLoadingError).toBe(true);
      expect(result.current.isRefetchError).toBe(false);

      let settled: Promise<unknown> = Promise.resolve();
      act(() => {
        settled = result.current.refetch();
      });
      expect(result.current.data).toBeUndefined();
      expect(result.current.error).toBeNull();
      expect(result.current.isPending).toBe(true);
      expect(result.current.isFetching).toBe(true);

      act(() => last().next(hook.snapshot(2)));
      expect(result.current.isSuccess).toBe(true);
      expect(hook.read(result.current.data)).toBe(2);
      const resolved = (await settled) as { isSuccess: boolean };
      expect(resolved.isSuccess).toBe(true);
    });

    it('reports the next error when the re-opened listener fails too, and settles the refetch', async () => {
      const { result } = hook.render();
      act(() => last().error(unavailable()));

      let settled: Promise<unknown> = Promise.resolve();
      act(() => {
        settled = result.current.refetch();
      });
      expect(result.current.isFetching).toBe(true);

      const again = unavailable();
      act(() => last().error(again));
      expect(result.current.isError).toBe(true);
      expect(result.current.error).toBe(again);
      expect(result.current.isFetching).toBe(false);
      expect(result.current.sourceState).toBe('error');

      const resolved = (await settled) as { isError: boolean; error: unknown };
      expect(resolved.isError).toBe(true);
      expect(resolved.error).toBe(again);
    });

    it('rejects with the next error when asked to throw on error', async () => {
      const { result } = hook.render();
      act(() => last().error(unavailable()));

      let settled: Promise<unknown> = Promise.resolve();
      act(() => {
        settled = result.current.refetch({ throwOnError: true });
      });
      const again = unavailable();
      act(() => last().error(again));
      await expect(settled).rejects.toBe(again);
    });

    it('gives the re-opened listener a fresh resubscribe ladder after the last one was spent', () => {
      vi.useFakeTimers();
      const { result } = hook.render();
      for (const delay of RESUBSCRIBE_DELAYS_MS) {
        act(() => last().error(permissionDenied()));
        act(() => {
          vi.advanceTimersByTime(delay);
        });
      }
      act(() => last().error(permissionDenied()));
      expect(result.current.isError).toBe(true);
      const opened = h.listeners.length;

      act(() => {
        void result.current.refetch();
      });
      expect(h.listeners).toHaveLength(opened + 1);

      act(() => last().error(permissionDenied()));
      expect(result.current.isError).toBe(false);
      expect(result.current.isFetching).toBe(true);
      act(() => {
        vi.advanceTimersByTime(RESUBSCRIBE_DELAYS_MS[0]);
      });
      expect(h.listeners).toHaveLength(opened + 2);
    });

    it('keeps a healthy listener’s data on screen while it re-opens', () => {
      const { result } = hook.render();
      act(() => last().next(hook.snapshot(1)));
      const healthy = last();

      act(() => {
        void result.current.refetch();
      });
      expect(healthy.unsubscribe).toHaveBeenCalled();
      expect(h.listeners).toHaveLength(2);
      expect(hook.read(result.current.data)).toBe(1);
      expect(result.current.isRefetching).toBe(true);

      act(() => last().next(hook.snapshot(3)));
      expect(result.current.isFetching).toBe(false);
      expect(hook.read(result.current.data)).toBe(3);
    });

    it('opens no listener and reads nothing for a disabled read', async () => {
      const { result } = hook.render(false);
      await act(async () => {
        await result.current.refetch();
      });
      expect(h.listeners).toHaveLength(0);
      expect(hook.oneShotReads()).toBe(0);
      expect(result.current.isFetching).toBe(false);
    });

    it('a refetch kept from an earlier read never stalls the current one', async () => {
      const { result, rerender } = hook.render();
      act(() => last().error(unavailable()));
      const staleRefetch = result.current.refetch;

      rerender({ on: true, id: 'g2' });
      const current = last();
      expect(h.listeners).toHaveLength(2);

      await act(async () => {
        await staleRefetch();
      });
      expect(h.listeners).toHaveLength(2);
      act(() => current.next(hook.snapshot(5)));
      expect(result.current.sourceState).toBe('live');
      expect(hook.read(result.current.data)).toBe(5);

      const failure = unavailable();
      act(() => current.error(failure));
      expect(result.current.isError).toBe(true);
      expect(result.current.error).toBe(failure);
    });

    it('a refetch after unmount settles at once and opens nothing', async () => {
      const { result, unmount } = hook.render();
      act(() => last().next(hook.snapshot(1)));
      const refetch = result.current.refetch;
      unmount();

      const opened = h.listeners.length;
      const settled = (await refetch()) as { data: unknown };
      expect(h.listeners).toHaveLength(opened);
      expect(hook.read(settled.data)).toBe(1);
    });

    it('a refetch open when the hook unmounts settles instead of hanging', async () => {
      const { result, unmount } = hook.render();
      act(() => last().error(unavailable()));
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
    h.getDoc.mockResolvedValue({ exists: () => true, id: 'g1', data: () => ({ score: 1 }) });
    const { result } = renderHook(
      () => useFirestoreDoc({ docPath: 'games/g1', queryKey: ['game', 'g1'] }),
      { wrapper: makeWrapper() },
    );
    await act(async () => {
      await Promise.resolve();
    });
    const reads = h.getDoc.mock.calls.length;

    await act(async () => {
      await result.current.refetch();
    });
    expect(h.getDoc.mock.calls.length).toBe(reads + 1);
    expect(h.listeners).toHaveLength(0);
  });
});
