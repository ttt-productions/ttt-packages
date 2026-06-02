import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';

// Hoisted mocks so the firebase/firestore + query-core mocks can reference them.
const mocks = vi.hoisted(() => ({
  getCountFromServer: vi.fn(),
  whereFn: vi.fn((field: string, op: string, value: unknown) => ({ field, op, value })),
  queryFn: vi.fn((ref: unknown, ...constraints: unknown[]) => ({ ref, constraints })),
  collectionFn: vi.fn((db: unknown, path: string) => ({ db, path })),
}));

vi.mock('firebase/firestore', () => ({
  collection: mocks.collectionFn,
  query: mocks.queryFn,
  where: mocks.whereFn,
  getCountFromServer: mocks.getCountFromServer,
}));

vi.mock('@ttt-productions/query-core/react', () => ({
  useFirestoreDb: () => ({ __db: true }),
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

function wrapper({ children }: { children: React.ReactNode }) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });
  return React.createElement(QueryClientProvider, { client }, children);
}

function setCount(n: number) {
  mocks.getCountFromServer.mockResolvedValue({ data: () => ({ count: n }) });
}

describe('useUnreadCount', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('throws for an unknown category', () => {
    expect(() =>
      renderHook(() => useUnreadCount({ config: makeConfig(), userId: 'u1', category: 'nope' }), {
        wrapper,
      })
    ).toThrow('Unknown category: nope');
  });

  it('counts unseen personal items (seenAt == 0, scoped to the caller)', async () => {
    setCount(3);
    const { result } = renderHook(
      () => useUnreadCount({ config: makeConfig(), userId: 'u1', category: 'user' }),
      { wrapper }
    );

    await waitFor(() => expect(result.current.count).toBe(3));
    expect(result.current.hasMore).toBe(false);

    // Personal predicate: targetUserId == uid AND seenAt == 0.
    expect(mocks.whereFn).toHaveBeenCalledWith('targetUserId', '==', 'u1');
    expect(mocks.whereFn).toHaveBeenCalledWith('seenAt', '==', 0);
  });

  it('uses an existence-based count for shared categories (no seenAt predicate)', async () => {
    setCount(2);
    const { result } = renderHook(
      () => useUnreadCount({ config: makeConfig(), userId: 'admin1', category: 'admin' }),
      { wrapper }
    );

    await waitFor(() => expect(result.current.count).toBe(2));
    // Shared: no where() constraints at all.
    expect(mocks.whereFn).not.toHaveBeenCalled();
  });

  it('reports hasMore when the count exceeds the cap', async () => {
    setCount(150);
    const { result } = renderHook(
      () => useUnreadCount({ config: makeConfig(), userId: 'u1', category: 'user' }),
      { wrapper }
    );

    await waitFor(() => expect(result.current.count).toBe(150));
    expect(result.current.hasMore).toBe(true);
  });
});
