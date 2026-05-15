// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useCheckoutNextImportantTask } from '../src/hooks/useCheckoutNextImportantTask.js';
import React from 'react';

function makeWrapper() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return ({ children }: { children: React.ReactNode }) =>
    React.createElement(QueryClientProvider, { client }, children);
}

describe('useCheckoutNextImportantTask', () => {
  it('calls callFunction with an empty object, never undefined', async () => {
    const callFunction = vi.fn().mockResolvedValue({
      success: true,
      task: { id: 't1', type: 'libraryReview', summary: 'mock' },
    });

    const { result } = renderHook(
      () => useCheckoutNextImportantTask({ callFunction, userId: 'u1' }),
      { wrapper: makeWrapper() }
    );

    await result.current.mutateAsync();

    await waitFor(() => expect(callFunction).toHaveBeenCalledTimes(1));

    // Critical: second arg must be {} not undefined. undefined serializes to null
    // over the Firebase callable wire and the server's z.object({}).strict() rejects it.
    expect(callFunction).toHaveBeenCalledWith('checkoutNextImportantTask', {});
    const callArgs = callFunction.mock.calls[0];
    expect(callArgs[1]).not.toBeUndefined();
    expect(callArgs[1]).toEqual({});
  });
});
