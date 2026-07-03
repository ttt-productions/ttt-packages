import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook } from '@testing-library/react';

const mocks = vi.hoisted(() => ({
  useFirestorePaginated: vi.fn(),
  orderByFn: vi.fn((field: string, dir: string) => ({ field, dir })),
}));

vi.mock('firebase/firestore', () => ({
  orderBy: mocks.orderByFn,
}));

vi.mock('@ttt-productions/query-core/react', () => ({
  useFirestorePaginated: mocks.useFirestorePaginated,
}));

import { useNotificationHistory } from '../src/react/hooks/useNotificationHistory';
import type { NotificationSystemConfig } from '../src/types';

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

function lastOpts(): Record<string, unknown> {
  return mocks.useFirestorePaginated.mock.calls.at(-1)![0] as Record<string, unknown>;
}

describe('useNotificationHistory', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.useFirestorePaginated.mockReturnValue({
      data: [],
      isLoading: false,
      hasNextPage: false,
      nextPage: vi.fn(),
    } as never);
  });

  it('throws for an unknown category', () => {
    expect(() =>
      renderHook(() => useNotificationHistory({ config: makeConfig(), userId: 'u1', category: 'nope' })),
    ).toThrow('Unknown category: nope');
  });

  it('reads the per-user history path for a personal category, ordered by archivedAt desc', () => {
    renderHook(() => useNotificationHistory({ config: makeConfig(), userId: 'u1', category: 'user' }));
    const opts = lastOpts();
    expect(opts.collectionPath).toBe('userProfiles/u1/notificationHistory');
    expect(mocks.orderByFn).toHaveBeenCalledWith('archivedAt', 'desc');
    // No where() clause — personal history is already path-scoped.
    expect(opts.constraints).toHaveLength(1);
  });

  it('reads the top-level history path for a shared category', () => {
    renderHook(() => useNotificationHistory({ config: makeConfig(), userId: 'admin1', category: 'admin' }));
    expect(lastOpts().collectionPath).toBe('adminNotificationHistory');
  });

  it('disables the query when userId is empty', () => {
    renderHook(() => useNotificationHistory({ config: makeConfig(), userId: '', category: 'user' }));
    expect(lastOpts().enabled).toBe(false);
  });

  it('flattens the archivedSnapshot wrapper into a history item via select', () => {
    renderHook(() => useNotificationHistory({ config: makeConfig(), userId: 'u1', category: 'user' }));
    const select = lastOpts().select as (d: Record<string, unknown>) => Record<string, unknown>;
    const mapped = select({
      id: 'occ-1',
      archivedAt: 111,
      archivedSnapshot: { id: 'active-1', title: 'Hi', message: 'body', type: 't', count: 2, updatedAt: 99 },
    });
    expect(mapped).toMatchObject({
      title: 'Hi',
      message: 'body',
      count: 2,
      archiveOccurrenceId: 'occ-1',
      archivedAt: 111,
    });
  });

  it('falls back to snapshot.updatedAt when archivedAt is absent', () => {
    renderHook(() => useNotificationHistory({ config: makeConfig(), userId: 'u1', category: 'user' }));
    const select = lastOpts().select as (d: Record<string, unknown>) => Record<string, unknown>;
    const mapped = select({ id: 'occ-2', archivedSnapshot: { updatedAt: 77 } });
    expect(mapped.archivedAt).toBe(77);
  });
});
