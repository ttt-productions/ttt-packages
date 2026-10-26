// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { firestoreTestWrapper } from '../../../src/react/testing/firestore-test-wrapper.js';
import { renderHook, act } from '@testing-library/react';

import type { ExecutedClientRead } from '@ttt-productions/firebase-helpers/firestore-client/testing';

const store = await vi.hoisted(async () => {
  const { makeInMemoryClientFirestore } =
    await import('@ttt-productions/firebase-helpers/firestore-client/testing');
  return makeInMemoryClientFirestore();
});

vi.mock(import('firebase/firestore'), async (importOriginal) => {
  const { clientFirestoreFake } = await import('../../../../../test/client-firestore-fake.js');
  return clientFirestoreFake(importOriginal, store);
});

import { useFirestoreSearch } from '../../../src/react/search/use-firestore-search.js';

const DEBOUNCE_MS = 300;

function searchedPrefix(read: ExecutedClientRead): string | undefined {
  const from = read.filters.find((filter) => filter.op === '>=')?.value;
  return from?.t === 'str' ? from.v : undefined;
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
    {
      wrapper: firestoreTestWrapper(store.db).Wrapper,
      initialProps: { text: initialText, on: enabled },
    },
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
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
  store.reset();
  store.seed('people/ada', { name: 'ada' });
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

    store.seed('people/adam', { name: 'adam' });
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
    expect(store.queries()).toEqual([]);
  });

  it('treats a change of case or surrounding spaces as the same search, keeping its answer', async () => {
    const { result, rerender } = renderSearch('ada');
    await settle();

    rerender({ text: ' ADA ', on: true });
    expect(result.current.data).toEqual([{ id: 'ada', name: 'ada' }]);
    expect(result.current.isLoading).toBe(false);
  });

  it("never reports the previous text's failure as the answer for a changed text", async () => {
    store.failReads((read) => searchedPrefix(read) === 'ada');
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
