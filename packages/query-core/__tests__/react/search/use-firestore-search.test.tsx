// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';

const { getDocsMock } = vi.hoisted(() => ({ getDocsMock: vi.fn() }));

vi.mock('firebase/firestore', () => ({
  collection: (_db: unknown, path: string) => ({ __path: path }),
  query: (ref: unknown, ...constraints: unknown[]) => ({ __ref: ref, __constraints: constraints }),
  where: (field: string, op: string, value: unknown) => ({ field, op, value }),
  orderBy: (field: string, dir: string) => ({ orderBy: field, dir }),
  limit: (n: number) => ({ limit: n }),
  getDocs: getDocsMock,
}));

import { useFirestoreSearch } from '../../../src/react/search/use-firestore-search.js';
import { FirestoreProvider } from '../../../src/react/firestore/context.js';

const DEBOUNCE_MS = 300;

function makeWrapper() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const Wrapper = ({ children }: { children: React.ReactNode }) =>
    React.createElement(
      QueryClientProvider,
      { client: queryClient },
      React.createElement(FirestoreProvider, { db: {} as never, children }),
    );
  Wrapper.displayName = 'TestWrapper';
  return Wrapper;
}

// The prefix read answers with one row named after the searched text.
function answerWithSearchedText() {
  getDocsMock.mockImplementation(async (q: { __constraints: Array<{ op?: string; value?: unknown }> }) => {
    const prefix = q.__constraints.find((c) => c.op === '>=')?.value as string;
    return { docs: [{ id: prefix, data: () => ({ name: prefix }) }] };
  });
}

function renderSearch(initialText: string, enabled = true) {
  return renderHook(
    ({ text, on }: { text: string; on: boolean }) =>
      useFirestoreSearch<{ name: string }>({
        collectionPath: 'people',
        searchField: 'name',
        queryText: text,
        enabled: on,
        debounceMs: DEBOUNCE_MS,
      }),
    { wrapper: makeWrapper(), initialProps: { text: initialText, on: enabled } },
  );
}

async function settle() {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(DEBOUNCE_MS);
  });
  await act(async () => {
    await vi.runOnlyPendingTimersAsync();
  });
}

beforeEach(() => {
  vi.useFakeTimers();
  getDocsMock.mockReset();
  answerWithSearchedText();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('useFirestoreSearch reports no answer until the debounce catches up', () => {
  it('reads as searching, with no data, while a first search waits out the debounce', async () => {
    const { result, rerender } = renderSearch('');
    rerender({ text: 'ada', on: true });
    expect(result.current.data).toBeUndefined();
    expect(result.current.isLoading).toBe(true);
    expect(result.current.isSuccess).toBe(false);

    await settle();
    expect(result.current.data).toEqual([{ id: 'ada', name: 'ada' }]);
    expect(result.current.isLoading).toBe(false);
  });

  it("never reports the previous text's results as the answer for a changed text", async () => {
    const { result, rerender } = renderSearch('ada');
    await settle();
    expect(result.current.data).toEqual([{ id: 'ada', name: 'ada' }]);

    rerender({ text: 'adam', on: true });
    expect(result.current.data).toBeUndefined();
    expect(result.current.isLoading).toBe(true);

    await settle();
    expect(result.current.data).toEqual([{ id: 'adam', name: 'adam' }]);
  });

  it('is idle, with no data, while a text too short to search waits out the debounce', async () => {
    const { result, rerender } = renderSearch('ada');
    await settle();

    rerender({ text: 'ad', on: true });
    expect(result.current.data).toBeUndefined();
    expect(result.current.isLoading).toBe(false);
  });

  it('counts the trimmed text, so a short text padded with spaces never searches', async () => {
    const { result, rerender } = renderSearch('');
    rerender({ text: 'ad ', on: true });
    expect(result.current.isLoading).toBe(false);
    await settle();
    expect(result.current.isLoading).toBe(false);
    expect(getDocsMock).not.toHaveBeenCalled();
  });

  it('treats a change of case or surrounding spaces as the same search, keeping its answer', async () => {
    const { result, rerender } = renderSearch('ada');
    await settle();

    rerender({ text: ' ADA ', on: true });
    expect(result.current.data).toEqual([{ id: 'ada', name: 'ada' }]);
    expect(result.current.isLoading).toBe(false);
  });

  it("never reports the previous text's failure as the answer for a changed text", async () => {
    getDocsMock.mockRejectedValueOnce(new Error('denied'));
    const { result, rerender } = renderSearch('ada');
    await settle();
    expect(result.current.isError).toBe(true);

    rerender({ text: 'adam', on: true });
    expect(result.current.error).toBeNull();
    expect(result.current.isError).toBe(false);
    expect(result.current.isLoading).toBe(true);
  });

  it('is idle, not searching, while a disabled search waits out the debounce', async () => {
    const { result, rerender } = renderSearch('ada', false);
    rerender({ text: 'adam', on: false });
    expect(result.current.data).toBeUndefined();
    expect(result.current.isLoading).toBe(false);
    expect(result.current.fetchStatus).toBe('idle');
  });

  it('keeps the query handles while it reports no answer', async () => {
    const { result, rerender } = renderSearch('ada');
    await settle();
    rerender({ text: 'adam', on: true });
    expect(typeof result.current.refetch).toBe('function');
    expect({ ...result.current }.data).toBeUndefined();
  });
});
