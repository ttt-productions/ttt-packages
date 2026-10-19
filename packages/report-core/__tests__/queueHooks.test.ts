// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';
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

// Each queue hook hands its input to the app's own typed call and answers with what that call
// answered: no callable name and no transport live in the package.
describe('the admin queue hooks', () => {
  it("check out through the app's checkout call", async () => {
    const claim = { success: true, alreadyHeld: true } as CheckoutTaskResult;
    const checkoutTaskFn = vi.fn().mockResolvedValue(claim);
    const { result } = renderHook(() => useCheckoutTask({ checkoutTaskFn, userId: 'u1' }), { wrapper });

    await expect(result.current.mutateAsync({ taskType: 'userReport' })).resolves.toBe(claim);
    expect(checkoutTaskFn).toHaveBeenCalledWith({ taskType: 'userReport' });
  });

  it("check in through the app's check-in call", async () => {
    const checkinTaskFn = vi.fn().mockResolvedValue({ success: true, alreadyResolved: true });
    const { result } = renderHook(() => useCheckinTask({ checkinTaskFn, userId: 'u1' }), { wrapper });

    await expect(result.current.mutateAsync({ taskId: 't1', resolved: true })).resolves.toEqual({
      success: true,
      alreadyResolved: true,
    });
    expect(checkinTaskFn).toHaveBeenCalledWith({ taskId: 't1', resolved: true });
  });

  it("release through the app's release call", async () => {
    const releaseTaskFn = vi.fn().mockResolvedValue(lifecycle);
    const { result } = renderHook(() => useReleaseTask({ releaseTaskFn, userId: 'u1' }), { wrapper });

    await expect(result.current.mutateAsync({ taskId: 't1' })).resolves.toBe(lifecycle);
    expect(releaseTaskFn).toHaveBeenCalledWith({ taskId: 't1' });
  });

  it("mark work-later through the app's work-later call", async () => {
    const markWorkLaterFn = vi.fn().mockResolvedValue(lifecycle);
    const { result } = renderHook(() => useWorkLater({ markWorkLaterFn, userId: 'u1' }), { wrapper });

    await expect(result.current.mutateAsync({ taskId: 't1', extendHours: 24 })).resolves.toBe(lifecycle);
    expect(markWorkLaterFn).toHaveBeenCalledWith({ taskId: 't1', extendHours: 24 });
  });
});
