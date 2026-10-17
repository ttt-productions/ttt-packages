import { describe, it, expect, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';
import {
  MarkUploadActivitySeenError,
  useMarkUploadActivitySeen,
} from '../src/react/use-mark-upload-activity-seen.js';

function makeWrapper() {
  const qc = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
  };
}

const ids = (count: number) => Array.from({ length: count }, (_, i) => `upload-${i + 1}`);

describe('useMarkUploadActivitySeen', () => {
  it('marks every id in calls no larger than the app cap, in order', async () => {
    const markFn = vi.fn().mockResolvedValue(undefined);
    const { result } = renderHook(() => useMarkUploadActivitySeen({ markFn, maxIdsPerCall: 200 }), {
      wrapper: makeWrapper(),
    });
    const all = ids(450);
    await act(() => result.current.mutateAsync(all));
    expect(markFn.mock.calls.map(([batch]) => batch.length)).toEqual([200, 200, 50]);
    expect(markFn.mock.calls.flatMap(([batch]) => batch)).toEqual(all);
  });

  it('sends a set within the cap as one call', async () => {
    const markFn = vi.fn().mockResolvedValue(undefined);
    const { result } = renderHook(() => useMarkUploadActivitySeen({ markFn, maxIdsPerCall: 200 }), {
      wrapper: makeWrapper(),
    });
    await act(() => result.current.mutateAsync(ids(200)));
    expect(markFn).toHaveBeenCalledTimes(1);
  });

  it('makes no call for an empty set', async () => {
    const markFn = vi.fn().mockResolvedValue(undefined);
    const { result } = renderHook(() => useMarkUploadActivitySeen({ markFn, maxIdsPerCall: 200 }), {
      wrapper: makeWrapper(),
    });
    await act(() => result.current.mutateAsync([]));
    expect(markFn).not.toHaveBeenCalled();
  });

  it('a failed call leaves only its own ids unmarked: the rest are still sent, and the mutation fails naming them', async () => {
    const refused = new Error('refused');
    const markFn = vi.fn().mockImplementation(async (batch: string[]) => {
      if (batch[0] === 'upload-3') throw refused;
    });
    const onError = vi.fn();
    const { result } = renderHook(() => useMarkUploadActivitySeen({ markFn, maxIdsPerCall: 2, onError }), {
      wrapper: makeWrapper(),
    });
    let failure: unknown;
    await act(async () => {
      failure = await result.current.mutateAsync(ids(5)).catch((err) => err);
    });
    expect(markFn.mock.calls.map(([batch]) => batch)).toEqual([
      ['upload-1', 'upload-2'],
      ['upload-3', 'upload-4'],
      ['upload-5'],
    ]);
    expect(failure).toBeInstanceOf(MarkUploadActivitySeenError);
    expect((failure as MarkUploadActivitySeenError).unmarkedIds).toEqual(['upload-3', 'upload-4']);
    expect(onError).toHaveBeenCalledTimes(1);
    expect(onError).toHaveBeenCalledWith(refused, ['upload-3', 'upload-4']);
  });

  it('refuses a cap that is not a positive whole number, sending nothing', async () => {
    const markFn = vi.fn().mockResolvedValue(undefined);
    const { result } = renderHook(() => useMarkUploadActivitySeen({ markFn, maxIdsPerCall: 0 }), {
      wrapper: makeWrapper(),
    });
    await act(async () => {
      await expect(result.current.mutateAsync(ids(3))).rejects.toThrow(/maxIdsPerCall/);
    });
    expect(markFn).not.toHaveBeenCalled();
  });
});
