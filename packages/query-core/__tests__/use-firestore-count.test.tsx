// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';

const { getCountFromServerMock, queryMock } = vi.hoisted(() => ({
  getCountFromServerMock: vi.fn(),
  queryMock: vi.fn((ref: unknown, ...constraints: unknown[]) => ({ __ref: ref, __constraints: constraints })),
}));

vi.mock('firebase/firestore', () => ({
  collection: (_db: unknown, path: string) => ({ __path: path }),
  query: queryMock,
  where: (field: string, op: string, value: unknown) => ({ field, op, value }),
  getCountFromServer: getCountFromServerMock,
}));

import { where } from 'firebase/firestore';
import { useFirestoreCount } from '../src/react/firestore/use-firestore-count.js';
import { FirestoreProvider } from '../src/react/firestore/context.js';

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

beforeEach(() => {
  getCountFromServerMock.mockReset();
  queryMock.mockClear();
});

describe('useFirestoreCount', () => {
  it('returns the server-side count', async () => {
    getCountFromServerMock.mockResolvedValue({ data: () => ({ count: 7 }) });
    const { result } = renderHook(
      () => useFirestoreCount({ collectionPath: 'items', queryKey: ['items', 'count'] }),
      { wrapper: makeWrapper() },
    );
    await waitFor(() => expect(result.current.data).toBe(7));
  });

  it('does not fetch when disabled', async () => {
    const { result } = renderHook(
      () => useFirestoreCount({ collectionPath: 'items', queryKey: ['items', 'count', 'off'], enabled: false }),
      { wrapper: makeWrapper() },
    );
    await Promise.resolve();
    expect(getCountFromServerMock).not.toHaveBeenCalled();
    expect(result.current.data).toBeUndefined();
  });

  it('applies constraints before counting', async () => {
    getCountFromServerMock.mockResolvedValue({ data: () => ({ count: 3 }) });
    const { result } = renderHook(
      () =>
        useFirestoreCount({
          collectionPath: 'items',
          queryKey: ['items', 'count', 'filtered'],
          constraints: [where('seenAt', '==', 0)],
        }),
      { wrapper: makeWrapper() },
    );
    await waitFor(() => expect(result.current.data).toBe(3));
    expect(queryMock).toHaveBeenCalled();
  });
});
