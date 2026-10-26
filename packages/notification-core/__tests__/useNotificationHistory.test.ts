import { describe, it, expect, beforeEach, vi } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';

const store = await vi.hoisted(async () => {
  const { makeInMemoryClientFirestore } =
    await import('@ttt-productions/firebase-helpers/firestore-client/testing');
  return makeInMemoryClientFirestore();
});

vi.mock(import('firebase/firestore'), async (importOriginal) => {
  const { clientFirestoreFake } = await import('../../../test/client-firestore-fake.js');
  return clientFirestoreFake(importOriginal, store);
});

import { useNotificationHistory } from '../src/react/hooks/useNotificationHistory.js';
import type { NotificationSystemConfig } from '../src/types.js';
import { firestoreTestWrapper } from '@ttt-productions/query-core/react/testing';

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

function renderHistory(userId: string, category: string) {
  return renderHook(() => useNotificationHistory({ config: makeConfig(), userId, category }), {
    wrapper: firestoreTestWrapper(store.db).Wrapper,
  });
}

describe('useNotificationHistory', () => {
  beforeEach(() => {
    store.reset();
  });

  it('throws for an unknown category', () => {
    expect(() => renderHistory('u1', 'nope')).toThrow('Unknown category: nope');
  });

  it('reads the per-user history path for a personal category, ordered by archivedAt desc', async () => {
    const { result } = renderHistory('u1', 'user');
    await waitFor(() => expect(result.current.data).toEqual([]));
    expect(store.queries()).toEqual([
      expect.objectContaining({
        kind: 'query',
        path: 'userProfiles/u1/notificationHistory',
        filters: [],
        orders: [{ field: 'archivedAt', direction: 'desc' }],
      }),
    ]);
  });

  it('reads the top-level history path for a shared category', async () => {
    const { result } = renderHistory('admin1', 'admin');
    await waitFor(() => expect(result.current.data).toEqual([]));
    expect(store.queries()).toEqual([
      expect.objectContaining({ path: 'adminNotificationHistory' }),
    ]);
  });

  it('disables the query when userId is empty', async () => {
    const { result } = renderHistory('', 'user');
    await act(async () => {});
    expect(result.current.fetchStatus).toBe('idle');
    expect(store.queries()).toEqual([]);
  });

  it('flattens the archivedSnapshot wrapper into a history item via select', async () => {
    store.seed('userProfiles/u1/notificationHistory/occ-1', {
      archivedAt: 111,
      archivedSnapshot: {
        id: 'active-1',
        title: 'Hi',
        message: 'body',
        type: 't',
        count: 2,
        updatedAt: 99,
      },
    });
    const { result } = renderHistory('u1', 'user');
    await waitFor(() => expect(result.current.data).toHaveLength(1));
    expect(result.current.data?.[0]).toMatchObject({
      title: 'Hi',
      message: 'body',
      count: 2,
      archiveOccurrenceId: 'occ-1',
      archivedAt: 111,
    });
  });
});
