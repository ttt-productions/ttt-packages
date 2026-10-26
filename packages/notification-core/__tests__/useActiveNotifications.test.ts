import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';
import { QueryClient } from '@tanstack/react-query';
import { firestoreError } from '@ttt-productions/firebase-helpers/firestore-client/testing';

const store = await vi.hoisted(async () => {
  const { makeInMemoryClientFirestore } =
    await import('@ttt-productions/firebase-helpers/firestore-client/testing');
  return makeInMemoryClientFirestore();
});

vi.mock('firebase/firestore', async (importOriginal) => {
  const { clientFirestoreFake } = await import('../../../test/client-firestore-fake.js');
  return clientFirestoreFake(importOriginal, store);
});

import { useActiveNotifications } from '../src/react/hooks/useActiveNotifications.js';
import type { NotificationSystemConfig } from '../src/types.js';
import { kitFirestoreWrapper } from './helpers/kit-firestore-wrapper.js';

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

function seedNotifications(count: number) {
  for (let i = 1; i <= count; i++)
    store.seed(`activeUserNotifications/n${i}`, { targetUserId: 'u1', updatedAt: 1_000 - i });
}

async function flush() {
  for (let i = 0; i < 5; i++)
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });
}

async function advance(ms: number) {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });
  await flush();
}

beforeEach(() => {
  store.reset();
  seedNotifications(3);
});

afterEach(() => {
  vi.useRealTimers();
});

describe('useActiveNotifications', () => {
  it('polls the displayed page on the 30s default interval', async () => {
    vi.useFakeTimers({
      toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval', 'Date'],
    });
    const { result } = renderHook(
      () => useActiveNotifications({ config, userId: 'u1', category: 'user' }),
      { wrapper: kitFirestoreWrapper(store.db) },
    );
    await flush();
    expect(result.current.data).toHaveLength(3);
    expect(store.queries()).toHaveLength(1);

    await advance(29_999);
    expect(store.queries()).toHaveLength(1);
    await advance(1);
    expect(store.queries()).toHaveLength(2);
  });

  it("holds a failed page's failure through its retry, and never carries it onto another page", async () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const { result } = renderHook(
      () => useActiveNotifications({ config, userId: 'u1', category: 'user', pageSize: 1 }),
      { wrapper: kitFirestoreWrapper(store.db, client) },
    );
    await waitFor(() => expect(result.current.hasNextPage).toBe(true));
    act(() => result.current.nextPage());
    await waitFor(() => expect(result.current.page).toBe(2));
    await waitFor(() => expect(result.current.hasNextPage).toBe(true));

    const failure = firestoreError('unavailable', 'unavailable');
    store.failReads(() => true, failure);
    act(() => result.current.nextPage());
    await waitFor(() => expect(result.current.page).toBe(3));
    await waitFor(() =>
      expect(result.current.retryState).toEqual({
        error: failure,
        isRetrying: false,
        isLoading: false,
      }),
    );

    store.reset();
    seedNotifications(3);
    store.beforeRead(
      () => true,
      () => new Promise<void>(() => {}),
    );
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

    act(() => result.current.prevPage());
    await waitFor(() => expect(result.current.page).toBe(2));
    expect(result.current.retryState).toEqual({ error: null, isRetrying: false, isLoading: false });
  });

  it('forwards the poll interval and the stale time as two separate settings', async () => {
    vi.useFakeTimers({
      toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval', 'Date'],
    });
    const wrapper = kitFirestoreWrapper(store.db);
    const render = () =>
      renderHook(
        () =>
          useActiveNotifications({
            config,
            userId: 'u1',
            category: 'user',
            refetchInterval: 10_000,
            staleTime: 2_000,
          }),
        { wrapper },
      );
    const first = render();
    await flush();
    expect(first.result.current.data).toHaveLength(3);
    expect(store.queries()).toHaveLength(1);

    await advance(1_000);
    render();
    await flush();
    expect(store.queries()).toHaveLength(1);

    await advance(1_500);
    render();
    await flush();
    expect(store.queries()).toHaveLength(2);

    await advance(9_999);
    expect(store.queries()).toHaveLength(2);
    await advance(1);
    expect(store.queries()).toHaveLength(3);
  });
});
