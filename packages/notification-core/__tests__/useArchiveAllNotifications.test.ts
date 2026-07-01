import { describe, it, expect, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import * as React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import { useArchiveAllNotifications } from '../src/react/hooks/useArchiveAllNotifications';
import type { ArchiveAllJobSnapshot } from '../src/types';

function makeWrapper() {
  const qc = new QueryClient({ defaultOptions: { mutations: { retry: false }, queries: { retry: false } } });
  const Wrapper = ({ children }: { children: React.ReactNode }) =>
    React.createElement(QueryClientProvider, { client: qc }, children);
  Wrapper.displayName = 'QueryWrapper';
  return Wrapper;
}

// Fast polls so the guard-bound test doesn't sleep for real.
const FAST = { pollIntervalMs: 1, maxPolls: 5 } as const;

describe('useArchiveAllNotifications (server-owned job status poller)', () => {
  it('enqueues one job scoped to the category and polls until complete', async () => {
    const enqueueArchiveAllFn = vi.fn().mockResolvedValue({ jobId: 'job-1' });
    const getArchiveAllStatusFn = vi.fn<(jobId: string) => Promise<ArchiveAllJobSnapshot>>();
    getArchiveAllStatusFn
      .mockResolvedValueOnce({ state: 'in-progress', category: 'user', archived: 200 })
      .mockResolvedValueOnce({ state: 'in-progress', category: 'user', archived: 400 })
      .mockResolvedValueOnce({ state: 'complete', category: 'user', archived: 450 });

    const { result } = renderHook(
      () =>
        useArchiveAllNotifications({
          userId: 'u1',
          category: 'user',
          enqueueArchiveAllFn,
          getArchiveAllStatusFn,
          ...FAST,
        }),
      { wrapper: makeWrapper() },
    );

    const out = await result.current.mutateAsync();

    // Per-tab scoping: the enqueue carries the category the tray was invoked on.
    expect(enqueueArchiveAllFn).toHaveBeenCalledWith('user');
    // Polls the returned jobId until terminal.
    expect(getArchiveAllStatusFn).toHaveBeenCalledTimes(3);
    expect(getArchiveAllStatusFn).toHaveBeenLastCalledWith('job-1');
    expect(out).toEqual({ status: 'complete', category: 'user', archived: 450, complete: true });
  });

  it('resolves incomplete (not throw) when the job reports an incomplete drain', async () => {
    const enqueueArchiveAllFn = vi.fn().mockResolvedValue({ jobId: 'job-2' });
    const getArchiveAllStatusFn = vi
      .fn<(jobId: string) => Promise<ArchiveAllJobSnapshot>>()
      .mockResolvedValue({ state: 'incomplete', category: 'admin', archived: 12 });

    const { result } = renderHook(
      () =>
        useArchiveAllNotifications({
          userId: 'a1',
          category: 'admin',
          enqueueArchiveAllFn,
          getArchiveAllStatusFn,
          ...FAST,
        }),
      { wrapper: makeWrapper() },
    );

    const out = await result.current.mutateAsync();
    expect(out).toEqual({ status: 'incomplete', category: 'admin', archived: 12, complete: false });
  });

  it('resolves failed (not throw) when the job reports failure, carrying the error', async () => {
    const enqueueArchiveAllFn = vi.fn().mockResolvedValue({ jobId: 'job-3' });
    const getArchiveAllStatusFn = vi
      .fn<(jobId: string) => Promise<ArchiveAllJobSnapshot>>()
      .mockResolvedValue({ state: 'failed', category: 'user', archived: 3, error: 'dead-lettered' });

    const { result } = renderHook(
      () =>
        useArchiveAllNotifications({
          userId: 'u1',
          category: 'user',
          enqueueArchiveAllFn,
          getArchiveAllStatusFn,
          ...FAST,
        }),
      { wrapper: makeWrapper() },
    );

    const out = await result.current.mutateAsync();
    expect(out).toEqual({
      status: 'failed',
      category: 'user',
      archived: 3,
      complete: false,
      error: 'dead-lettered',
    });
  });

  it('gives up as incomplete when the job never terminates within the poll budget (no infinite loop)', async () => {
    const enqueueArchiveAllFn = vi.fn().mockResolvedValue({ jobId: 'job-4' });
    const getArchiveAllStatusFn = vi
      .fn<(jobId: string) => Promise<ArchiveAllJobSnapshot>>()
      .mockResolvedValue({ state: 'in-progress', category: 'user', archived: 7 });

    const { result } = renderHook(
      () =>
        useArchiveAllNotifications({
          userId: 'u1',
          category: 'user',
          enqueueArchiveAllFn,
          getArchiveAllStatusFn,
          ...FAST,
        }),
      { wrapper: makeWrapper() },
    );

    const out = await result.current.mutateAsync();
    expect(getArchiveAllStatusFn).toHaveBeenCalledTimes(FAST.maxPolls);
    expect(out).toEqual({ status: 'incomplete', category: 'user', archived: 7, complete: false });
  });

  it('rejects the mutation when the enqueue adapter throws (hard failure)', async () => {
    const enqueueArchiveAllFn = vi.fn().mockRejectedValue(new Error('enqueue boom'));
    const getArchiveAllStatusFn = vi.fn<(jobId: string) => Promise<ArchiveAllJobSnapshot>>();

    const { result } = renderHook(
      () =>
        useArchiveAllNotifications({
          userId: 'u1',
          category: 'user',
          enqueueArchiveAllFn,
          getArchiveAllStatusFn,
          ...FAST,
        }),
      { wrapper: makeWrapper() },
    );

    await expect(result.current.mutateAsync()).rejects.toThrow('enqueue boom');
    expect(getArchiveAllStatusFn).not.toHaveBeenCalled();
  });
});
