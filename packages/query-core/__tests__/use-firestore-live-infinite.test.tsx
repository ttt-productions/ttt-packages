// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';

type Listener = {
  q: { __path: string; __c: unknown[] };
  next: (snap: unknown) => void;
  error: (e: Error) => void;
  unsubscribe: ReturnType<typeof vi.fn>;
};

const h = vi.hoisted(() => ({
  listeners: [] as Listener[],
  getDocs: vi.fn(),
}));

vi.mock('firebase/firestore', () => ({
  collection: (_db: unknown, path: string) => ({ __path: path }),
  query: (ref: { __path: string }, ...c: unknown[]) => ({ __path: ref.__path, __c: c }),
  orderBy: (f: string, d: string) => ({ __orderBy: [f, d] }),
  limit: (n: number) => ({ __limit: n }),
  startAfter: (c: { id: string }) => ({ __startAfter: c.id }),
  endAt: (c: { id: string }) => ({ __endAt: c.id }),
  onSnapshot: (
    q: Listener['q'],
    _opts: unknown,
    next: Listener['next'],
    error: Listener['error'],
  ) => {
    const unsubscribe = vi.fn();
    h.listeners.push({ q, next, error, unsubscribe });
    return unsubscribe;
  },
  getDocs: h.getDocs,
}));

import { useFirestoreLiveInfinite } from '../src/react/firestore/use-firestore-live-infinite.js';
import { FirestoreProvider } from '../src/react/firestore/context.js';

function doc(id: string, createdAt: number) {
  return { id, data: () => ({ createdAt }) };
}
function lastListener(): Listener {
  return h.listeners[h.listeners.length - 1];
}
function emit(listener: Listener, docs: Array<{ id: string; data: () => Record<string, unknown> }>, fromCache = false) {
  act(() => listener.next({ docs, metadata: { fromCache } }));
}
function constraintOf(listener: Listener, key: string): unknown {
  const found = listener.q.__c.find((c) => typeof c === 'object' && c !== null && key in c);
  return found ? (found as Record<string, unknown>)[key] : undefined;
}
function ids(items: unknown[]): string[] {
  return items.map((m) => (m as { id: string }).id);
}

function makeWrapper() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } });
  const Wrapper = ({ children }: { children: React.ReactNode }) =>
    React.createElement(
      QueryClientProvider,
      { client: qc },
      React.createElement(FirestoreProvider, { db: {} as never, children }),
    );
  Wrapper.displayName = 'TestWrapper';
  return Wrapper;
}

const baseOpts = {
  collectionPath: 'chats/t1/messages',
  queryKey: ['chat', 't1'],
  orderByField: 'createdAt',
  pageSize: 2,
};

beforeEach(() => {
  h.listeners.length = 0;
  h.getDocs.mockReset();
  h.getDocs.mockResolvedValue({ docs: [] });
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('useFirestoreLiveInfinite — reading', () => {
  it('is loading until the first snapshot, then returns items oldest first', () => {
    const { result } = renderHook(() => useFirestoreLiveInfinite({ ...baseOpts }), {
      wrapper: makeWrapper(),
    });
    expect(result.current.isInitialLoading).toBe(true);
    expect(result.current.sourceState).toBe('connecting');

    emit(lastListener(), [doc('b', 20), doc('a', 10)]);

    expect(result.current.isInitialLoading).toBe(false);
    expect(result.current.sourceState).toBe('live');
    expect(ids(result.current.items)).toEqual(['a', 'b']);
  });

  it('reports no older rows for a thread that exactly fills one page, and reads no older page', () => {
    const { result } = renderHook(() => useFirestoreLiveInfinite({ ...baseOpts }), {
      wrapper: makeWrapper(),
    });
    // The first listener asks for one row past the page; only two exist.
    expect(constraintOf(h.listeners[0], '__limit')).toBe(3);
    emit(h.listeners[0], [doc('b', 20), doc('a', 10)]);

    expect(result.current.hasOlder).toBe(false);
    expect(h.getDocs).not.toHaveBeenCalled();
  });

  it('keeps every row reachable as new messages arrive while the list is open', async () => {
    h.getDocs.mockResolvedValueOnce({ docs: [doc('a', 10)] });
    const { result } = renderHook(() => useFirestoreLiveInfinite({ ...baseOpts }), {
      wrapper: makeWrapper(),
    });
    // Three rows exist: the page (c, b) plus a look-ahead row proving something older exists.
    emit(h.listeners[0], [doc('c', 30), doc('b', 20), doc('a', 10)]);

    // The window's oldest row (b) becomes the anchor: the listener now covers b → newest
    // with no limit, and the older page starts after b.
    const anchored = lastListener();
    expect(h.listeners).toHaveLength(2);
    expect(constraintOf(anchored, '__endAt')).toBe('b');
    expect(constraintOf(anchored, '__limit')).toBeUndefined();
    await act(async () => {
      await result.current.fetchOlder();
    });
    await waitFor(() => expect(ids(result.current.items)).toEqual(['a', 'b', 'c']));

    // Two new messages arrive. Nothing older drops out of view.
    emit(anchored, [doc('e', 50), doc('d', 40), doc('c', 30), doc('b', 20)]);
    expect(ids(result.current.items)).toEqual(['a', 'b', 'c', 'd', 'e']);
    expect(result.current.hasOlder).toBe(false);
  });

  it('anchors on the first rows of an empty thread so a burst of new messages is never lost', () => {
    const { result } = renderHook(() => useFirestoreLiveInfinite({ ...baseOpts }), {
      wrapper: makeWrapper(),
    });
    emit(h.listeners[0], []);
    expect(result.current.isInitialLoading).toBe(false);
    expect(h.listeners).toHaveLength(1);

    emit(h.listeners[0], [doc('a', 10)]);
    const anchored = lastListener();
    expect(constraintOf(anchored, '__endAt')).toBe('a');
    emit(anchored, [doc('d', 40), doc('c', 30), doc('b', 20), doc('a', 10)]);
    expect(ids(result.current.items)).toEqual(['a', 'b', 'c', 'd']);
  });

  it('does not fix an anchor from cached data', () => {
    const { result } = renderHook(() => useFirestoreLiveInfinite({ ...baseOpts }), {
      wrapper: makeWrapper(),
    });
    emit(h.listeners[0], [doc('b', 20), doc('a', 10)], true);
    expect(h.listeners).toHaveLength(1);
    expect(result.current.sourceState).toBe('connecting');
    expect(ids(result.current.items)).toEqual(['a', 'b']);
  });

  it('applies select to map items', () => {
    const { result } = renderHook(
      () =>
        useFirestoreLiveInfinite<{ key: string }>({
          ...baseOpts,
          select: (d) => ({ key: `k:${d.id}` }),
        }),
      { wrapper: makeWrapper() },
    );
    emit(lastListener(), [doc('a', 10)]);
    expect(result.current.items).toEqual([{ key: 'k:a' }]);
  });

  it('opens no listener and stays empty when disabled', () => {
    const { result } = renderHook(() => useFirestoreLiveInfinite({ ...baseOpts, enabled: false }), {
      wrapper: makeWrapper(),
    });
    expect(h.listeners).toHaveLength(0);
    expect(result.current.items).toEqual([]);
    expect(result.current.isInitialLoading).toBe(false);
  });
});

describe('useFirestoreLiveInfinite — older rows only on request', () => {
  it('reads no older page until fetchOlder asks, though older rows exist', async () => {
    h.getDocs.mockResolvedValueOnce({ docs: [doc('a', 10)] });
    const { result } = renderHook(() => useFirestoreLiveInfinite({ ...baseOpts }), {
      wrapper: makeWrapper(),
    });
    emit(h.listeners[0], [doc('c', 30), doc('b', 20), doc('a', 10)]);
    await act(async () => {
      await Promise.resolve();
    });

    expect(h.getDocs).not.toHaveBeenCalled();
    expect(result.current.hasOlder).toBe(true);
    expect(result.current.isFetchingOlder).toBe(false);
    expect(ids(result.current.items)).toEqual(['b', 'c']);

    await act(async () => {
      await result.current.fetchOlder();
    });
    expect(h.getDocs).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(ids(result.current.items)).toEqual(['a', 'b', 'c']));
    expect(result.current.hasOlder).toBe(false);
  });

  it('reads each further older page after the last one loaded, on request', async () => {
    h.getDocs
      .mockResolvedValueOnce({ docs: [doc('d', 40), doc('c', 30), doc('b', 20)] })
      .mockResolvedValueOnce({ docs: [doc('b', 20), doc('a', 10)] });
    const { result } = renderHook(() => useFirestoreLiveInfinite({ ...baseOpts }), {
      wrapper: makeWrapper(),
    });
    emit(h.listeners[0], [doc('f', 60), doc('e', 50), doc('d', 40)]);

    await act(async () => {
      await result.current.fetchOlder();
    });
    await waitFor(() => expect(ids(result.current.items)).toEqual(['c', 'd', 'e', 'f']));
    expect(h.getDocs).toHaveBeenCalledTimes(1);

    await act(async () => {
      await result.current.fetchOlder();
    });
    expect(h.getDocs).toHaveBeenCalledTimes(2);
    await waitFor(() => expect(ids(result.current.items)).toEqual(['a', 'b', 'c', 'd', 'e', 'f']));
    expect(result.current.hasOlder).toBe(false);
  });
});

describe('useFirestoreLiveInfinite — order', () => {
  // Both reads are ordered by Firestore and meet at the anchor, so the merged list keeps the
  // order they deliver: the hook never sorts rows itself.
  it('lists rows in the order the reads deliver them, oldest first by default', async () => {
    h.getDocs.mockResolvedValueOnce({ docs: [doc('a', 999)] });
    const { result } = renderHook(() => useFirestoreLiveInfinite({ ...baseOpts }), {
      wrapper: makeWrapper(),
    });
    // Ordering values that disagree with the delivered order prove nothing re-sorts them.
    emit(h.listeners[0], [doc('c', 1), doc('b', 500), doc('a', 999)]);
    await act(async () => {
      await result.current.fetchOlder();
    });
    await waitFor(() => expect(ids(result.current.items)).toEqual(['a', 'b', 'c']));
  });

  it('lists rows newest first for sort desc', async () => {
    h.getDocs.mockResolvedValueOnce({ docs: [doc('a', 10)] });
    const { result } = renderHook(() => useFirestoreLiveInfinite({ ...baseOpts, sort: 'desc' }), {
      wrapper: makeWrapper(),
    });
    emit(h.listeners[0], [doc('c', 30), doc('b', 20), doc('a', 10)]);
    await act(async () => {
      await result.current.fetchOlder();
    });
    emit(lastListener(), [doc('d', 40), doc('c', 30), doc('b', 20)]);
    expect(ids(result.current.items)).toEqual(['d', 'c', 'b', 'a']);
  });

  it('orders rows whose ordering field is not a number, such as a timestamp', () => {
    const stamped = (id: string, seconds: number) => ({ id, data: () => ({ createdAt: { seconds } }) });
    const { result } = renderHook(() => useFirestoreLiveInfinite({ ...baseOpts }), {
      wrapper: makeWrapper(),
    });
    emit(h.listeners[0], [stamped('b', 20), stamped('a', 10)]);
    expect(ids(result.current.items)).toEqual(['a', 'b']);
  });

  it('shows a row that is in both reads once, as its live copy', async () => {
    h.getDocs.mockResolvedValueOnce({ docs: [{ id: 'a', data: () => ({ createdAt: 10, v: 'old' }) }] });
    const { result } = renderHook(() => useFirestoreLiveInfinite({ ...baseOpts }), {
      wrapper: makeWrapper(),
    });
    emit(h.listeners[0], [doc('c', 30), doc('b', 20), doc('a', 10)]);
    await act(async () => {
      await result.current.fetchOlder();
    });
    act(() =>
      lastListener().next({
        docs: [{ id: 'a', data: () => ({ createdAt: 40, v: 'new' }) }, doc('c', 30), doc('b', 20)],
        metadata: { fromCache: false },
      }),
    );
    expect(ids(result.current.items)).toEqual(['b', 'c', 'a']);
    expect((result.current.items[2] as unknown as { v: string }).v).toBe('new');
  });
});

describe('useFirestoreLiveInfinite — subscription identity', () => {
  it('shows nothing of the previous thread after a switch, and ignores its late rows', () => {
    const { result, rerender } = renderHook(
      ({ thread }: { thread: string }) =>
        useFirestoreLiveInfinite({
          ...baseOpts,
          collectionPath: `chats/${thread}/messages`,
          queryKey: ['chat', thread],
        }),
      { wrapper: makeWrapper(), initialProps: { thread: 't1' } },
    );
    const first = lastListener();
    emit(first, [doc('a1', 10)]);
    expect(ids(result.current.items)).toEqual(['a1']);
    const firstAnchored = lastListener();

    rerender({ thread: 't2' });
    expect(result.current.items).toEqual([]);
    expect(result.current.isInitialLoading).toBe(true);
    expect(result.current.sourceState).toBe('connecting');

    emit(firstAnchored, [doc('a2', 20), doc('a1', 10)]);
    expect(result.current.items).toEqual([]);

    const second = lastListener();
    expect(second.q.__path).toBe('chats/t2/messages');
    emit(second, [doc('b1', 5)]);
    expect(ids(result.current.items)).toEqual(['b1']);
  });

  it('never reports the previous thread’s failure under the new thread', () => {
    const { result, rerender } = renderHook(
      ({ thread }: { thread: string }) =>
        useFirestoreLiveInfinite({
          ...baseOpts,
          collectionPath: `chats/${thread}/messages`,
          queryKey: ['chat', thread],
        }),
      { wrapper: makeWrapper(), initialProps: { thread: 't1' } },
    );
    act(() => lastListener().error(Object.assign(new Error('boom'), { code: 'unavailable' })));
    expect(result.current.error).not.toBeNull();

    rerender({ thread: 't2' });
    expect(result.current.error).toBeNull();
    expect(result.current.sourceState).toBe('connecting');
  });
});

describe('useFirestoreLiveInfinite — failures', () => {
  it('ends the loading state with an error when the first listen fails', () => {
    const { result } = renderHook(() => useFirestoreLiveInfinite({ ...baseOpts }), {
      wrapper: makeWrapper(),
    });
    const failure = Object.assign(new Error('unavailable'), { code: 'unavailable' });
    act(() => lastListener().error(failure));

    expect(result.current.isInitialLoading).toBe(false);
    expect(result.current.error).toBe(failure);
    expect(result.current.sourceState).toBe('error');
    expect(result.current.items).toEqual([]);
  });

  it('retries a failed listener and recovers on its next snapshot', () => {
    const { result } = renderHook(() => useFirestoreLiveInfinite({ ...baseOpts }), {
      wrapper: makeWrapper(),
    });
    act(() => lastListener().error(Object.assign(new Error('x'), { code: 'unavailable' })));
    const before = h.listeners.length;

    act(() => result.current.retry());
    expect(result.current.error).toBeNull();
    expect(result.current.sourceState).toBe('connecting');
    expect(h.listeners.length).toBe(before + 1);

    emit(lastListener(), [doc('a', 10)]);
    expect(ids(result.current.items)).toEqual(['a']);
    expect(result.current.sourceState).toBe('live');
  });

  it('keeps the rows on screen when the listener fails after loading them', () => {
    const { result } = renderHook(() => useFirestoreLiveInfinite({ ...baseOpts }), {
      wrapper: makeWrapper(),
    });
    emit(lastListener(), [doc('a', 10)]);
    act(() => lastListener().error(Object.assign(new Error('x'), { code: 'unavailable' })));

    expect(result.current.error).not.toBeNull();
    expect(ids(result.current.items)).toEqual(['a']);
  });

  it('resubscribes a permission-denied listener on the backoff ladder before surfacing it', () => {
    vi.useFakeTimers();
    const { result } = renderHook(() => useFirestoreLiveInfinite({ ...baseOpts }), {
      wrapper: makeWrapper(),
    });
    const denied = () => Object.assign(new Error('denied'), { code: 'permission-denied' });

    for (const delay of [5_000, 15_000, 45_000]) {
      const count = h.listeners.length;
      act(() => lastListener().error(denied()));
      expect(result.current.error).toBeNull();
      expect(result.current.sourceState).toBe('connecting');
      act(() => {
        vi.advanceTimersByTime(delay);
      });
      expect(h.listeners.length).toBe(count + 1);
    }
    act(() => lastListener().error(denied()));
    expect(result.current.error).not.toBeNull();
    expect(result.current.sourceState).toBe('error');
  });

  it('reports a failed older page beside the loaded rows, and retry re-reads it', async () => {
    h.getDocs.mockRejectedValueOnce(new Error('older failed'));
    const { result } = renderHook(() => useFirestoreLiveInfinite({ ...baseOpts }), {
      wrapper: makeWrapper(),
    });
    emit(h.listeners[0], [doc('c', 30), doc('b', 20), doc('a', 10)]);
    await act(async () => {
      await result.current.fetchOlder();
    });

    await waitFor(() => expect(result.current.olderError).not.toBeNull());
    expect(result.current.hasOlder).toBe(true);
    expect(ids(result.current.items)).toEqual(['b', 'c']);

    h.getDocs.mockResolvedValueOnce({ docs: [doc('a', 10)] });
    act(() => result.current.retry());
    await waitFor(() => expect(result.current.olderError).toBeNull());
    expect(ids(result.current.items)).toEqual(['a', 'b', 'c']);
    expect(result.current.hasOlder).toBe(false);
  });

  it('reports a failed later older page without dropping the pages already loaded', async () => {
    h.getDocs
      .mockResolvedValueOnce({ docs: [doc('d', 40), doc('c', 30), doc('b', 20)] })
      .mockRejectedValueOnce(new Error('page 2 failed'));
    const { result } = renderHook(() => useFirestoreLiveInfinite({ ...baseOpts }), {
      wrapper: makeWrapper(),
    });
    emit(h.listeners[0], [doc('f', 60), doc('e', 50), doc('d', 40)]);
    await act(async () => {
      await result.current.fetchOlder();
    });
    await waitFor(() => expect(ids(result.current.items)).toEqual(['c', 'd', 'e', 'f']));
    expect(result.current.hasOlder).toBe(true);

    await act(async () => {
      await result.current.fetchOlder();
    });
    await waitFor(() => expect(result.current.olderError).not.toBeNull());
    expect(ids(result.current.items)).toEqual(['c', 'd', 'e', 'f']);
    expect(result.current.hasOlder).toBe(true);
  });
});

describe('useFirestoreLiveInfinite — retries and switches keep to one read', () => {
  it('a retry after an anchored window fails keeps its rows and resumes from the anchor', () => {
    const { result } = renderHook(() => useFirestoreLiveInfinite({ ...baseOpts }), {
      wrapper: makeWrapper(),
    });
    emit(h.listeners[0], [doc('b', 20), doc('a', 10)]);
    const anchored = lastListener();
    expect(constraintOf(anchored, '__endAt')).toBe('a');
    act(() => anchored.error(Object.assign(new Error('x'), { code: 'unavailable' })));

    act(() => result.current.retry());
    expect(ids(result.current.items)).toEqual(['a', 'b']);
    const resumed = lastListener();
    expect(resumed).not.toBe(anchored);
    expect(constraintOf(resumed, '__endAt')).toBe('a');
    expect(constraintOf(resumed, '__limit')).toBeUndefined();
  });

  it('an older page of the previous thread that resolves after a switch never appears', async () => {
    let resolveOlder: (value: unknown) => void = () => {};
    h.getDocs.mockImplementationOnce(() => new Promise((resolve) => { resolveOlder = resolve; }));
    const { result, rerender } = renderHook(
      ({ thread }: { thread: string }) =>
        useFirestoreLiveInfinite({
          ...baseOpts,
          collectionPath: `chats/${thread}/messages`,
          queryKey: ['chat', thread],
        }),
      { wrapper: makeWrapper(), initialProps: { thread: 't1' } },
    );
    emit(lastListener(), [doc('c1', 30), doc('b1', 20), doc('a1', 10)]);
    act(() => {
      void result.current.fetchOlder();
    });
    await waitFor(() => expect(h.getDocs).toHaveBeenCalled());

    rerender({ thread: 't2' });
    const second = lastListener();
    await act(async () => {
      resolveOlder({ docs: [doc('a1', 10)] });
    });
    emit(second, [doc('x2', 5)]);
    expect(ids(result.current.items)).toEqual(['x2']);
  });

  it('disabling and re-enabling starts the list afresh instead of showing the earlier rows', () => {
    const { result, rerender } = renderHook(
      ({ enabled }: { enabled: boolean }) => useFirestoreLiveInfinite({ ...baseOpts, enabled }),
      { wrapper: makeWrapper(), initialProps: { enabled: true } },
    );
    emit(lastListener(), [doc('a', 10)]);
    expect(ids(result.current.items)).toEqual(['a']);

    rerender({ enabled: false });
    expect(result.current.items).toEqual([]);
    rerender({ enabled: true });
    expect(result.current.items).toEqual([]);
    expect(result.current.isInitialLoading).toBe(true);
    expect(result.current.sourceState).toBe('connecting');
  });
});

describe('useFirestoreLiveInfinite — listener errors reach the provider handler', () => {
  function wrapperWith(onListenerError: (error: Error, details: unknown) => void) {
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } });
    const Wrapper = ({ children }: { children: React.ReactNode }) =>
      React.createElement(
        QueryClientProvider,
        { client: qc },
        React.createElement(FirestoreProvider, { db: {} as never, onListenerError, children }),
      );
    Wrapper.displayName = 'ReportingWrapper';
    return Wrapper;
  }

  it('hands a surfaced listener error to the handler once, naming the read, and not to the console', () => {
    const onListenerError = vi.fn();
    renderHook(() => useFirestoreLiveInfinite({ ...baseOpts }), { wrapper: wrapperWith(onListenerError) });
    const failure = Object.assign(new Error('unavailable'), { code: 'unavailable' });
    act(() => lastListener().error(failure));

    expect(onListenerError).toHaveBeenCalledTimes(1);
    expect(onListenerError).toHaveBeenCalledWith(failure, {
      hook: 'useFirestoreLiveInfinite',
      queryKey: ['chat', 't1'],
      path: 'chats/t1/messages',
    });
    expect(console.error).not.toHaveBeenCalled();
  });

  it('hands a permission-denied error over only once the resubscribe ladder is spent', () => {
    vi.useFakeTimers();
    const onListenerError = vi.fn();
    renderHook(() => useFirestoreLiveInfinite({ ...baseOpts }), { wrapper: wrapperWith(onListenerError) });
    const denied = () => Object.assign(new Error('denied'), { code: 'permission-denied' });

    for (const delay of [5_000, 15_000, 45_000]) {
      act(() => lastListener().error(denied()));
      expect(onListenerError).not.toHaveBeenCalled();
      act(() => {
        vi.advanceTimersByTime(delay);
      });
    }
    act(() => lastListener().error(denied()));
    expect(onListenerError).toHaveBeenCalledTimes(1);
  });

  it('writes the error to the console when the app supplied no handler', () => {
    renderHook(() => useFirestoreLiveInfinite({ ...baseOpts }), { wrapper: makeWrapper() });
    const failure = Object.assign(new Error('unavailable'), { code: 'unavailable' });
    act(() => lastListener().error(failure));
    expect(console.error).toHaveBeenCalledWith('[useFirestoreLiveInfinite] Subscription error:', failure);
  });
});

describe('useFirestoreLiveInfinite — the older pages take the caller cache tier', () => {
  it('applies staleTime and gcTime to the older-pages query', async () => {
    h.getDocs.mockResolvedValueOnce({ docs: [doc('a', 10)] });
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const Wrapper = ({ children }: { children: React.ReactNode }) =>
      React.createElement(
        QueryClientProvider,
        { client: qc },
        React.createElement(FirestoreProvider, { db: {} as never, children }),
      );
    Wrapper.displayName = 'TierWrapper';
    const { result } = renderHook(
      () => useFirestoreLiveInfinite({ ...baseOpts, staleTime: 123_000, gcTime: 456_000 }),
      { wrapper: Wrapper },
    );
    emit(h.listeners[0], [doc('c', 30), doc('b', 20), doc('a', 10)]);
    await act(async () => {
      await result.current.fetchOlder();
    });

    const older = qc.getQueryCache().findAll({ queryKey: ['chat', 't1', 'older'] });
    expect(older.length).toBeGreaterThan(0);
    for (const query of older) {
      expect((query.options as { staleTime?: number }).staleTime).toBe(123_000);
      expect(query.options.gcTime).toBe(456_000);
    }
  });
});
