// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { firestoreTestWrapper } from '../src/react/testing/firestore-test-wrapper.js';
import { renderHook, act, waitFor } from '@testing-library/react';
import { QueryClient } from '@tanstack/react-query';

const store = await vi.hoisted(async () => {
  const { makeInMemoryClientFirestore } =
    await import('@ttt-productions/firebase-helpers/firestore-client/testing');
  return makeInMemoryClientFirestore();
});

vi.mock(import('firebase/firestore'), async (importOriginal) => {
  const { clientFirestoreFake } = await import('../../../test/client-firestore-fake.js');
  return clientFirestoreFake(importOriginal, store);
});

import { orderBy } from 'firebase/firestore';
import { useFirestorePaginated } from '../src/react/firestore/use-firestore-paginated.js';
import {
  mapPaginatedItems,
  paginatedPageKey,
  prependToFirstPaginatedPage,
} from '../src/react/cache-helpers.js';

function seedRows(ids: string[]) {
  store.reset();
  ids.forEach((id, rank) => store.seed(`items/${id}`, { n: id, rank }));
}
function prependRow(id: string) {
  store.seed(`items/${id}`, { n: id, rank: -store.paths('items/').length });
}
const reads = () => store.queries().length;

function makeClient() {
  return new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } });
}
function ids(data: Array<{ id: string }> | undefined) {
  return (data ?? []).map((d) => d.id);
}

const base = {
  collectionPath: 'items',
  queryKey: ['items', { pageSize: 3 }],
  constraints: [orderBy('rank')],
  pageSize: 3,
};

beforeEach(() => {
  seedRows(['a', 'b', 'c', 'd', 'e', 'f', 'g']);
});

afterEach(() => {
  vi.useRealTimers();
});

describe('useFirestorePaginated', () => {
  it('reports no next page when the displayed page exactly fills and nothing follows', async () => {
    seedRows(['a', 'b', 'c']);
    const { result } = renderHook(() => useFirestorePaginated(base), {
      wrapper: firestoreTestWrapper(store.db, { queryClient: makeClient() }).Wrapper,
    });
    await waitFor(() => expect(ids(result.current.data)).toEqual(['a', 'b', 'c']));
    expect(result.current.hasNextPage).toBe(false);
  });

  it('keeps Next available on an earlier page after visiting a short last page', async () => {
    const { result } = renderHook(() => useFirestorePaginated(base), {
      wrapper: firestoreTestWrapper(store.db, { queryClient: makeClient() }).Wrapper,
    });
    await waitFor(() => expect(ids(result.current.data)).toEqual(['a', 'b', 'c']));
    expect(result.current.hasNextPage).toBe(true);

    act(() => result.current.nextPage());
    await waitFor(() => expect(ids(result.current.data)).toEqual(['d', 'e', 'f']));
    act(() => result.current.nextPage());
    await waitFor(() => expect(ids(result.current.data)).toEqual(['g']));
    expect(result.current.hasNextPage).toBe(false);

    act(() => result.current.prevPage());
    await waitFor(() => expect(result.current.page).toBe(2));
    expect(ids(result.current.data)).toEqual(['d', 'e', 'f']);
    expect(result.current.hasNextPage).toBe(true);
  });

  it('does not move past the last page', async () => {
    seedRows(['a', 'b']);
    const { result } = renderHook(() => useFirestorePaginated(base), {
      wrapper: firestoreTestWrapper(store.db, { queryClient: makeClient() }).Wrapper,
    });
    await waitFor(() => expect(ids(result.current.data)).toEqual(['a', 'b']));
    act(() => result.current.nextPage());
    expect(result.current.page).toBe(1);
  });

  it('starts a page after the previous page cached under the same key, shared by every instance', async () => {
    const client = makeClient();
    const first = renderHook(() => useFirestorePaginated(base), {
      wrapper: firestoreTestWrapper(store.db, { queryClient: client }).Wrapper,
    });
    await waitFor(() => expect(ids(first.result.current.data)).toEqual(['a', 'b', 'c']));
    const callsBefore = reads();

    const second = renderHook(() => useFirestorePaginated({ ...base, initialPage: 2 }), {
      wrapper: firestoreTestWrapper(store.db, { queryClient: client }).Wrapper,
    });
    await waitFor(() => expect(ids(second.result.current.data)).toEqual(['d', 'e', 'f']));
    expect(reads()).toBe(callsBefore + 1);
  });

  it('re-reads the page chain when a previous page is no longer cached', async () => {
    const client = makeClient();
    const { result } = renderHook(() => useFirestorePaginated(base), {
      wrapper: firestoreTestWrapper(store.db, { queryClient: client }).Wrapper,
    });
    await waitFor(() => expect(result.current.hasNextPage).toBe(true));
    act(() => result.current.nextPage());
    await waitFor(() => expect(ids(result.current.data)).toEqual(['d', 'e', 'f']));

    client.removeQueries({ queryKey: paginatedPageKey(base.queryKey, 1), exact: true });
    prependRow('z');
    const callsBefore = reads();
    await act(async () => {
      await result.current.refetch();
    });
    expect(reads()).toBe(callsBefore + 2);
    await waitFor(() => expect(ids(result.current.data)).toEqual(['c', 'd', 'e']));
  });

  it('shows page 1 of a new query identity in its first render', async () => {
    const seen: Array<{ owner: string; page: number }> = [];
    const { result, rerender } = renderHook(
      ({ owner }: { owner: string }) => {
        const r = useFirestorePaginated({ ...base, queryKey: ['items', owner, { pageSize: 3 }] });
        seen.push({ owner, page: r.page });
        return r;
      },
      {
        wrapper: firestoreTestWrapper(store.db, { queryClient: makeClient() }).Wrapper,
        initialProps: { owner: 'u1' },
      },
    );
    await waitFor(() => expect(result.current.hasNextPage).toBe(true));
    act(() => result.current.nextPage());
    await waitFor(() => expect(result.current.page).toBe(2));

    rerender({ owner: 'u2' });
    const u2Pages = seen.filter((s) => s.owner === 'u2').map((s) => s.page);
    expect(u2Pages.every((p) => p === 1)).toBe(true);
  });

  it('re-reads the displayed page on its refetch interval', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const { result } = renderHook(
      () => useFirestorePaginated({ ...base, refetchInterval: 30_000 }),
      {
        wrapper: firestoreTestWrapper(store.db, { queryClient: makeClient() }).Wrapper,
      },
    );
    await waitFor(() => expect(ids(result.current.data)).toEqual(['a', 'b', 'c']));
    const callsBefore = reads();
    prependRow('new');
    await act(async () => {
      await vi.advanceTimersByTimeAsync(30_000);
    });
    await waitFor(() => expect(ids(result.current.data)).toEqual(['new', 'a', 'b']));
    expect(reads()).toBeGreaterThan(callsBefore);
  });
});

describe('a page re-read moves where the next page starts', () => {
  const fresh = { ...base, staleTime: Infinity };

  it('re-reads a cached later page whose start no longer follows the re-read earlier page', async () => {
    const { result } = renderHook(() => useFirestorePaginated(fresh), {
      wrapper: firestoreTestWrapper(store.db, { queryClient: makeClient() }).Wrapper,
    });
    await waitFor(() => expect(result.current.hasNextPage).toBe(true));
    act(() => result.current.nextPage());
    await waitFor(() => expect(ids(result.current.data)).toEqual(['d', 'e', 'f']));

    prependRow('z');
    act(() => result.current.prevPage());
    await act(async () => {
      await result.current.refetch();
    });
    await waitFor(() => expect(ids(result.current.data)).toEqual(['z', 'a', 'b']));

    act(() => result.current.nextPage());
    await waitFor(() => expect(ids(result.current.data)).toEqual(['c', 'd', 'e']));
  });

  it('keeps the chain after a prepend once page 1 is read again', async () => {
    const client = makeClient();
    const { result } = renderHook(() => useFirestorePaginated(fresh), {
      wrapper: firestoreTestWrapper(store.db, { queryClient: client }).Wrapper,
    });
    await waitFor(() => expect(result.current.hasNextPage).toBe(true));
    act(() => result.current.nextPage());
    await waitFor(() => expect(ids(result.current.data)).toEqual(['d', 'e', 'f']));
    act(() => result.current.prevPage());
    await waitFor(() => expect(result.current.page).toBe(1));

    prependRow('new');
    act(() => prependToFirstPaginatedPage(client, fresh.queryKey, { id: 'new', n: 'new' }));
    await act(async () => {
      await result.current.refetch();
    });
    await waitFor(() => expect(ids(result.current.data)).toEqual(['new', 'a', 'b']));

    act(() => result.current.nextPage());
    await waitFor(() => expect(ids(result.current.data)).toEqual(['c', 'd', 'e']));
  });
});

describe('paginated cache updaters', () => {
  it('patches a row on every cached page and the hook renders the patch', async () => {
    const client = makeClient();
    const { result } = renderHook(
      () => useFirestorePaginated<{ n: string; liked?: boolean }>(base),
      { wrapper: firestoreTestWrapper(store.db, { queryClient: client }).Wrapper },
    );
    await waitFor(() => expect(ids(result.current.data)).toEqual(['a', 'b', 'c']));

    act(() =>
      mapPaginatedItems<{ id: string; liked?: boolean }>(client, base.queryKey, (row) =>
        row.id === 'b' ? { ...row, liked: true } : row,
      ),
    );
    await waitFor(() => expect(result.current.data?.find((r) => r.id === 'b')?.liked).toBe(true));
    expect(result.current.hasNextPage).toBe(true);
  });

  it('prepends a new row onto page 1 only, keeping page 2 aligned', async () => {
    const client = makeClient();
    const { result } = renderHook(() => useFirestorePaginated(base), {
      wrapper: firestoreTestWrapper(store.db, { queryClient: client }).Wrapper,
    });
    await waitFor(() => expect(result.current.hasNextPage).toBe(true));
    act(() => result.current.nextPage());
    await waitFor(() => expect(ids(result.current.data)).toEqual(['d', 'e', 'f']));

    act(() => prependToFirstPaginatedPage(client, base.queryKey, { id: 'new', n: 'new' }));
    const page1 = client.getQueryData<{ items: Array<{ id: string }> }>(
      paginatedPageKey(base.queryKey, 1),
    );
    const page2 = client.getQueryData<{ items: Array<{ id: string }> }>(
      paginatedPageKey(base.queryKey, 2),
    );
    expect(ids(page1?.items)).toEqual(['new', 'a', 'b', 'c']);
    expect(ids(page2?.items)).toEqual(['d', 'e', 'f']);
  });

  it('leaves an uncached page 1 alone', () => {
    const client = makeClient();
    prependToFirstPaginatedPage(client, ['items'], { id: 'new' });
    expect(client.getQueryData(paginatedPageKey(['items'], 1))).toBeUndefined();
  });
});
