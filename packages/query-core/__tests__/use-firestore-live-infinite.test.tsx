// @vitest-environment jsdom
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
  const { clientFirestoreFake } = await import('../../../test/client-firestore-fake.js');
  return clientFirestoreFake(importOriginal, store);
});

import { Timestamp } from 'firebase/firestore';
import { firestoreError } from '@ttt-productions/firebase-helpers/firestore-client/testing';
import { useFirestoreLiveInfinite } from '../src/react/firestore/use-firestore-live-infinite.js';
import { FirestoreProvider } from '../src/react/firestore/context.js';
import { RESUBSCRIBE_DELAYS_MS } from '../src/react/firestore/resubscribe.js';
import {
  failNext,
  failUntilStopped,
  holdNext,
  lastOpened,
  listensTo,
  opened,
  readsOnce,
} from './helpers/listener-controls.js';

const T1 = 'chats/t1/messages';
const T2 = 'chats/t2/messages';
const live = listensTo(T1);
const older = readsOnce(T1);

function seed(thread: string, rows: Array<[string, unknown]>) {
  for (const [id, createdAt] of rows) store.seed(`${thread}/${id}`, { createdAt });
}
function ids(items: unknown[]): string[] {
  return items.map((m) => (m as { id: string }).id);
}
async function anchored(path = T1) {
  await waitFor(() => expect(opened(store, listensTo(path))).toBe(2));
  await waitFor(() => expect(store.liveListeners()).toBe(1));
}

function makeWrapper() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } });
  const Wrapper = ({ children }: { children: React.ReactNode }) =>
    React.createElement(
      QueryClientProvider,
      { client: qc },
      React.createElement(FirestoreProvider, { db: store.db, children }),
    );
  Wrapper.displayName = 'TestWrapper';
  return Wrapper;
}

const baseOpts = {
  collectionPath: T1,
  queryKey: ['chat', 't1'],
  orderByField: 'createdAt',
  pageSize: 2,
};

const unavailable = (message = 'unavailable') => firestoreError('unavailable', message);
const denied = () => firestoreError('permission-denied', 'denied');
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

describe('useFirestoreLiveInfinite — reading', () => {
  it('is loading until the first snapshot, then returns items oldest first', async () => {
    seed(T1, [
      ['b', 20],
      ['a', 10],
    ]);
    const release = holdNext(store, live);
    const { result } = renderHook(() => useFirestoreLiveInfinite({ ...baseOpts }), {
      wrapper: makeWrapper(),
    });
    expect(result.current.isInitialLoading).toBe(true);
    expect(result.current.sourceState).toBe('connecting');

    act(release);

    await waitFor(() => expect(ids(result.current.items)).toEqual(['a', 'b']));
    expect(result.current.isInitialLoading).toBe(false);
    expect(result.current.sourceState).toBe('live');
  });

  it('reports no older rows for a thread that exactly fills one page, and reads no older page', async () => {
    seed(T1, [
      ['b', 20],
      ['a', 10],
    ]);
    const { result } = renderHook(() => useFirestoreLiveInfinite({ ...baseOpts }), {
      wrapper: makeWrapper(),
    });
    expect(lastOpened(store, live)?.limit).toBe(3);
    await waitFor(() => expect(ids(result.current.items)).toEqual(['a', 'b']));

    expect(result.current.hasOlder).toBe(false);
    expect(opened(store, older)).toBe(0);
  });

  it('keeps every row reachable as new messages arrive while the list is open', async () => {
    seed(T1, [
      ['c', 30],
      ['b', 20],
      ['a', 10],
    ]);
    const { result } = renderHook(() => useFirestoreLiveInfinite({ ...baseOpts }), {
      wrapper: makeWrapper(),
    });

    await anchored();
    expect(lastOpened(store, live)?.limit).toBe(Infinity);
    expect(ids(result.current.items)).toEqual(['b', 'c']);
    await act(async () => {
      await result.current.fetchOlder();
    });
    await waitFor(() => expect(ids(result.current.items)).toEqual(['a', 'b', 'c']));

    act(() =>
      seed(T1, [
        ['e', 50],
        ['d', 40],
      ]),
    );
    expect(ids(result.current.items)).toEqual(['a', 'b', 'c', 'd', 'e']);
    expect(result.current.hasOlder).toBe(false);
  });

  it('anchors on the first rows of an empty thread so a burst of new messages is never lost', async () => {
    const { result } = renderHook(() => useFirestoreLiveInfinite({ ...baseOpts }), {
      wrapper: makeWrapper(),
    });
    await waitFor(() => expect(result.current.isInitialLoading).toBe(false));
    expect(opened(store, live)).toBe(1);

    act(() => seed(T1, [['a', 10]]));
    await anchored();
    expect(lastOpened(store, live)?.limit).toBe(Infinity);
    act(() =>
      seed(T1, [
        ['d', 40],
        ['c', 30],
        ['b', 20],
        ['z', 5],
      ]),
    );
    expect(ids(result.current.items)).toEqual(['a', 'b', 'c', 'd']);
  });

  it('does not fix an anchor from cached data', async () => {
    seed(T1, [
      ['b', 20],
      ['a', 10],
    ]);
    store.answerFromCache(live);
    const { result } = renderHook(() => useFirestoreLiveInfinite({ ...baseOpts }), {
      wrapper: makeWrapper(),
    });
    await waitFor(() => expect(result.current.isInitialLoading).toBe(false));
    expect(opened(store, live)).toBe(1);
    expect(result.current.sourceState).toBe('connecting');
    expect(ids(result.current.items)).toEqual(['a', 'b']);
  });

  it('applies select to map items', async () => {
    seed(T1, [['a', 10]]);
    const { result } = renderHook(
      () =>
        useFirestoreLiveInfinite<{ key: string }>({
          ...baseOpts,
          select: (d) => ({ key: `k:${d.id}` }),
        }),
      { wrapper: makeWrapper() },
    );
    await waitFor(() => expect(result.current.items).toEqual([{ key: 'k:a' }]));
  });

  it('opens no listener and stays empty when disabled', () => {
    const { result } = renderHook(() => useFirestoreLiveInfinite({ ...baseOpts, enabled: false }), {
      wrapper: makeWrapper(),
    });
    expect(store.queries()).toEqual([]);
    expect(result.current.items).toEqual([]);
    expect(result.current.isInitialLoading).toBe(false);
  });
});

describe('useFirestoreLiveInfinite — older rows only on request', () => {
  it('reads no older page until fetchOlder asks, though older rows exist', async () => {
    seed(T1, [
      ['c', 30],
      ['b', 20],
      ['a', 10],
    ]);
    const { result } = renderHook(() => useFirestoreLiveInfinite({ ...baseOpts }), {
      wrapper: makeWrapper(),
    });
    await anchored();

    expect(opened(store, older)).toBe(0);
    expect(result.current.hasOlder).toBe(true);
    expect(result.current.isFetchingOlder).toBe(false);
    expect(ids(result.current.items)).toEqual(['b', 'c']);

    await act(async () => {
      await result.current.fetchOlder();
    });
    expect(opened(store, older)).toBe(1);
    await waitFor(() => expect(ids(result.current.items)).toEqual(['a', 'b', 'c']));
    expect(result.current.hasOlder).toBe(false);
  });

  it('reads each further older page after the last one loaded, on request', async () => {
    seed(T1, [
      ['f', 60],
      ['e', 50],
      ['d', 40],
      ['c', 30],
      ['b', 20],
      ['a', 10],
    ]);
    const { result } = renderHook(() => useFirestoreLiveInfinite({ ...baseOpts }), {
      wrapper: makeWrapper(),
    });
    await anchored();

    await act(async () => {
      await result.current.fetchOlder();
    });
    await waitFor(() => expect(ids(result.current.items)).toEqual(['c', 'd', 'e', 'f']));
    expect(opened(store, older)).toBe(1);

    await act(async () => {
      await result.current.fetchOlder();
    });
    expect(opened(store, older)).toBe(2);
    await waitFor(() => expect(ids(result.current.items)).toEqual(['a', 'b', 'c', 'd', 'e', 'f']));
    expect(result.current.hasOlder).toBe(false);
  });
});

describe('useFirestoreLiveInfinite — order', () => {
  it('lists rows in the order the reads deliver them, oldest first by default', async () => {
    seed(T1, [
      ['c', 'a string orders after every timestamp'],
      ['b', Timestamp.fromMillis(500_000)],
      ['a', 999],
    ]);
    const { result } = renderHook(() => useFirestoreLiveInfinite({ ...baseOpts }), {
      wrapper: makeWrapper(),
    });
    await anchored();
    await act(async () => {
      await result.current.fetchOlder();
    });
    await waitFor(() => expect(ids(result.current.items)).toEqual(['a', 'b', 'c']));
  });

  it('lists rows newest first for sort desc', async () => {
    seed(T1, [
      ['c', 30],
      ['b', 20],
      ['a', 10],
    ]);
    const { result } = renderHook(() => useFirestoreLiveInfinite({ ...baseOpts, sort: 'desc' }), {
      wrapper: makeWrapper(),
    });
    await anchored();
    await act(async () => {
      await result.current.fetchOlder();
    });
    act(() => seed(T1, [['d', 40]]));
    await waitFor(() => expect(ids(result.current.items)).toEqual(['d', 'c', 'b', 'a']));
  });

  it('orders rows whose ordering field is not a number, such as a timestamp', async () => {
    seed(T1, [
      ['b', Timestamp.fromMillis(20_000)],
      ['a', Timestamp.fromMillis(10_000)],
    ]);
    const { result } = renderHook(() => useFirestoreLiveInfinite({ ...baseOpts }), {
      wrapper: makeWrapper(),
    });
    await waitFor(() => expect(ids(result.current.items)).toEqual(['a', 'b']));
  });

  it('shows a row that is in both reads once, as its live copy', async () => {
    seed(T1, [
      ['c', 30],
      ['b', 20],
    ]);
    store.seed(`${T1}/a`, { createdAt: 10, v: 'old' });
    const { result } = renderHook(() => useFirestoreLiveInfinite({ ...baseOpts }), {
      wrapper: makeWrapper(),
    });
    await anchored();
    await act(async () => {
      await result.current.fetchOlder();
    });
    await waitFor(() => expect(ids(result.current.items)).toEqual(['a', 'b', 'c']));

    act(() => store.seed(`${T1}/a`, { createdAt: 40, v: 'new' }));
    expect(ids(result.current.items)).toEqual(['b', 'c', 'a']);
    expect(result.current.items[2]?.v).toBe('new');
  });
});

describe('useFirestoreLiveInfinite — subscription identity', () => {
  it('shows nothing of the previous thread after a switch, and closes its listener', async () => {
    seed(T1, [['a1', 10]]);
    const { result, rerender } = renderHook(
      ({ thread }: { thread: string }) =>
        useFirestoreLiveInfinite({
          ...baseOpts,
          collectionPath: `chats/${thread}/messages`,
          queryKey: ['chat', thread],
        }),
      { wrapper: makeWrapper(), initialProps: { thread: 't1' } },
    );
    await anchored();
    expect(ids(result.current.items)).toEqual(['a1']);

    rerender({ thread: 't2' });
    expect(result.current.items).toEqual([]);
    expect(result.current.isInitialLoading).toBe(true);
    expect(result.current.sourceState).toBe('connecting');

    expect(opened(store, listensTo(T2))).toBe(1);
    act(() => seed(T2, [['b1', 5]]));
    await waitFor(() => expect(ids(result.current.items)).toEqual(['b1']));
    expect(store.liveListeners()).toBe(1);
  });

  it('never reports the previous thread’s failure under the new thread', async () => {
    failNext(store, live, unavailable('boom'));
    const { result, rerender } = renderHook(
      ({ thread }: { thread: string }) =>
        useFirestoreLiveInfinite({
          ...baseOpts,
          collectionPath: `chats/${thread}/messages`,
          queryKey: ['chat', thread],
        }),
      { wrapper: makeWrapper(), initialProps: { thread: 't1' } },
    );
    await waitFor(() => expect(result.current.error).not.toBeNull());

    rerender({ thread: 't2' });
    expect(result.current.error).toBeNull();
    expect(result.current.sourceState).toBe('connecting');
  });
});

describe('useFirestoreLiveInfinite — failures', () => {
  it('ends the loading state with an error when the first listen fails', async () => {
    const failure = unavailable();
    failNext(store, live, failure);
    const { result } = renderHook(() => useFirestoreLiveInfinite({ ...baseOpts }), {
      wrapper: makeWrapper(),
    });

    await waitFor(() => expect(result.current.error).toBe(failure));
    expect(result.current.isInitialLoading).toBe(false);
    expect(result.current.sourceState).toBe('error');
    expect(result.current.items).toEqual([]);
  });

  it('retries a failed listener and recovers on its next snapshot', async () => {
    failNext(store, live, unavailable('x'));
    const { result } = renderHook(() => useFirestoreLiveInfinite({ ...baseOpts }), {
      wrapper: makeWrapper(),
    });
    await waitFor(() => expect(result.current.error).not.toBeNull());
    const before = opened(store, live);

    const release = holdNext(store, live);
    act(() => result.current.retry());
    expect(result.current.error).toBeNull();
    expect(result.current.sourceState).toBe('connecting');
    expect(opened(store, live)).toBe(before + 1);

    seed(T1, [['a', 10]]);
    act(release);
    await waitFor(() => expect(ids(result.current.items)).toEqual(['a']));
    expect(result.current.sourceState).toBe('live');
  });

  it('keeps the rows on screen when the listener fails after loading them', async () => {
    seed(T1, [['a', 10]]);
    const { result } = renderHook(() => useFirestoreLiveInfinite({ ...baseOpts }), {
      wrapper: makeWrapper(),
    });
    await anchored();
    act(() => store.failListeners(live, unavailable('x')));

    expect(result.current.error).not.toBeNull();
    expect(ids(result.current.items)).toEqual(['a']);
  });

  it('resubscribes a permission-denied listener on the backoff ladder before surfacing it', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    failUntilStopped(store, live, denied());
    const { result } = renderHook(() => useFirestoreLiveInfinite({ ...baseOpts }), {
      wrapper: makeWrapper(),
    });
    await advance(0);

    for (const delay of RESUBSCRIBE_DELAYS_MS) {
      const count = opened(store, live);
      expect(result.current.error).toBeNull();
      expect(result.current.sourceState).toBe('connecting');
      await advance(delay);
      expect(opened(store, live)).toBe(count + 1);
    }
    await vi.waitFor(() => expect(result.current.error).not.toBeNull());
    expect(result.current.sourceState).toBe('error');
  });

  it('drops every loaded row when a denial surfaces, and a retry reads the list afresh', async () => {
    seed(T1, [
      ['c', 30],
      ['b', 20],
      ['a', 10],
    ]);
    const { result } = renderHook(() => useFirestoreLiveInfinite({ ...baseOpts }), {
      wrapper: makeWrapper(),
    });
    await anchored();
    await act(async () => {
      await result.current.fetchOlder();
    });
    await waitFor(() => expect(ids(result.current.items)).toEqual(['a', 'b', 'c']));

    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    const denial = denied();
    const stopDenying = failUntilStopped(store, live, denial);
    act(() => store.failListeners(live, denial));
    for (const delay of RESUBSCRIBE_DELAYS_MS) await advance(delay);

    await vi.waitFor(() => expect(result.current.error).toBe(denial));
    expect(result.current.sourceState).toBe('error');
    expect(result.current.items).toEqual([]);
    expect(result.current.hasOlder).toBe(false);
    expect(result.current.isInitialLoading).toBe(false);

    stopDenying();
    const release = holdNext(store, live);
    act(() => result.current.retry());
    expect(lastOpened(store, live)?.limit).toBe(3);
    expect(result.current.items).toEqual([]);
    expect(result.current.isInitialLoading).toBe(true);

    act(release);
    await vi.waitFor(() => expect(ids(result.current.items)).toEqual(['b', 'c']));
    expect(result.current.hasOlder).toBe(true);
  });

  it('reports a failed older page beside the loaded rows, and retry re-reads it', async () => {
    seed(T1, [
      ['c', 30],
      ['b', 20],
      ['a', 10],
    ]);
    failNext(store, older, unavailable('older failed'));
    const { result } = renderHook(() => useFirestoreLiveInfinite({ ...baseOpts }), {
      wrapper: makeWrapper(),
    });
    await anchored();
    await act(async () => {
      await result.current.fetchOlder();
    });

    await waitFor(() => expect(result.current.olderError).not.toBeNull());
    expect(result.current.hasOlder).toBe(true);
    expect(ids(result.current.items)).toEqual(['b', 'c']);

    act(() => result.current.retry());
    await waitFor(() => expect(result.current.olderError).toBeNull());
    await waitFor(() => expect(ids(result.current.items)).toEqual(['a', 'b', 'c']));
    expect(result.current.hasOlder).toBe(false);
  });

  it('reports a failed later older page without dropping the pages already loaded', async () => {
    seed(T1, [
      ['f', 60],
      ['e', 50],
      ['d', 40],
      ['c', 30],
      ['b', 20],
      ['a', 10],
    ]);
    const { result } = renderHook(() => useFirestoreLiveInfinite({ ...baseOpts }), {
      wrapper: makeWrapper(),
    });
    await anchored();
    await act(async () => {
      await result.current.fetchOlder();
    });
    await waitFor(() => expect(ids(result.current.items)).toEqual(['c', 'd', 'e', 'f']));
    expect(result.current.hasOlder).toBe(true);

    failNext(store, older, unavailable('page 2 failed'));
    await act(async () => {
      await result.current.fetchOlder();
    });
    await waitFor(() => expect(result.current.olderError).not.toBeNull());
    expect(ids(result.current.items)).toEqual(['c', 'd', 'e', 'f']);
    expect(result.current.hasOlder).toBe(true);
  });
});

describe('useFirestoreLiveInfinite — retries and switches keep to one read', () => {
  it('a retry after an anchored window fails keeps its rows and resumes from the anchor', async () => {
    seed(T1, [
      ['b', 20],
      ['a', 10],
    ]);
    const { result } = renderHook(() => useFirestoreLiveInfinite({ ...baseOpts }), {
      wrapper: makeWrapper(),
    });
    await anchored();
    expect(lastOpened(store, live)?.limit).toBe(Infinity);
    act(() => store.failListeners(live, unavailable('x')));
    seed(T1, [['z', 5]]);

    act(() => result.current.retry());
    expect(ids(result.current.items)).toEqual(['a', 'b']);
    expect(opened(store, live)).toBe(3);
    expect(lastOpened(store, live)?.limit).toBe(Infinity);
    await waitFor(() => expect(store.liveListeners()).toBe(1));
    expect(ids(result.current.items)).toEqual(['a', 'b']);
  });

  it('an older page of the previous thread that resolves after a switch never appears', async () => {
    seed(T1, [
      ['c1', 30],
      ['b1', 20],
      ['a1', 10],
    ]);
    const release = holdNext(store, older);
    let landed = false;
    store.afterRead(older, () => {
      landed = true;
    });
    const { result, rerender } = renderHook(
      ({ thread }: { thread: string }) =>
        useFirestoreLiveInfinite({
          ...baseOpts,
          collectionPath: `chats/${thread}/messages`,
          queryKey: ['chat', thread],
        }),
      { wrapper: makeWrapper(), initialProps: { thread: 't1' } },
    );
    await anchored();
    act(() => {
      void result.current.fetchOlder();
    });
    await waitFor(() => expect(opened(store, older)).toBe(1));

    rerender({ thread: 't2' });
    seed(T2, [['x2', 5]]);
    act(release);
    await waitFor(() => expect(landed).toBe(true));
    await waitFor(() => expect(ids(result.current.items)).toEqual(['x2']));
    await act(async () => {});
    expect(ids(result.current.items)).toEqual(['x2']);
  });

  it('disabling and re-enabling starts the list afresh instead of showing the earlier rows', async () => {
    seed(T1, [['a', 10]]);
    const { result, rerender } = renderHook(
      ({ enabled }: { enabled: boolean }) => useFirestoreLiveInfinite({ ...baseOpts, enabled }),
      { wrapper: makeWrapper(), initialProps: { enabled: true } },
    );
    await waitFor(() => expect(ids(result.current.items)).toEqual(['a']));

    rerender({ enabled: false });
    expect(result.current.items).toEqual([]);
    rerender({ enabled: true });
    expect(result.current.items).toEqual([]);
    expect(result.current.isInitialLoading).toBe(true);
    expect(result.current.sourceState).toBe('connecting');
  });
});
