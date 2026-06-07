// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';

const h = vi.hoisted(() => ({
  onSnapshotCb: null as null | ((snap: unknown) => void),
  onSnapshot: vi.fn(),
  getDocs: vi.fn(),
}));
h.onSnapshot.mockImplementation((_q: unknown, cb: (snap: unknown) => void) => {
  h.onSnapshotCb = cb;
  return vi.fn();
});

vi.mock('firebase/firestore', () => ({
  collection: (_db: unknown, path: string) => ({ __path: path }),
  query: (ref: unknown, ...c: unknown[]) => ({ __ref: ref, __c: c }),
  orderBy: (f: string, d: string) => ({ __orderBy: [f, d] }),
  limit: (n: number) => ({ __limit: n }),
  startAfter: (c: unknown) => ({ __startAfter: c }),
  onSnapshot: h.onSnapshot,
  getDocs: h.getDocs,
}));

import { useFirestoreLiveInfinite } from '../src/react/firestore/use-firestore-live-infinite.js';
import { FirestoreProvider } from '../src/react/firestore/context.js';

function snapDoc(id: string, data: Record<string, unknown>) {
  return { id, data: () => data };
}
function emitWindow(docs: Array<ReturnType<typeof snapDoc>>) {
  act(() => {
    h.onSnapshotCb!({ docs });
  });
}

function makeWrapper() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } });
  const Wrapper = ({ children }: { children: React.ReactNode }) =>
    React.createElement(
      QueryClientProvider,
      { client: qc },
      React.createElement(FirestoreProvider, { db: {} as never, children }),
    );
  Wrapper.displayName = 'TestWrapper';
  return Wrapper;
}

const baseOpts = {
  collectionPath: 'chats/t1/messages',
  queryKey: ['chat', 't1'],
  orderByField: 'createdAt',
  pageSize: 2,
};

beforeEach(() => {
  h.onSnapshotCb = null;
  h.onSnapshot.mockClear();
  h.getDocs.mockReset();
  h.getDocs.mockResolvedValue({ docs: [] });
});

describe('useFirestoreLiveInfinite', () => {
  it('is loading until the first window snapshot, then returns items ascending', async () => {
    const { result } = renderHook(() => useFirestoreLiveInfinite({ ...baseOpts }), {
      wrapper: makeWrapper(),
    });
    expect(result.current.isInitialLoading).toBe(true);

    // The window query is ordered descending — newest first.
    emitWindow([snapDoc('b', { createdAt: 20 }), snapDoc('a', { createdAt: 10 })]);

    expect(result.current.isInitialLoading).toBe(false);
    await waitFor(() =>
      expect(result.current.items.map((m) => (m as { id: string }).id)).toEqual(['a', 'b']),
    );
  });

  it('merges the older page below the window and dedupes overlaps', async () => {
    // startAfter is exclusive in prod, but returning an overlap ('a') proves dedupe.
    h.getDocs.mockResolvedValue({
      docs: [snapDoc('a', { createdAt: 10 }), snapDoc('z', { createdAt: 5 })],
    });
    const { result } = renderHook(() => useFirestoreLiveInfinite({ ...baseOpts }), {
      wrapper: makeWrapper(),
    });
    emitWindow([snapDoc('b', { createdAt: 20 }), snapDoc('a', { createdAt: 10 })]);

    await waitFor(() =>
      expect(result.current.items.map((m) => (m as { id: string }).id)).toEqual(['z', 'a', 'b']),
    );
    expect(result.current.items).toHaveLength(3);
  });

  it('applies select + getSortValue to map and order items', async () => {
    const { result } = renderHook(
      () =>
        useFirestoreLiveInfinite<{ key: string }>({
          ...baseOpts,
          select: (d) => ({ key: `k:${d.id}` }),
          getSortValue: (d) => d.createdAt as number,
        }),
      { wrapper: makeWrapper() },
    );
    emitWindow([snapDoc('a', { createdAt: 10 })]);
    await waitFor(() => expect(result.current.items).toEqual([{ key: 'k:a' }]));
  });

  it('opens no listener and stays empty when disabled', () => {
    const { result } = renderHook(() => useFirestoreLiveInfinite({ ...baseOpts, enabled: false }), {
      wrapper: makeWrapper(),
    });
    expect(h.onSnapshot).not.toHaveBeenCalled();
    expect(result.current.items).toEqual([]);
    expect(result.current.isInitialLoading).toBe(false);
  });
});
