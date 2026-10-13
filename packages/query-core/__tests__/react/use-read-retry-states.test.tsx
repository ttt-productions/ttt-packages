import { describe, it, expect } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider, useQueries } from '@tanstack/react-query';
import React from 'react';
import { useReadRetryStates } from '../../src/react/use-read-retry-state.js';

// Each read's answers are queued per key, so a test decides when each retry resolves or fails.
interface Pending {
  resolve: (value: string) => void;
  reject: (error: Error) => void;
}

function makeReads() {
  const waiting = new Map<string, Pending[]>();
  const read = (key: string) =>
    new Promise<string>((resolve, reject) => {
      const list = waiting.get(key) ?? [];
      list.push({ resolve, reject });
      waiting.set(key, list);
    });
  const next = (key: string) => {
    const entry = (waiting.get(key) ?? []).shift();
    if (!entry) throw new Error(`no read waiting for ${key}`);
    return entry;
  };
  const isWaiting = (key: string) => (waiting.get(key) ?? []).length > 0;
  return { read, next, isWaiting };
}

function makeWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: Infinity, staleTime: 0 } },
  });
  const Wrapper = ({ children }: { children: React.ReactNode }) =>
    React.createElement(QueryClientProvider, { client: queryClient }, children);
  Wrapper.displayName = 'TestWrapper';
  return Wrapper;
}

function renderReads(reads: ReturnType<typeof makeReads>, ids: string[]) {
  return renderHook(
    ({ ids: current }: { ids: string[] }) => {
      const queries = useQueries({
        queries: current.map((id) => ({ queryKey: ['thing', id], queryFn: () => reads.read(id) })),
      });
      const states = useReadRetryStates(
        current.map((id, index) => ({ source: queries[index]!, queryKey: ['thing', id] })),
      );
      return { queries, states };
    },
    { wrapper: makeWrapper(), initialProps: { ids } },
  );
}

async function failBoth(reads: ReturnType<typeof makeReads>, result: { current: ReturnType<typeof renderReads>['result']['current'] }) {
  await waitFor(() => expect(reads.isWaiting('a') && reads.isWaiting('b')).toBe(true));
  const failA = new Error('a failed');
  const failB = new Error('b failed');
  await act(async () => {
    reads.next('a').reject(failA);
    reads.next('b').reject(failB);
  });
  await waitFor(() => expect(result.current.states.map((s) => s.error)).toEqual([failA, failB]));
  return { failA, failB };
}

describe('useReadRetryStates', () => {
  it('reports every first read as loading', () => {
    const reads = makeReads();
    const { result } = renderReads(reads, ['a', 'b']);
    expect(result.current.states).toEqual([
      { error: null, isRetrying: false, isLoading: true },
      { error: null, isRetrying: false, isLoading: true },
    ]);
  });

  it('holds each read\'s own failure through its own retry, and never shows it on another read', async () => {
    const reads = makeReads();
    const { result } = renderReads(reads, ['a', 'b']);
    const { failA, failB } = await failBoth(reads, result);

    act(() => void result.current.queries[0]!.refetch());
    await waitFor(() => expect(result.current.queries[0]!.isFetching).toBe(true));
    expect(result.current.queries[0]!.error).toBeNull();
    expect(result.current.states[0]).toEqual({ error: failA, isRetrying: true, isLoading: false });
    expect(result.current.states[1]).toEqual({ error: failB, isRetrying: false, isLoading: false });
  });

  it('clears only the read whose retry answered', async () => {
    const reads = makeReads();
    const { result } = renderReads(reads, ['a', 'b']);
    const { failB } = await failBoth(reads, result);
    act(() => void result.current.queries[0]!.refetch());
    await waitFor(() => expect(result.current.states[0]!.isRetrying).toBe(true));

    await act(async () => reads.next('a').resolve('answer'));
    await waitFor(() => expect(result.current.queries[0]!.data).toBe('answer'));
    expect(result.current.states[0]).toEqual({ error: null, isRetrying: false, isLoading: false });
    expect(result.current.states[1]).toEqual({ error: failB, isRetrying: false, isLoading: false });
  });

  it('drops a read\'s held failure when it leaves the set, and a read joining it starts as loading', async () => {
    const reads = makeReads();
    const { result, rerender } = renderReads(reads, ['a', 'b']);
    await failBoth(reads, result);
    act(() => void result.current.queries[0]!.refetch());
    await waitFor(() => expect(result.current.states[0]!.isRetrying).toBe(true));

    rerender({ ids: ['c'] });
    expect(result.current.states).toEqual([{ error: null, isRetrying: false, isLoading: true }]);
  });
});
