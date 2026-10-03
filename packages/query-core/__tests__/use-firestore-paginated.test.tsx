// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';

type FakeDoc = { id: string; data: () => Record<string, unknown> };

const h = vi.hoisted(() => ({
  rows: [] as string[],
  getDocs: vi.fn(),
}));

vi.mock('firebase/firestore', () => ({
  collection: (_db: unknown, path: string) => ({ __path: path }),
  query: (ref: unknown, ...c: unknown[]) => ({ __ref: ref, __c: c }),
  limit: (n: number) => ({ __limit: n }),
  startAfter: (d: FakeDoc) => ({ __startAfter: d.id }),
  getDocs: h.getDocs,
}));

import { useFirestorePaginated } from '../src/react/firestore/use-firestore-paginated.js';
import { FirestoreProvider } from '../src/react/firestore/context.js';
import {
  mapPaginatedItems,
  paginatedPageKey,
  prependToFirstPaginatedPage,
} from '../src/cache-helpers.js';

// A fake ordered collection: getDocs honours startAfter + limit like Firestore does.
function serve(q: { __c: Array<Record<string, unknown>> }) {
  const after = q.__c.find((c) => '__startAfter' in c)?.__startAfter as string | undefined;
  const lim = q.__c.find((c) => '__limit' in c)?.__limit as number;
  const start = after ? h.rows.indexOf(after) + 1 : 0;
  const docs: FakeDoc[] = h.rows.slice(start, start + lim).map((id) => ({ id, data: () => ({ n: id }) }));
  return Promise.resolve({ docs });
}
function startedAfter(callIndex: number): string | undefined {
  const q = h.getDocs.mock.calls[callIndex][0] as { __c: Array<Record<string, unknown>> };
  return q.__c.find((c) => '__startAfter' in c)?.__startAfter as string | undefined;
}

function makeClient() {
  return new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } });
}
function wrapperFor(client: QueryClient) {
  const Wrapper = ({ children }: { children: React.ReactNode }) =>
    React.createElement(
      QueryClientProvider,
      { client },
      React.createElement(FirestoreProvider, { db: {} as never, children }),
    );
  Wrapper.displayName = 'TestWrapper';
  return Wrapper;
}
function ids(data: Array<{ id: string }> | undefined) {
  return (data ?? []).map((d) => d.id);
}

const base = { collectionPath: 'items', queryKey: ['items', { pageSize: 3 }], pageSize: 3 };

beforeEach(() => {
  h.rows = ['a', 'b', 'c', 'd', 'e', 'f', 'g'];
  h.getDocs.mockReset();
  h.getDocs.mockImplementation(serve);
});

afterEach(() => {
  vi.useRealTimers();
});

describe('useFirestorePaginated', () => {
  it('reports no next page when the displayed page exactly fills and nothing follows', async () => {
    h.rows = ['a', 'b', 'c'];
    const { result } = renderHook(() => useFirestorePaginated(base), {
      wrapper: wrapperFor(makeClient()),
    });
    await waitFor(() => expect(ids(result.current.data)).toEqual(['a', 'b', 'c']));
    expect(result.current.hasNextPage).toBe(false);
  });

  it('keeps Next available on an earlier page after visiting a short last page', async () => {
    const { result } = renderHook(() => useFirestorePaginated(base), {
      wrapper: wrapperFor(makeClient()),
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
    h.rows = ['a', 'b'];
    const { result } = renderHook(() => useFirestorePaginated(base), {
      wrapper: wrapperFor(makeClient()),
    });
    await waitFor(() => expect(ids(result.current.data)).toEqual(['a', 'b']));
    act(() => result.current.nextPage());
    expect(result.current.page).toBe(1);
  });

  it('starts a page after the previous page cached under the same key, shared by every instance', async () => {
    const client = makeClient();
    const first = renderHook(() => useFirestorePaginated(base), { wrapper: wrapperFor(client) });
    await waitFor(() => expect(ids(first.result.current.data)).toEqual(['a', 'b', 'c']));
    const callsBefore = h.getDocs.mock.calls.length;

    const second = renderHook(() => useFirestorePaginated({ ...base, initialPage: 2 }), {
      wrapper: wrapperFor(client),
    });
    await waitFor(() => expect(ids(second.result.current.data)).toEqual(['d', 'e', 'f']));
    // Page 1 came from the cache; only page 2 was read, after page 1's last row.
    expect(h.getDocs.mock.calls.length).toBe(callsBefore + 1);
    expect(startedAfter(callsBefore)).toBe('c');
  });

  it('re-reads the page chain when a previous page is no longer cached', async () => {
    const client = makeClient();
    const { result } = renderHook(() => useFirestorePaginated(base), { wrapper: wrapperFor(client) });
    await waitFor(() => expect(result.current.hasNextPage).toBe(true));
    act(() => result.current.nextPage());
    await waitFor(() => expect(ids(result.current.data)).toEqual(['d', 'e', 'f']));

    client.removeQueries({ queryKey: paginatedPageKey(base.queryKey, 1), exact: true });
    h.rows = ['z', ...h.rows];
    const callsBefore = h.getDocs.mock.calls.length;
    await act(async () => {
      await result.current.refetch();
    });
    // Page 1 is read again first, so page 2 starts after its new last row.
    expect(startedAfter(callsBefore)).toBeUndefined();
    expect(startedAfter(callsBefore + 1)).toBe('b');
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
      { wrapper: wrapperFor(makeClient()), initialProps: { owner: 'u1' } },
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
    const { result } = renderHook(() => useFirestorePaginated({ ...base, refetchInterval: 30_000 }), {
      wrapper: wrapperFor(makeClient()),
    });
    await waitFor(() => expect(ids(result.current.data)).toEqual(['a', 'b', 'c']));
    const callsBefore = h.getDocs.mock.calls.length;
    h.rows = ['new', ...h.rows];
    await act(async () => {
      await vi.advanceTimersByTimeAsync(30_000);
    });
    await waitFor(() => expect(ids(result.current.data)).toEqual(['new', 'a', 'b']));
    expect(h.getDocs.mock.calls.length).toBeGreaterThan(callsBefore);
  });
});

describe('a page re-read moves where the next page starts', () => {
  const fresh = { ...base, staleTime: Infinity };

  it('re-reads a cached later page whose start no longer follows the re-read earlier page', async () => {
    const { result } = renderHook(() => useFirestorePaginated(fresh), { wrapper: wrapperFor(makeClient()) });
    await waitFor(() => expect(result.current.hasNextPage).toBe(true));
    act(() => result.current.nextPage());
    await waitFor(() => expect(ids(result.current.data)).toEqual(['d', 'e', 'f']));

    // A new row arrives at the top; page 1 is read again and now ends at b, not c.
    h.rows = ['z', ...h.rows];
    act(() => result.current.prevPage());
    await act(async () => {
      await result.current.refetch();
    });
    await waitFor(() => expect(ids(result.current.data)).toEqual(['z', 'a', 'b']));

    act(() => result.current.nextPage());
    // c is neither skipped nor is page 2 shown from its old start.
    await waitFor(() => expect(ids(result.current.data)).toEqual(['c', 'd', 'e']));
  });

  it('keeps the chain after a prepend once page 1 is read again', async () => {
    const client = makeClient();
    const { result } = renderHook(() => useFirestorePaginated(fresh), { wrapper: wrapperFor(client) });
    await waitFor(() => expect(result.current.hasNextPage).toBe(true));
    act(() => result.current.nextPage());
    await waitFor(() => expect(ids(result.current.data)).toEqual(['d', 'e', 'f']));
    act(() => result.current.prevPage());
    await waitFor(() => expect(result.current.page).toBe(1));

    h.rows = ['new', ...h.rows];
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
      { wrapper: wrapperFor(client) },
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
    const { result } = renderHook(() => useFirestorePaginated(base), { wrapper: wrapperFor(client) });
    await waitFor(() => expect(result.current.hasNextPage).toBe(true));
    act(() => result.current.nextPage());
    await waitFor(() => expect(ids(result.current.data)).toEqual(['d', 'e', 'f']));

    act(() => prependToFirstPaginatedPage(client, base.queryKey, { id: 'new', n: 'new' }));
    const page1 = client.getQueryData<{ items: Array<{ id: string }> }>(paginatedPageKey(base.queryKey, 1));
    const page2 = client.getQueryData<{ items: Array<{ id: string }> }>(paginatedPageKey(base.queryKey, 2));
    expect(ids(page1?.items)).toEqual(['new', 'a', 'b', 'c']);
    expect(ids(page2?.items)).toEqual(['d', 'e', 'f']);
  });

  it('leaves an uncached page 1 alone', () => {
    const client = makeClient();
    prependToFirstPaginatedPage(client, ['items'], { id: 'new' });
    expect(client.getQueryData(paginatedPageKey(['items'], 1))).toBeUndefined();
  });
});
