import { describe, it, expect, vi } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider, useMutationState } from '@tanstack/react-query';
import React from 'react';
import { useClearUploadActivity } from '../src/react/use-clear-upload-activity.js';

function makeClient() {
  return new QueryClient({ defaultOptions: { mutations: { retry: false } } });
}

function makeWrapper(qc: QueryClient = makeClient()) {
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
  };
}

function deferredVoid() {
  let resolve!: () => void;
  const promise = new Promise<void>((res) => {
    resolve = res;
  });
  return { promise, resolve };
}

const CLEAR_KEY = ['upload-activity', 'clear'] as const;

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

  it('exposes mutateAsync, resolving when clearFn resolves', async () => {
    const clearFn = vi.fn().mockResolvedValue(undefined);
    const { result } = renderHook(() => useClearUploadActivity({ clearFn }), { wrapper: makeWrapper() });
    await act(async () => {
      await expect(result.current.mutateAsync('doc-2')).resolves.toBeUndefined();
    });
    expect(clearFn).toHaveBeenCalledTimes(1);
    expect(clearFn.mock.calls[0][0]).toBe('doc-2');
  });

  it('registers the mutation in the MutationCache under the supplied mutationKey', async () => {
    const qc = makeClient();
    const gate = deferredVoid();
    const clearFn = vi.fn(() => gate.promise);

    const { result } = renderHook(
      () => ({
        clear: useClearUploadActivity({ clearFn, mutationKey: [...CLEAR_KEY] }),
        pendingIds: useMutationState({
          filters: { mutationKey: [...CLEAR_KEY], status: 'pending' },
          select: (mutation) => mutation.state.variables as string,
        }),
      }),
      { wrapper: makeWrapper(qc) },
    );

    act(() => {
      result.current.clear.mutate('doc-3');
    });

    await waitFor(() => expect(result.current.pendingIds).toEqual(['doc-3']));
    const cached = qc.getMutationCache().findAll({ mutationKey: [...CLEAR_KEY] });
    expect(cached).toHaveLength(1);
    expect(cached[0].options.mutationKey).toEqual([...CLEAR_KEY]);

    await act(async () => {
      gate.resolve();
    });
    await waitFor(() => expect(result.current.pendingIds).toEqual([]));
  });

  it('leaves the mutation unkeyed when no mutationKey is supplied', async () => {
    const qc = makeClient();
    const gate = deferredVoid();
    const clearFn = vi.fn(() => gate.promise);
    const { result } = renderHook(() => useClearUploadActivity({ clearFn }), { wrapper: makeWrapper(qc) });

    act(() => {
      result.current.mutate('doc-4');
    });
    await waitFor(() => expect(qc.getMutationCache().getAll()).toHaveLength(1));
    expect(qc.getMutationCache().getAll()[0].options.mutationKey).toBeUndefined();
    expect(qc.getMutationCache().findAll({ mutationKey: [...CLEAR_KEY] })).toHaveLength(0);

    await act(async () => {
      gate.resolve();
    });
  });
});
