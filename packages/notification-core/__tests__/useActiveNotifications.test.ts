import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook } from '@testing-library/react';

const mocks = vi.hoisted(() => ({
  useFirestorePaginated: vi.fn(),
}));

vi.mock('firebase/firestore', () => ({
  orderBy: (field: string, dir: string) => ({ field, dir }),
  where: (field: string, op: string, value: unknown) => ({ field, op, value }),
}));
vi.mock('@ttt-productions/query-core/react', async (importOriginal) => ({
  useFirestorePaginated: mocks.useFirestorePaginated,
  useReadRetryState: (await importOriginal<typeof import('@ttt-productions/query-core/react')>()).useReadRetryState,
}));

import { useActiveNotifications } from '../src/react/hooks/useActiveNotifications';
import type { NotificationSystemConfig } from '../src/types';

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

function lastOpts(): Record<string, unknown> {
  return mocks.useFirestorePaginated.mock.calls.at(-1)![0] as Record<string, unknown>;
}

beforeEach(() => {
  mocks.useFirestorePaginated.mockReset();
  mocks.useFirestorePaginated.mockReturnValue({});
});

describe('useActiveNotifications', () => {
  it('polls the displayed page on the 30s default interval', () => {
    renderHook(() => useActiveNotifications({ config, userId: 'u1', category: 'user' }));
    expect(lastOpts().refetchInterval).toBe(30_000);
  });

  it("holds a failed page's failure through its retry, and never carries it onto another page", () => {
    const failure = new Error('unavailable');
    mocks.useFirestorePaginated.mockReturnValue({ page: 1, error: failure, isFetching: false, isLoading: false });
    const { result, rerender } = renderHook(() => useActiveNotifications({ config, userId: 'u1', category: 'user' }));
    expect(result.current.retryState).toEqual({ error: failure, isRetrying: false, isLoading: false });

    // The retry of a never-succeeded page: TanStack clears the error and reports loading.
    mocks.useFirestorePaginated.mockReturnValue({ page: 1, error: null, isFetching: true, isLoading: true });
    rerender();
    expect(result.current.retryState).toEqual({ error: failure, isRetrying: true, isLoading: false });

    // Another page is another read: its loading is loading, not the first page's failure.
    mocks.useFirestorePaginated.mockReturnValue({ page: 2, error: null, isFetching: true, isLoading: true });
    rerender();
    expect(result.current.retryState).toEqual({ error: null, isRetrying: false, isLoading: true });
  });

  it('forwards the poll interval and the stale time as two separate settings', () => {
    renderHook(() =>
      useActiveNotifications({
        config,
        userId: 'u1',
        category: 'user',
        refetchInterval: 10_000,
        staleTime: 2_000,
      }),
    );
    expect(lastOpts().refetchInterval).toBe(10_000);
    expect(lastOpts().staleTime).toBe(2_000);
  });
});
