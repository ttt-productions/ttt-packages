import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';
import {
  firestoreError,
  type ClientReadPredicate,
} from '@ttt-productions/firebase-helpers/firestore-client/testing';

const store = await vi.hoisted(async () => {
  const { makeInMemoryClientFirestore } =
    await import('@ttt-productions/firebase-helpers/firestore-client/testing');
  return makeInMemoryClientFirestore();
});

vi.mock(import('firebase/firestore'), async (importOriginal) => {
  const { clientFirestoreFake } = await import('../../../test/client-firestore-fake.js');
  return clientFirestoreFake(importOriginal, store);
});

import { useActiveNotifications } from '../src/react/hooks/useActiveNotifications.js';
import type { NotificationSystemConfig } from '../src/types.js';
import { firestoreTestWrapper } from '@ttt-productions/query-core/react/testing';

const config: NotificationSystemConfig = {
  categories: {
    user: {
      activePath: 'activeUserNotifications',
      historyPath: (uid) => `userProfiles/${uid}/notificationHistory`,
      audienceType: 'personal',
    },
  },
  types: {},
};

const listens: ClientReadPredicate = (read) => read.listen;
const listensWithLimit =
  (size: number): ClientReadPredicate =>
  (read) =>
    read.listen && read.limit === size;

function firstMatch(predicate: ClientReadPredicate): ClientReadPredicate {
  let spent = false;
  return (read) => {
    if (spent || !predicate(read)) return false;
    spent = true;
    return true;
  };
}

function holdNext(predicate: ClientReadPredicate): () => void {
  let release: () => void = () => {};
  const held = new Promise<void>((resolve) => {
    release = resolve;
  });
  store.beforeRead(firstMatch(predicate), () => held);
  return () => release();
}

function seedNotifications(count: number) {
  for (let i = 1; i <= count; i++)
    store.seed(`activeUserNotifications/n${i}`, { targetUserId: 'u1', updatedAt: 1_000 - i });
}

const ids = (rows: ReadonlyArray<{ id: string }> | undefined) => rows?.map((row) => row.id);

const windowOf = (step: number, ceiling: number) => () =>
  useActiveNotifications({ config, userId: 'u1', category: 'user', step, ceiling });

beforeEach(() => {
  store.reset();
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  vi.useRealTimers();
});

const consoleLinesAbout = (text: string) =>
  [console.error, console.warn, console.log]
    .flatMap((method) => vi.mocked(method).mock.calls)
    .filter((args) => args.some((arg) => String(arg).includes(text)));

describe('useActiveNotifications — the live window', () => {
  it('logs nothing about a missing queryFn while it holds and grows the window', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(console, 'log').mockImplementation(() => {});
    seedNotifications(3);
    const { result } = renderHook(windowOf(1, 10), {
      wrapper: firestoreTestWrapper(store.db).Wrapper,
    });
    await waitFor(() => expect(result.current.data).toHaveLength(1));
    act(() => result.current.showMore());
    await waitFor(() => expect(result.current.data).toHaveLength(2));

    expect(consoleLinesAbout('queryFn')).toEqual([]);
  });

  it("listens to the member's active cards, newest first, one step plus a look-ahead card", async () => {
    seedNotifications(3);
    store.seed('activeUserNotifications/other', { targetUserId: 'u2', updatedAt: 5_000 });
    const { result } = renderHook(windowOf(2, 10), {
      wrapper: firestoreTestWrapper(store.db).Wrapper,
    });

    await waitFor(() => expect(ids(result.current.data)).toEqual(['n1', 'n2']));
    expect(store.queries()).toEqual([
      expect.objectContaining({
        listen: true,
        path: 'activeUserNotifications',
        filters: [{ field: 'targetUserId', op: '==', value: { t: 'str', v: 'u1' } }],
        orders: [expect.objectContaining({ field: 'updatedAt', direction: 'desc' })],
        limit: 3,
      }),
    ]);
    expect(result.current.canShowMore).toBe(true);
    expect(result.current.hasOlderBeyondCeiling).toBe(false);
  });

  it('offers no Show more once every card is in the window', async () => {
    seedNotifications(2);
    const { result } = renderHook(windowOf(2, 10), {
      wrapper: firestoreTestWrapper(store.db).Wrapper,
    });
    await waitFor(() => expect(ids(result.current.data)).toEqual(['n1', 'n2']));
    expect(result.current.canShowMore).toBe(false);
    expect(result.current.hasOlderBeyondCeiling).toBe(false);
  });

  it('never polls: a mounted window opens one listener and no other read', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval'] });
    seedNotifications(3);
    const { result } = renderHook(windowOf(10, 100), {
      wrapper: firestoreTestWrapper(store.db).Wrapper,
    });
    await vi.waitFor(() => expect(result.current.data).toHaveLength(3));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(120_000);
    });
    expect(store.queries()).toHaveLength(1);
  });

  it('grows by one step on Show more and keeps the rows it showed until the wider window answers', async () => {
    seedNotifications(5);
    const { result } = renderHook(windowOf(2, 10), {
      wrapper: firestoreTestWrapper(store.db).Wrapper,
    });
    await waitFor(() => expect(ids(result.current.data)).toEqual(['n1', 'n2']));

    const release = holdNext(listensWithLimit(5));
    act(() => result.current.showMore());
    await waitFor(() => expect(result.current.isShowingMore).toBe(true));
    expect(ids(result.current.data)?.slice(0, 2)).toEqual(['n1', 'n2']);
    expect(result.current.retryState.isLoading).toBe(false);

    act(release);
    await waitFor(() => expect(ids(result.current.data)).toEqual(['n1', 'n2', 'n3', 'n4']));
    expect(result.current.isShowingMore).toBe(false);
    expect(result.current.canShowMore).toBe(true);
  });

  it('stops at the ceiling and says when older cards lie beyond it', async () => {
    seedNotifications(5);
    const { result } = renderHook(windowOf(2, 3), {
      wrapper: firestoreTestWrapper(store.db).Wrapper,
    });
    await waitFor(() => expect(result.current.data).toHaveLength(2));

    act(() => result.current.showMore());
    await waitFor(() => expect(ids(result.current.data)).toEqual(['n1', 'n2', 'n3']));
    expect(store.queries().at(-1)).toEqual(expect.objectContaining({ listen: true, limit: 4 }));
    expect(result.current.canShowMore).toBe(false);
    expect(result.current.hasOlderBeyondCeiling).toBe(true);

    act(() => store.remove('activeUserNotifications/n1'));
    act(() => store.remove('activeUserNotifications/n2'));
    await waitFor(() => expect(ids(result.current.data)).toEqual(['n3', 'n4', 'n5']));
    expect(result.current.hasOlderBeyondCeiling).toBe(false);
  });

  it('shares one window between every mounted list of one category and member', async () => {
    seedNotifications(5);
    const { Wrapper } = firestoreTestWrapper(store.db);
    const tray = renderHook(windowOf(2, 10), { wrapper: Wrapper });
    const card = renderHook(windowOf(2, 10), { wrapper: Wrapper });
    await waitFor(() => expect(card.result.current.data).toHaveLength(2));

    act(() => tray.result.current.showMore());
    await waitFor(() => expect(card.result.current.data).toHaveLength(4));
    expect(tray.result.current.data).toHaveLength(4);
    expect(store.liveListeners()).toBe(1);
  });

  it('reads as loading, never as the current list, while a remount listens over a cached copy', async () => {
    seedNotifications(3);
    const { Wrapper } = firestoreTestWrapper(store.db);
    const first = renderHook(windowOf(10, 100), { wrapper: Wrapper });
    await waitFor(() => expect(first.result.current.data).toHaveLength(3));
    first.unmount();
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    act(() => store.remove('activeUserNotifications/n1'));
    const release = holdNext(listens);
    const again = renderHook(windowOf(10, 100), { wrapper: Wrapper });
    expect(again.result.current.data).toBeUndefined();
    expect(again.result.current.retryState.isLoading).toBe(true);

    act(release);
    await waitFor(() => expect(ids(again.result.current.data)).toEqual(['n2', 'n3']));
    expect(again.result.current.retryState.isLoading).toBe(false);
  });

  it('holds a failure through its retry and keeps the retry from reading as loading', async () => {
    const failure = firestoreError('unavailable', 'unavailable');
    store.failReads(firstMatch(listens), failure);
    const { result } = renderHook(windowOf(10, 100), {
      wrapper: firestoreTestWrapper(store.db).Wrapper,
    });
    await waitFor(() =>
      expect(result.current.retryState).toEqual({
        error: failure,
        isRetrying: false,
        isLoading: false,
      }),
    );
    expect(result.current.canShowMore).toBe(false);

    const release = holdNext(listens);
    act(() => {
      void result.current.refetch();
    });
    await waitFor(() =>
      expect(result.current.retryState).toEqual({
        error: failure,
        isRetrying: true,
        isLoading: false,
      }),
    );

    seedNotifications(1);
    act(release);
    await waitFor(() => expect(ids(result.current.data)).toEqual(['n1']));
    expect(result.current.retryState).toEqual({ error: null, isRetrying: false, isLoading: false });
  });
});
