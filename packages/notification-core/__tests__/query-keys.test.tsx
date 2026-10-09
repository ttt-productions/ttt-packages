import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import * as React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const mocks = vi.hoisted(() => ({
  useFirestorePaginated: vi.fn(),
}));

vi.mock('firebase/firestore', () => ({
  orderBy: (field: string, dir: string) => ({ field, dir }),
  where: (field: string, op: string, value: unknown) => ({ field, op, value }),
}));
vi.mock('@ttt-productions/query-core/react', () => ({
  useFirestorePaginated: mocks.useFirestorePaginated,
}));

import { useActiveNotifications } from '../src/react/hooks/useActiveNotifications';
import { useNotificationHistory } from '../src/react/hooks/useNotificationHistory';
import { useArchiveNotification } from '../src/react/hooks/useArchiveNotification';
import { useArchiveAllNotifications } from '../src/react/hooks/useArchiveAllNotifications';
import type { NotificationDoc, NotificationQueryKeys, NotificationSystemConfig } from '../src/types';

const config: NotificationSystemConfig = {
  categories: {
    admin: {
      activePath: 'activeAdminNotifications',
      historyPath: () => 'adminNotificationHistory',
      audienceType: 'shared',
    },
  },
  types: {},
};

const appKeys: NotificationQueryKeys = {
  active: (category, userId) => ['adminNotifications', 'active', category, userId],
  history: (category, userId) => ['adminNotifications', 'history', category, userId],
  unreadCount: (category, userId) => ['adminNotifications', 'unseen', category, userId],
};

function lastPaginatedKey(): unknown {
  return (mocks.useFirestorePaginated.mock.calls.at(-1)![0] as { queryKey: unknown }).queryKey;
}

function clientWrapper() {
  const client = new QueryClient({ defaultOptions: { mutations: { retry: false }, queries: { retry: false } } });
  const invalidated = vi.spyOn(client, 'invalidateQueries');
  const Wrapper = ({ children }: { children: React.ReactNode }) =>
    React.createElement(QueryClientProvider, { client }, children);
  Wrapper.displayName = 'QueryWrapper';
  return { Wrapper, invalidatedKeys: () => invalidated.mock.calls.map(([filters]) => filters?.queryKey) };
}

beforeEach(() => {
  mocks.useFirestorePaginated.mockReset();
  mocks.useFirestorePaginated.mockReturnValue({});
});

describe('the notification hooks read under the app key scope when given one', () => {
  it('the active list reads under the app key, its page size beneath it', () => {
    renderHook(() => useActiveNotifications({ config, userId: 'a1', category: 'admin', pageSize: 10, queryKeys: appKeys }));
    expect(lastPaginatedKey()).toEqual(['adminNotifications', 'active', 'admin', 'a1', { pageSize: 10 }]);
  });

  it('the history list reads under the app key, its page size beneath it', () => {
    renderHook(() => useNotificationHistory({ config, userId: 'a1', category: 'admin', pageSize: 10, queryKeys: appKeys }));
    expect(lastPaginatedKey()).toEqual(['adminNotifications', 'history', 'admin', 'a1', { pageSize: 10 }]);
  });

  it('without a key factory the lists keep the package keys', () => {
    renderHook(() => useActiveNotifications({ config, userId: 'a1', category: 'admin', pageSize: 10 }));
    expect(lastPaginatedKey()).toEqual(['notifications', 'active', 'admin', 'a1', { pageSize: 10 }]);
    renderHook(() => useNotificationHistory({ config, userId: 'a1', category: 'admin', pageSize: 10 }));
    expect(lastPaginatedKey()).toEqual(['notifications', 'history', 'admin', 'a1', { pageSize: 10 }]);
  });

  it('an archive refreshes the three app keys the reads use', async () => {
    const { Wrapper, invalidatedKeys } = clientWrapper();
    const { result } = renderHook(
      () =>
        useArchiveNotification({
          userId: 'a1',
          category: 'admin',
          archiveFn: async () => ({ archived: true }),
          queryKeys: appKeys,
        }),
      { wrapper: Wrapper },
    );
    await result.current.mutateAsync({ id: 'n1' } as NotificationDoc);
    expect(invalidatedKeys()).toEqual([
      ['adminNotifications', 'active', 'admin', 'a1'],
      ['adminNotifications', 'unseen', 'admin', 'a1'],
      ['adminNotifications', 'history', 'admin', 'a1'],
    ]);
  });

  it('an archive-all refreshes the three app keys the reads use', async () => {
    const { Wrapper, invalidatedKeys } = clientWrapper();
    const { result } = renderHook(
      () =>
        useArchiveAllNotifications({
          userId: 'a1',
          category: 'admin',
          enqueueArchiveAllFn: async () => ({ jobId: 'j1' }),
          getArchiveAllStatusFn: async () => ({ state: 'complete', category: 'admin', archived: 1 }),
          queryKeys: appKeys,
        }),
      { wrapper: Wrapper },
    );
    await result.current.mutateAsync();
    expect(invalidatedKeys()).toEqual([
      ['adminNotifications', 'active', 'admin', 'a1'],
      ['adminNotifications', 'unseen', 'admin', 'a1'],
      ['adminNotifications', 'history', 'admin', 'a1'],
    ]);
  });

  it('without a key factory an archive refreshes the package keys', async () => {
    const { Wrapper, invalidatedKeys } = clientWrapper();
    const { result } = renderHook(
      () => useArchiveNotification({ userId: 'u1', category: 'user', archiveFn: async () => ({ archived: true }) }),
      { wrapper: Wrapper },
    );
    await result.current.mutateAsync({ id: 'n1' } as NotificationDoc);
    expect(invalidatedKeys()).toEqual([
      ['notifications', 'active', 'user', 'u1'],
      ['notifications', 'unread-count', 'user', 'u1'],
      ['notifications', 'history', 'user', 'u1'],
    ]);
  });
});
