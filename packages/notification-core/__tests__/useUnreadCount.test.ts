import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';

const store = await vi.hoisted(async () => {
  const { makeInMemoryClientFirestore } =
    await import('@ttt-productions/firebase-helpers/firestore-client/testing');
  return makeInMemoryClientFirestore();
});

vi.mock('firebase/firestore', async (importOriginal) => {
  const { clientFirestoreFake } = await import('../../../test/client-firestore-fake.js');
  return clientFirestoreFake(importOriginal, store);
});

import { useUnreadCount } from '../src/react/hooks/useUnreadCount.js';
import type { NotificationSystemConfig } from '../src/types.js';
import { kitFirestoreWrapper } from './helpers/kit-firestore-wrapper.js';

function makeConfig(): NotificationSystemConfig {
  return {
    categories: {
      user: {
        activePath: 'activeUserNotifications',
        historyPath: (uid) => `userProfiles/${uid}/notificationHistory`,
        audienceType: 'personal',
      },
      admin: {
        activePath: 'activeAdminNotifications',
        historyPath: () => 'adminNotificationHistory',
        audienceType: 'shared',
      },
    },
    types: {},
  };
}

function seedPersonal(id: string, targetUserId: string, seenAt: number) {
  store.seed(`activeUserNotifications/${id}`, { targetUserId, seenAt });
}

describe('useUnreadCount', () => {
  beforeEach(() => {
    store.reset();
  });

  it('throws for an unknown category', () => {
    expect(() =>
      renderHook(() => useUnreadCount({ config: makeConfig(), userId: 'u1', category: 'nope' }), {
        wrapper: kitFirestoreWrapper(store.db),
      }),
    ).toThrow('Unknown category: nope');
  });

  it('counts unseen personal items (targetUserId == uid AND seenAt == 0)', async () => {
    for (const id of ['a', 'b', 'c']) seedPersonal(id, 'u1', 0);
    seedPersonal('seen', 'u1', 1_700_000_000_000);
    seedPersonal('other', 'u2', 0);
    const { result } = renderHook(
      () => useUnreadCount({ config: makeConfig(), userId: 'u1', category: 'user' }),
      { wrapper: kitFirestoreWrapper(store.db) },
    );

    await waitFor(() => expect(result.current.count).toBe(3));
    expect(result.current.hasMore).toBe(false);
    expect(store.queries()).toEqual([
      expect.objectContaining({
        kind: 'count',
        path: 'activeUserNotifications',
        filters: [
          { field: 'targetUserId', op: '==', value: { t: 'str', v: 'u1' } },
          { field: 'seenAt', op: '==', value: { t: 'num', v: 0 } },
        ],
      }),
    ]);
  });

  it('uses an existence-based count for shared categories (no constraints)', async () => {
    store.seed('activeAdminNotifications/a', { seenAt: 0 });
    store.seed('activeAdminNotifications/b', { seenAt: 1_700_000_000_000 });
    const { result } = renderHook(
      () => useUnreadCount({ config: makeConfig(), userId: 'admin1', category: 'admin' }),
      { wrapper: kitFirestoreWrapper(store.db) },
    );

    await waitFor(() => expect(result.current.count).toBe(2));
    expect(store.queries()).toEqual([
      expect.objectContaining({ kind: 'count', path: 'activeAdminNotifications', filters: [] }),
    ]);
  });

  it('reports hasMore when the count exceeds the cap', async () => {
    for (let i = 0; i < 150; i++) seedPersonal(`n${i}`, 'u1', 0);
    const { result } = renderHook(
      () => useUnreadCount({ config: makeConfig(), userId: 'u1', category: 'user' }),
      { wrapper: kitFirestoreWrapper(store.db) },
    );

    await waitFor(() => expect(result.current.count).toBe(150));
    expect(result.current.hasMore).toBe(true);
  });
});
