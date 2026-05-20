import { describe, it, expect, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';
import { useClearUploadActivity } from '../src/react/use-clear-upload-activity.js';

function makeWrapper() {
  const qc = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
  };
}

describe('useClearUploadActivity', () => {
  it('calls clearFn with the pendingMediaId', async () => {
    const clearFn = vi.fn().mockResolvedValue(undefined);
    const { result } = renderHook(() => useClearUploadActivity({ clearFn }), { wrapper: makeWrapper() });
    result.current.mutate('doc-1');
    await waitFor(() => expect(clearFn).toHaveBeenCalled());
    expect(clearFn.mock.calls[0][0]).toBe('doc-1');
  });

  it('invokes onError on rejection', async () => {
    const clearFn = vi.fn().mockRejectedValue(new Error('boom'));
    const onError = vi.fn();
    const { result } = renderHook(() => useClearUploadActivity({ clearFn, onError }), { wrapper: makeWrapper() });
    result.current.mutate('doc-1');
    await waitFor(() => expect(onError).toHaveBeenCalled());
    expect(onError.mock.calls[0][0]).toBeInstanceOf(Error);
    expect(onError.mock.calls[0][1]).toBe('doc-1');
  });
});
