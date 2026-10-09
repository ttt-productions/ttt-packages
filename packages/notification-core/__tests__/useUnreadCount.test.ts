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

  it('counts the cards no member has seen for a shared category that shares one seen state', () => {
    setCount(4);
    const config = makeConfig();
    config.categories.admin.sharedSeenState = true;
    const { result } = renderHook(() => useUnreadCount({ config, userId: 'admin1', category: 'admin' }));

    expect(result.current.count).toBe(4);
    expect(mocks.whereFn).toHaveBeenCalledTimes(1);
    expect(mocks.whereFn).toHaveBeenCalledWith('seenAt', '==', 0);
    const opts = mocks.useFirestoreCount.mock.calls.at(-1)![0] as Record<string, unknown>;
    expect(opts.collectionPath).toBe('activeAdminNotifications');
    expect(opts.constraints).toHaveLength(1);
  });

  it('keys the count under the package key by default', () => {
    renderHook(() => useUnreadCount({ config: makeConfig(), userId: 'u1', category: 'user' }));
    const opts = mocks.useFirestoreCount.mock.calls.at(-1)![0] as Record<string, unknown>;
    expect(opts.queryKey).toEqual(['notifications', 'unread-count', 'user', 'u1']);
  });

  it('keys the count under the app key when the app supplies its key factory', () => {
    const queryKeys = {
      active: (category: string, userId: string) => ['app', 'active', category, userId],
      history: (category: string, userId: string) => ['app', 'history', category, userId],
      unreadCount: (category: string, userId: string) => ['app', 'unread', category, userId],
    };
    renderHook(() => useUnreadCount({ config: makeConfig(), userId: 'u1', category: 'user', queryKeys }));
    const opts = mocks.useFirestoreCount.mock.calls.at(-1)![0] as Record<string, unknown>;
    expect(opts.queryKey).toEqual(['app', 'unread', 'user', 'u1']);
  });

  it('says it has no answer while the count is unread, so its 0 is not one', () => {
    mocks.useFirestoreCount.mockReturnValue({ data: undefined, isLoading: true, isError: false, error: null } as never);
    const { result } = renderHook(() => useUnreadCount({ config: makeConfig(), userId: 'u1', category: 'user' }));
    expect(result.current.hasAnswer).toBe(false);
    expect(result.current.isLoading).toBe(true);
    expect(result.current.count).toBe(0);
  });

  it('says it has an answer once the count is read, an answered 0 included', () => {
    setCount(0);
    const { result } = renderHook(() => useUnreadCount({ config: makeConfig(), userId: 'u1', category: 'user' }));
    expect(result.current.hasAnswer).toBe(true);
    expect(result.current.count).toBe(0);
  });

  it('reports a failed first read as an error with no answer', () => {
    const failure = new Error('denied');
    mocks.useFirestoreCount.mockReturnValue({ data: undefined, isLoading: false, isError: true, error: failure } as never);
    const { result } = renderHook(() => useUnreadCount({ config: makeConfig(), userId: 'u1', category: 'user' }));
    expect(result.current.hasAnswer).toBe(false);
    expect(result.current.isError).toBe(true);
    expect(result.current.error).toBe(failure);
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
