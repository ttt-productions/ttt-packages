import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider, onlineManager } from '@tanstack/react-query';
import React from 'react';

// Per-id reads (`transport: 'get'`) answered by the test: each `getDoc` waits until the test
// resolves it with a document, an absence, or a failure.
const h = vi.hoisted(() => ({
  waiting: [] as Array<{ id: string; resolve: (snap: unknown) => void; reject: (error: Error) => void }>,
}));

vi.mock('firebase/firestore', () => ({
  collection: () => ({}),
  query: () => ({}),
  where: () => ({}),
  documentId: () => '__name__',
  getDocs: vi.fn(),
  doc: (_db: unknown, _path: string, id: string) => ({ __id: id }),
  getDoc: (ref: { __id: string }) =>
    new Promise((resolve, reject) => h.waiting.push({ id: ref.__id, resolve, reject })),
  onSnapshot: vi.fn(),
}));

import { useBatchFirestoreDocs } from '../src/react/firestore/useBatchFirestoreDocs.js';

const present = (id: string) => ({ id, exists: () => true, data: () => ({ name: id }) });
const missing = (id: string) => ({ id, exists: () => false, data: () => undefined });

function answer(id: string, how: 'present' | 'absent' | Error) {
  const index = h.waiting.findIndex((entry) => entry.id === id);
  if (index < 0) throw new Error(`no read waiting for ${id}`);
  const [entry] = h.waiting.splice(index, 1);
  if (how instanceof Error) entry.reject(how);
  else entry.resolve(how === 'present' ? present(id) : missing(id));
}

function renderLookup(ids: string[]) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity, staleTime: 0 } } });
  const Wrapper = ({ children }: { children: React.ReactNode }) =>
    React.createElement(QueryClientProvider, { client: queryClient }, children);
  Wrapper.displayName = 'TestWrapper';
  return renderHook(
    () =>
      useBatchFirestoreDocs({
        db: {} as never,
        collectionPath: 'teams',
        ids,
        queryKeyPrefix: 'team',
        transport: 'get',
        absentRetryDelaysMs: [],
      }),
    { wrapper: Wrapper },
  );
}

const waitingFor = (id: string) => waitFor(() => expect(h.waiting.some((entry) => entry.id === id)).toBe(true));

beforeEach(() => {
  h.waiting.length = 0;
});

afterEach(() => {
  onlineManager.setOnline(true);
});

describe('useBatchFirestoreDocs — failedReadsRunning', () => {
  it('is false through a first load', async () => {
    const { result } = renderLookup(['a']);
    await waitingFor('a');
    expect(result.current.isLoading).toBe(true);
    expect(result.current.failedReadsRunning).toBe(false);
  });

  it('is true while a retry of a failed read runs, after the error has been cleared, and false once it answers', async () => {
    const { result } = renderLookup(['a']);
    await waitingFor('a');
    await act(async () => answer('a', new Error('denied')));
    await waitFor(() => expect(result.current.error?.message).toBe('denied'));
    expect(result.current.failedReadsRunning).toBe(false);

    act(() => void result.current.refetch());
    await waitingFor('a');
    expect(result.current.error).toBeNull();
    expect(result.current.failedReadsRunning).toBe(true);

    await act(async () => answer('a', 'present'));
    await waitFor(() => expect(result.current.data.a).toMatchObject({ name: 'a' }));
    expect(result.current.failedReadsRunning).toBe(false);
  });

  it('is true while a retry of a failed read waits for the network', async () => {
    const { result } = renderLookup(['a']);
    await waitingFor('a');
    await act(async () => answer('a', new Error('denied')));
    await waitFor(() => expect(result.current.isError).toBe(true));

    act(() => onlineManager.setOnline(false));
    act(() => void result.current.refetch());
    await waitFor(() => expect(result.current.failedReadsRunning).toBe(true));
    expect(h.waiting).toHaveLength(0);
  });

  it('never counts another id’s first load beside a failed one', async () => {
    const { result } = renderLookup(['a', 'b']);
    await waitingFor('a');
    await waitingFor('b');
    await act(async () => answer('a', new Error('denied')));
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(h.waiting.map((entry) => entry.id)).toEqual(['b']);
    expect(result.current.failedReadsRunning).toBe(false);
  });

  it('never counts a re-read of an id that answered absent', async () => {
    const { result } = renderLookup(['a']);
    await waitingFor('a');
    await act(async () => answer('a', 'absent'));
    await waitFor(() => expect(result.current.outcomes.a).toEqual({ status: 'absent' }));

    act(() => void result.current.refetch());
    await waitingFor('a');
    expect(result.current.failedReadsRunning).toBe(false);
  });
});

describe('useBatchFirestoreDocs — a failed id through its retry', () => {
  it('stays failed with its own error and retrying, never loading, until the retry answers', async () => {
    const { result } = renderLookup(['a', 'b']);
    await waitingFor('a');
    await waitingFor('b');
    const denied = new Error('denied');
    await act(async () => {
      answer('a', denied);
      answer('b', 'present');
    });
    await waitFor(() => expect(result.current.outcomes.a).toEqual({ status: 'failed', error: denied, retrying: false }));

    act(() => void result.current.refetch());
    await waitingFor('a');
    expect(result.current.outcomes.a).toEqual({ status: 'failed', error: denied, retrying: true });
    expect(result.current.outcomes.b).toMatchObject({ status: 'present' });

    await act(async () => answer('a', 'present'));
    await waitFor(() => expect(result.current.outcomes.a).toMatchObject({ status: 'present' }));
  });

  it('replaces the held failure with the retry\'s own failure', async () => {
    const { result } = renderLookup(['a']);
    await waitingFor('a');
    await act(async () => answer('a', new Error('denied')));
    await waitFor(() => expect(result.current.outcomes.a).toMatchObject({ status: 'failed' }));

    act(() => void result.current.refetch());
    await waitingFor('a');
    const again = new Error('denied again');
    await act(async () => answer('a', again));
    await waitFor(() => expect(result.current.outcomes.a).toEqual({ status: 'failed', error: again, retrying: false }));
  });
});
