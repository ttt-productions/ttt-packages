import { describe, it, expect, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import * as React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import { useArchiveNotification } from '../src/react/hooks/useArchiveNotification.js';
import type { NotificationArchiveResult, NotificationDoc } from '../src/types.js';

const card: NotificationDoc = {
  id: 'n1',
  type: 'content_report',
  dedupKey: 'dedup1',
  category: 'user',
  targetUserId: 'u1',
  title: 'Title',
  message: 'Message',
  count: 1,
  latestActorIds: [],
  metadata: {},
  seenAt: 0,
  createdAt: 1,
  updatedAt: 1,
};

describe('useArchiveNotification — what an answered archive refreshes', () => {
  it('refreshes the archived list and the unread count, and leaves the live active list to its listener', async () => {
    const qc = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
    const invalidate = vi.spyOn(qc, 'invalidateQueries');
    const Wrapper = ({ children }: { children: React.ReactNode }) =>
      React.createElement(QueryClientProvider, { client: qc }, children);
    Wrapper.displayName = 'QueryWrapper';
    const archiveFn = vi
      .fn<(notification: NotificationDoc) => Promise<NotificationArchiveResult>>()
      .mockResolvedValue({ archived: true });
    const { result } = renderHook(
      () => useArchiveNotification({ userId: 'u1', category: 'user', archiveFn }),
      { wrapper: Wrapper },
    );

    await result.current.mutateAsync(card);

    expect(archiveFn).toHaveBeenCalledWith(card);
    const refreshed = invalidate.mock.calls.map(([filters]) => filters?.queryKey);
    expect(refreshed).toEqual(
      expect.arrayContaining([
        ['notifications', 'history', 'user', 'u1'],
        ['notifications', 'unread-count', 'user', 'u1'],
      ]),
    );
    expect(refreshed.some((key) => key?.[1] === 'active')).toBe(false);
  });
});
