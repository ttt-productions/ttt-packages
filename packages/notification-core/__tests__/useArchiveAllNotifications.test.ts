import { describe, it, expect, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import * as React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import { useArchiveAllNotifications } from '../src/react/hooks/useArchiveAllNotifications';

function makeWrapper() {
  const qc = new QueryClient({ defaultOptions: { mutations: { retry: false }, queries: { retry: false } } });
  const Wrapper = ({ children }: { children: React.ReactNode }) =>
    React.createElement(QueryClientProvider, { client: qc }, children);
  Wrapper.displayName = 'QueryWrapper';
  return Wrapper;
}

describe('useArchiveAllNotifications (I3 client continuation)', () => {
  it('loops archiveAllFn until hasMore is false and sums archived — "Clear All" clears all', async () => {
    // Three server pages: 200 (more), 200 (more), 50 (done).
    const archiveAllFn = vi.fn();
    archiveAllFn
      .mockResolvedValueOnce({ archived: 200, hasMore: true })
      .mockResolvedValueOnce({ archived: 200, hasMore: true })
      .mockResolvedValueOnce({ archived: 50, hasMore: false });

    const { result } = renderHook(
      () => useArchiveAllNotifications({ userId: 'u1', category: 'user', archiveAllFn }),
      { wrapper: makeWrapper() },
    );

    const out = await result.current.mutateAsync();
    expect(archiveAllFn).toHaveBeenCalledTimes(3);
    expect(out).toEqual({ archived: 450, hasMore: false, complete: true });
  });

  it('stops at the per-mutation bound if the server never reports hasMore:false, and reports incomplete (no infinite loop)', async () => {
    const archiveAllFn = vi.fn().mockResolvedValue({ archived: 200, hasMore: true });

    const { result } = renderHook(
      () => useArchiveAllNotifications({ userId: 'u1', category: 'user', archiveAllFn }),
      { wrapper: makeWrapper() },
    );

    const out = await result.current.mutateAsync();
    expect(archiveAllFn).toHaveBeenCalledTimes(25); // MAX_PASSES bound
    expect(out.hasMore).toBe(true);
    // I3: hitting the pass bound with hasMore still true is an EXPLICIT incomplete result.
    expect(out.complete).toBe(false);
  });

  it('no-progress guard: stops immediately when a pass archives 0 yet still reports hasMore (generation-less head livelock)', async () => {
    // A head card the server can never advance past: every pass archives nothing but says hasMore.
    const archiveAllFn = vi.fn().mockResolvedValue({ archived: 0, hasMore: true });

    const { result } = renderHook(
      () => useArchiveAllNotifications({ userId: 'u1', category: 'user', archiveAllFn }),
      { wrapper: makeWrapper() },
    );

    const out = await result.current.mutateAsync();
    // Bails after the FIRST no-progress pass — does NOT livelock to the pass bound.
    expect(archiveAllFn).toHaveBeenCalledTimes(1);
    expect(out).toEqual({ archived: 0, hasMore: true, complete: false });
  });

  it('keeps draining past zero-archive passes that still make forward progress before stalling', async () => {
    // First pass clears a page (progress), second clears nothing but says hasMore (stall) → stop.
    const archiveAllFn = vi.fn();
    archiveAllFn
      .mockResolvedValueOnce({ archived: 100, hasMore: true })
      .mockResolvedValueOnce({ archived: 0, hasMore: true });

    const { result } = renderHook(
      () => useArchiveAllNotifications({ userId: 'u1', category: 'user', archiveAllFn }),
      { wrapper: makeWrapper() },
    );

    const out = await result.current.mutateAsync();
    expect(archiveAllFn).toHaveBeenCalledTimes(2);
    expect(out).toEqual({ archived: 100, hasMore: true, complete: false });
  });
});
