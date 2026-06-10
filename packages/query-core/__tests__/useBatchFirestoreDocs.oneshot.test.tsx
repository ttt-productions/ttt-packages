import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';

// One-shot path mock: getDocs returns only the docs that "exist"; the hook must
// negative-cache the rest as null so they are not re-fetched while fresh.
const { existingDocs, getDocsMock } = vi.hoisted(() => {
  const existingDocs = new Map<string, Record<string, unknown>>();
  const getDocsMock = vi.fn(async () => ({
    forEach: (cb: (doc: { id: string; data: () => Record<string, unknown> }) => void) => {
      for (const [id, data] of existingDocs) {
        cb({ id, data: () => data });
      }
    },
  }));
  return { existingDocs, getDocsMock };
});

vi.mock('firebase/firestore', () => ({
  collection: () => ({}),
  query: () => ({}),
  where: () => ({}),
  documentId: () => '__name__',
  getDocs: getDocsMock,
  doc: () => ({}),
  onSnapshot: vi.fn(),
}));

import { useBatchFirestoreDocs } from '../src/react/firestore/useBatchFirestoreDocs.js';

beforeEach(() => {
  existingDocs.clear();
  getDocsMock.mockClear();
});

function makeWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: Infinity, staleTime: 0 } },
  });
  const Wrapper = ({ children }: { children: React.ReactNode }) =>
    React.createElement(QueryClientProvider, { client: queryClient }, children);
  Wrapper.displayName = 'TestWrapper';
  return { queryClient, Wrapper };
}

const baseOpts = {
  db: {} as never,
  collectionPath: 'publicUsers',
  queryKeyPrefix: 'publicUser',
  staleTime: 30 * 60 * 1000,
};

describe('useBatchFirestoreDocs — one-shot mode', () => {
  it('returns existing docs and excludes missing ones', async () => {
    existingDocs.set('u1', { displayName: 'Alice' });

    const { Wrapper } = makeWrapper();
    const { result } = renderHook(
      () => useBatchFirestoreDocs({ ...baseOpts, ids: ['u1', 'ghost'] }),
      { wrapper: Wrapper },
    );

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.data).toEqual({ u1: { id: 'u1', displayName: 'Alice' } });
  });

  it('negative-caches missing ids as null', async () => {
    existingDocs.set('u1', { displayName: 'Alice' });

    const { Wrapper, queryClient } = makeWrapper();
    const { result } = renderHook(
      () => useBatchFirestoreDocs({ ...baseOpts, ids: ['u1', 'ghost'] }),
      { wrapper: Wrapper },
    );

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(queryClient.getQueryData(['publicUser', 'ghost'])).toBeNull();
    expect(queryClient.getQueryData(['publicUser', 'u1'])).toMatchObject({ displayName: 'Alice' });
  });

  it('does not re-fetch a known-missing id while fresh', async () => {
    const { Wrapper } = makeWrapper();

    const first = renderHook(
      () => useBatchFirestoreDocs({ ...baseOpts, ids: ['ghost'] }),
      { wrapper: Wrapper },
    );
    await waitFor(() => expect(first.result.current.isLoading).toBe(false));
    expect(getDocsMock).toHaveBeenCalledTimes(1);
    first.unmount();

    // A second consumer of the same id within staleTime must hit the negative
    // cache instead of issuing another Firestore query.
    const second = renderHook(
      () => useBatchFirestoreDocs({ ...baseOpts, ids: ['ghost'] }),
      { wrapper: Wrapper },
    );
    await waitFor(() => expect(second.result.current.isLoading).toBe(false));
    expect(second.result.current.data).toEqual({});
    expect(getDocsMock).toHaveBeenCalledTimes(1);
  });

  it('does not mutate the caller-derived batch order when building query keys', async () => {
    existingDocs.set('a', { v: 1 });
    existingDocs.set('b', { v: 2 });

    const ids = ['b', 'a'];
    const { Wrapper } = makeWrapper();
    const { result } = renderHook(() => useBatchFirestoreDocs({ ...baseOpts, ids }), {
      wrapper: Wrapper,
    });

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    // The input array the caller passed is untouched.
    expect(ids).toEqual(['b', 'a']);
    expect(Object.keys(result.current.data).sort()).toEqual(['a', 'b']);
  });
});
