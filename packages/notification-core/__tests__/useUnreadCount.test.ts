import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook } from '@testing-library/react';

// Hoisted mocks so the firebase/firestore + query-core mocks can reference them.
const mocks = vi.hoisted(() => ({
  useFirestoreCount: vi.fn(),
  whereFn: vi.fn((field: string, op: string, value: unknown) => ({ field, op, value })),
}));

vi.mock('firebase/firestore', () => ({
  where: mocks.whereFn,
}));

vi.mock('@ttt-productions/query-core/react', () => ({
  useFirestoreCount: mocks.useFirestoreCount,
}));

import { useUnreadCount } from '../src/react/hooks/useUnreadCount';
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

function setCount(n: number) {
  mocks.useFirestoreCount.mockReturnValue({ data: n, isLoading: false, isError: false, error: null } as never);
}

describe('useUnreadCount', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setCount(0);
  });

  it('throws for an unknown category', () => {
    expect(() =>
      renderHook(() => useUnreadCount({ config: makeConfig(), userId: 'u1', category: 'nope' })),
    ).toThrow('Unknown category: nope');
  });

  it('counts unseen personal items (targetUserId == uid AND seenAt == 0)', () => {
    setCount(3);
    const { result } = renderHook(() =>
      useUnreadCount({ config: makeConfig(), userId: 'u1', category: 'user' }),
    );

    expect(result.current.count).toBe(3);
    expect(result.current.hasMore).toBe(false);
    expect(mocks.whereFn).toHaveBeenCalledWith('targetUserId', '==', 'u1');
    expect(mocks.whereFn).toHaveBeenCalledWith('seenAt', '==', 0);

    const opts = mocks.useFirestoreCount.mock.calls.at(-1)![0] as Record<string, unknown>;
    expect(opts.collectionPath).toBe('activeUserNotifications');
    expect(opts.constraints).toHaveLength(2);
  });

  it('uses an existence-based count for shared categories (no constraints)', () => {
    setCount(2);
    const { result } = renderHook(() =>
      useUnreadCount({ config: makeConfig(), userId: 'admin1', category: 'admin' }),
    );

    expect(result.current.count).toBe(2);
    expect(mocks.whereFn).not.toHaveBeenCalled();

    const opts = mocks.useFirestoreCount.mock.calls.at(-1)![0] as Record<string, unknown>;
    expect(opts.constraints).toHaveLength(0);
  });

  it('reports hasMore when the count exceeds the cap', () => {
    setCount(150);
    const { result } = renderHook(() =>
      useUnreadCount({ config: makeConfig(), userId: 'u1', category: 'user' }),
    );

    expect(result.current.count).toBe(150);
    expect(result.current.hasMore).toBe(true);
  });
});
