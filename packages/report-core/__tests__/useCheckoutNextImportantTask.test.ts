// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useCheckoutNextImportantTask } from '../src/react/hooks/useCheckoutNextImportantTask.js';
import type { CheckoutNextImportantTaskResult } from '../src/contracts/types-admin-task.js';
import React from 'react';

function makeWrapper(client: QueryClient) {
  return ({ children }: { children: React.ReactNode }) =>
    React.createElement(QueryClientProvider, { client }, children);
}

const answer: CheckoutNextImportantTaskResult = {
  success: true,
  task: {
    id: 't1',
    taskType: 'sample-review',
    taskId: 'item1',
    originalPath: 'items/item1',
    summary: 'mock',
    priority: 3,
    createdAt: 1,
    lastUpdatedAt: 1,
    checkedOutAt: 1,
    expiresAt: 2,
    status: 'checkedOut',
    checkoutDetails: { userId: 'u1', checkedOutAt: 1, expiresAt: 2, workLaterUntil: null },
    itemData: null,
  },
};

describe('useCheckoutNextImportantTask', () => {
  it("runs the app's checkout call once and answers with its claim", async () => {
    const checkoutNextImportantTaskFn = vi.fn().mockResolvedValue(answer);
    const client = new QueryClient({ defaultOptions: { mutations: { retry: false } } });

    const { result } = renderHook(
      () => useCheckoutNextImportantTask({ checkoutNextImportantTaskFn, userId: 'u1' }),
      { wrapper: makeWrapper(client) },
    );

    await expect(result.current.mutateAsync()).resolves.toEqual(answer);
    expect(checkoutNextImportantTaskFn).toHaveBeenCalledTimes(1);
  });

  it('refreshes the admin’s checked-out tasks after a claim', async () => {
    const client = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
    const invalidate = vi.spyOn(client, 'invalidateQueries');

    const { result } = renderHook(
      () => useCheckoutNextImportantTask({ checkoutNextImportantTaskFn: vi.fn().mockResolvedValue(answer), userId: 'u1' }),
      { wrapper: makeWrapper(client) },
    );
    await result.current.mutateAsync();

    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['report-core', 'checkedOutTasks', 'u1'] });
  });
});
