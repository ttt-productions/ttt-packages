import { describe, it, expect, afterEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider, onlineManager, useQuery } from '@tanstack/react-query';
import React from 'react';
import { useReadRetryState, type ReadRetryState } from '../../src/react/use-read-retry-state.js';

// Each read's answers are queued per key, so a test decides when a retry resolves or fails.
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
    const list = waiting.get(key) ?? [];
    const entry = list.shift();
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

function renderRead(reads: ReturnType<typeof makeReads>, initialKey = 'a') {
  return renderHook(
    ({ id }: { id: string }) => {
      const queryKey = ['thing', id];
      const query = useQuery({ queryKey, queryFn: () => reads.read(id) });
      return { query, state: useReadRetryState(query, queryKey) };
    },
    { wrapper: makeWrapper(), initialProps: { id: initialKey } },
  );
}

async function failFirstRead(
  reads: ReturnType<typeof makeReads>,
  result: { current: { state: ReadRetryState } },
) {
  await waitFor(() => expect(reads.isWaiting('a')).toBe(true));
  const failure = new Error('first read failed');
  await act(async () => reads.next('a').reject(failure));
  await waitFor(() => expect(result.current.state.error).toBe(failure));
  return failure;
}

afterEach(() => {
  onlineManager.setOnline(true);
});

describe('useReadRetryState', () => {
  it('reports a first read as loading, not as a retry', async () => {
    const reads = makeReads();
    const { result } = renderRead(reads);
    expect(result.current.state).toEqual({ error: null, isRetrying: false, isLoading: true });
  });

  it('reports a failed first read as failed and not retrying', async () => {
    const reads = makeReads();
    const { result } = renderRead(reads);
    const failure = await failFirstRead(reads, result);
    expect(result.current.state).toEqual({ error: failure, isRetrying: false, isLoading: false });
  });

  it('keeps the failure on screen and reports the retry as running while a retry of a failed first read runs', async () => {
    const reads = makeReads();
    const { result } = renderRead(reads);
    const failure = await failFirstRead(reads, result);

    act(() => void result.current.query.refetch());
    await waitFor(() => expect(result.current.query.isFetching).toBe(true));
    // The query itself has dropped its failure and gone back to pending under the retry.
    expect(result.current.query.error).toBeNull();
    expect(result.current.query.isPending).toBe(true);
    expect(result.current.state).toEqual({ error: failure, isRetrying: true, isLoading: false });
  });

  it('clears the failure once the retry answers', async () => {
    const reads = makeReads();
    const { result } = renderRead(reads);
    await failFirstRead(reads, result);
    act(() => void result.current.query.refetch());
    await waitFor(() => expect(result.current.state.isRetrying).toBe(true));

    await act(async () => reads.next('a').resolve('answer'));
    await waitFor(() => expect(result.current.query.data).toBe('answer'));
    expect(result.current.state).toEqual({ error: null, isRetrying: false, isLoading: false });
  });

  it('shows the new failure once the retry fails again', async () => {
    const reads = makeReads();
    const { result } = renderRead(reads);
    await failFirstRead(reads, result);
    act(() => void result.current.query.refetch());
    await waitFor(() => expect(result.current.state.isRetrying).toBe(true));

    const second = new Error('retry failed');
    await act(async () => reads.next('a').reject(second));
    await waitFor(() => expect(result.current.state).toEqual({ error: second, isRetrying: false, isLoading: false }));
  });

  it('keeps the failure and the running retry while a retry waits for the network', async () => {
    const reads = makeReads();
    const { result } = renderRead(reads);
    const failure = await failFirstRead(reads, result);

    act(() => onlineManager.setOnline(false));
    act(() => void result.current.query.refetch());
    await waitFor(() => expect(result.current.query.isPaused).toBe(true));
    expect(result.current.query.isFetching).toBe(false);
    expect(result.current.state).toEqual({ error: failure, isRetrying: true, isLoading: false });
  });

  it('reports a retry of a failed refetch, whose data the query kept, as running', async () => {
    const reads = makeReads();
    const { result } = renderRead(reads);
    await waitFor(() => expect(reads.isWaiting('a')).toBe(true));
    await act(async () => reads.next('a').resolve('answer'));
    await waitFor(() => expect(result.current.query.data).toBe('answer'));

    act(() => void result.current.query.refetch());
    const failure = new Error('refetch failed');
    await waitFor(() => expect(reads.isWaiting('a')).toBe(true));
    await act(async () => reads.next('a').reject(failure));
    await waitFor(() => expect(result.current.state.error).toBe(failure));

    act(() => void result.current.query.refetch());
    await waitFor(() => expect(result.current.state).toEqual({ error: failure, isRetrying: true, isLoading: false }));
  });

  it('never reports a refetch of a read that has not failed as a retry', async () => {
    const reads = makeReads();
    const { result } = renderRead(reads);
    await waitFor(() => expect(reads.isWaiting('a')).toBe(true));
    await act(async () => reads.next('a').resolve('answer'));
    await waitFor(() => expect(result.current.query.data).toBe('answer'));

    act(() => void result.current.query.refetch());
    await waitFor(() => expect(result.current.query.isFetching).toBe(true));
    expect(result.current.state).toEqual({ error: null, isRetrying: false, isLoading: false });
  });

  it('never shows one key’s failure on a read under another key', async () => {
    const reads = makeReads();
    const { result, rerender } = renderRead(reads);
    await failFirstRead(reads, result);

    rerender({ id: 'b' });
    await waitFor(() => expect(result.current.query.isFetching).toBe(true));
    expect(result.current.state).toEqual({ error: null, isRetrying: false, isLoading: true });
  });
});
