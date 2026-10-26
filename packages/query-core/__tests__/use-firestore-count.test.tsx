// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';

const store = await vi.hoisted(async () => {
  const { makeInMemoryClientFirestore } =
    await import('@ttt-productions/firebase-helpers/firestore-client/testing');
  return makeInMemoryClientFirestore();
});

vi.mock('firebase/firestore', async (importOriginal) => {
  const { clientFirestoreFake } = await import('../../../test/client-firestore-fake.js');
  return clientFirestoreFake(importOriginal, store);
});

import { where } from 'firebase/firestore';
import { useFirestoreCount } from '../src/react/firestore/use-firestore-count.js';
import { FirestoreProvider } from '../src/react/firestore/context.js';

function makeWrapper() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const Wrapper = ({ children }: { children: React.ReactNode }) =>
    React.createElement(
      QueryClientProvider,
      { client: queryClient },
      React.createElement(FirestoreProvider, { db: store.db, children }),
    );
  Wrapper.displayName = 'TestWrapper';
  return Wrapper;
}

beforeEach(() => {
  store.reset();
  for (const id of ['a', 'b', 'c']) store.seed(`items/${id}`, { seenAt: 0 });
  for (const id of ['d', 'e', 'f', 'g']) store.seed(`items/${id}`, { seenAt: 1 });
});

describe('useFirestoreCount', () => {
  it('returns the server-side count', async () => {
    const { result } = renderHook(
      () => useFirestoreCount({ collectionPath: 'items', queryKey: ['items', 'count'] }),
      { wrapper: makeWrapper() },
    );
    await waitFor(() => expect(result.current.data).toBe(7));
  });

  it('does not fetch when disabled', async () => {
    const { result } = renderHook(
      () =>
        useFirestoreCount({
          collectionPath: 'items',
          queryKey: ['items', 'count', 'off'],
          enabled: false,
        }),
      { wrapper: makeWrapper() },
    );
    await Promise.resolve();
    expect(store.queries()).toEqual([]);
    expect(result.current.data).toBeUndefined();
  });

  it('applies constraints before counting', async () => {
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
    expect(store.queries()).toEqual([
      expect.objectContaining({
        kind: 'count',
        path: 'items',
        filters: [{ field: 'seenAt', op: '==', value: { t: 'num', v: 0 } }],
      }),
    ]);
  });
});
