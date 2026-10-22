// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';
import {
  MutationSessionEndedError,
  MutationSessionProvider,
} from '@ttt-productions/query-core/react';
import { useCheckoutTask } from '../src/react/hooks/useCheckoutTask.js';
import { useCheckinTask } from '../src/react/hooks/useCheckinTask.js';
import { useReleaseTask } from '../src/react/hooks/useReleaseTask.js';
import { useWorkLater } from '../src/react/hooks/useWorkLater.js';
import type { CheckoutTaskResult } from '../src/contracts/types-admin-task.js';

function wrapper({ children }: { children: React.ReactNode }) {
  const client = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
  return React.createElement(QueryClientProvider, { client }, children);
}

const lifecycle = { success: true as const };

describe('the admin queue hooks', () => {
  it("check out through the app's checkout call", async () => {
    const claim = { success: true, alreadyHeld: true } as CheckoutTaskResult;
    const checkoutTaskFn = vi.fn().mockResolvedValue(claim);
    const { result } = renderHook(() => useCheckoutTask({ checkoutTaskFn, userId: 'u1' }), {
      wrapper,
    });

    await expect(result.current.mutateAsync({ taskType: 'userReport' })).resolves.toBe(claim);
    expect(checkoutTaskFn).toHaveBeenCalledWith({ taskType: 'userReport' });
  });

  it("check in through the app's check-in call", async () => {
    const checkinTaskFn = vi.fn().mockResolvedValue({ success: true, alreadyResolved: true });
    const { result } = renderHook(() => useCheckinTask({ checkinTaskFn, userId: 'u1' }), {
      wrapper,
    });

    await expect(result.current.mutateAsync({ taskId: 't1', resolved: true })).resolves.toEqual({
      success: true,
      alreadyResolved: true,
    });
    expect(checkinTaskFn).toHaveBeenCalledWith({ taskId: 't1', resolved: true });
  });

  it("release through the app's release call", async () => {
    const releaseTaskFn = vi.fn().mockResolvedValue(lifecycle);
    const { result } = renderHook(() => useReleaseTask({ releaseTaskFn, userId: 'u1' }), {
      wrapper,
    });

    await expect(result.current.mutateAsync({ taskId: 't1' })).resolves.toBe(lifecycle);
    expect(releaseTaskFn).toHaveBeenCalledWith({ taskId: 't1' });
  });

  it("mark work-later through the app's work-later call", async () => {
    const markWorkLaterFn = vi.fn().mockResolvedValue(lifecycle);
    const { result } = renderHook(() => useWorkLater({ markWorkLaterFn, userId: 'u1' }), {
      wrapper,
    });

    await expect(result.current.mutateAsync({ taskId: 't1', extendHours: 24 })).resolves.toBe(
      lifecycle,
    );
    expect(markWorkLaterFn).toHaveBeenCalledWith({ taskId: 't1', extendHours: 24 });
  });
});

describe('the admin queue hooks after the admin who acted signed out', () => {
  it('refresh nothing for the next session when the answer lands after the session ended', async () => {
    let answer!: (result: typeof lifecycle) => void;
    const releaseTaskFn = vi.fn(
      () =>
        new Promise<typeof lifecycle>((resolve) => {
          answer = resolve;
        }),
    );
    const client = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
    const invalidate = vi.spyOn(client, 'invalidateQueries');
    const session = { uid: 'u1' as string | null };
    function SessionWrapper({ children }: { children: React.ReactNode }) {
      return React.createElement(
        QueryClientProvider,
        { client },
        React.createElement(MutationSessionProvider, { currentUid: session.uid }, children),
      );
    }
    const { result, rerender } = renderHook(() => useReleaseTask({ releaseTaskFn, userId: 'u1' }), {
      wrapper: SessionWrapper,
    });

    let request!: Promise<unknown>;
    act(() => {
      request = result.current.mutateAsync({ taskId: 't1' });
    });
    await waitFor(() => expect(releaseTaskFn).toHaveBeenCalledTimes(1));
    session.uid = null;
    rerender();
    await act(async () => {
      answer(lifecycle);
      await expect(request).rejects.toBeInstanceOf(MutationSessionEndedError);
    });

    expect(invalidate).not.toHaveBeenCalled();
  });
});
