// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, useQuery, useQueryClient } from '@tanstack/react-query';
import { makeInMemoryClientFirestore } from '@ttt-productions/firebase-helpers/firestore-client/testing';
import { useFirestoreDb } from '../../src/react/firestore/context.js';
import { firestoreTestWrapper } from '../../src/react/testing/firestore-test-wrapper.js';

const store = makeInMemoryClientFirestore();

describe('firestoreTestWrapper', () => {
  it('hands the hook under test the given Firestore and the client it returns', () => {
    const { queryClient, Wrapper } = firestoreTestWrapper(store.db);
    const { result } = renderHook(() => ({ db: useFirestoreDb(), client: useQueryClient() }), {
      wrapper: Wrapper,
    });
    expect(result.current.db).toBe(store.db);
    expect(result.current.client).toBe(queryClient);
  });

  it('uses the client a case passes', () => {
    const queryClient = new QueryClient();
    const { Wrapper } = firestoreTestWrapper(store.db, { queryClient });
    const { result } = renderHook(() => useQueryClient(), { wrapper: Wrapper });
    expect(result.current).toBe(queryClient);
  });

  it('by default reads once: a failed read surfaces at once, never retried', async () => {
    const read = vi.fn(async (): Promise<number> => {
      throw new Error('read failed');
    });
    const { Wrapper } = firestoreTestWrapper(store.db);
    const { result } = renderHook(() => useQuery({ queryKey: ['once'], queryFn: read }), {
      wrapper: Wrapper,
    });
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(read).toHaveBeenCalledTimes(1);
  });
});
