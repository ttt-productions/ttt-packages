import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider, onlineManager } from '@tanstack/react-query';
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

import type { FirestoreError } from 'firebase/firestore';
import { firestoreError } from '@ttt-productions/firebase-helpers/firestore-client/testing';
import { useBatchFirestoreDocs } from '../src/react/firestore/useBatchFirestoreDocs.js';
import { docGetIn, holdReads, type ReadHold } from './helpers/batch-docs-reads.js';

let hold: ReadHold;

const denial = (message: string) => firestoreError('permission-denied', message);

function answer(id: string, how: 'present' | 'absent' | FirestoreError) {
  const entry = hold.waiting.find((held) => held.ids.includes(id));
  if (!entry) throw new Error(`no read waiting for ${id}`);
  if (typeof how !== 'string') return entry.fail(how);
  if (how === 'present') store.seed(`teams/${id}`, { name: id });
  else store.remove(`teams/${id}`);
  entry.release();
}

function renderLookup(ids: string[]) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: Infinity, staleTime: 0 } },
  });
  const Wrapper = ({ children }: { children: React.ReactNode }) =>
    React.createElement(QueryClientProvider, { client: queryClient }, children);
  Wrapper.displayName = 'TestWrapper';
  return renderHook(
    () =>
      useBatchFirestoreDocs({
        db: store.db,
        collectionPath: 'teams',
        ids,
        queryKeyPrefix: 'team',
        transport: 'get',
        absentRetryDelaysMs: [],
      }),
    { wrapper: Wrapper },
  );
}

const waitingFor = (id: string) =>
  waitFor(() => expect(hold.waiting.some((entry) => entry.ids.includes(id))).toBe(true));

beforeEach(() => {
  store.reset();
  hold = holdReads(store, docGetIn('teams'));
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
    await act(async () => answer('a', denial('denied')));
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
    await act(async () => answer('a', denial('denied')));
    await waitFor(() => expect(result.current.isError).toBe(true));

    act(() => onlineManager.setOnline(false));
    act(() => void result.current.refetch());
    await waitFor(() => expect(result.current.failedReadsRunning).toBe(true));
    expect(hold.waiting).toHaveLength(0);
    expect(store.queries()).toHaveLength(1);
  });

  it('never counts another id’s first load beside a failed one', async () => {
    const { result } = renderLookup(['a', 'b']);
    await waitingFor('a');
    await waitingFor('b');
    await act(async () => answer('a', denial('denied')));
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(hold.waiting.map((entry) => entry.ids)).toEqual([['b']]);
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
    const denied = denial('denied');
    await act(async () => {
      answer('a', denied);
      answer('b', 'present');
    });
    await waitFor(() =>
      expect(result.current.outcomes.a).toEqual({
        status: 'failed',
        error: denied,
        retrying: false,
      }),
    );

    act(() => void result.current.refetch());
    await waitingFor('a');
    expect(result.current.outcomes.a).toEqual({ status: 'failed', error: denied, retrying: true });
    expect(result.current.outcomes.b).toMatchObject({ status: 'present' });

    await act(async () => answer('a', 'present'));
    await waitFor(() => expect(result.current.outcomes.a).toMatchObject({ status: 'present' }));
  });

  it("replaces the held failure with the retry's own failure", async () => {
    const { result } = renderLookup(['a']);
    await waitingFor('a');
    await act(async () => answer('a', denial('denied')));
    await waitFor(() => expect(result.current.outcomes.a).toMatchObject({ status: 'failed' }));

    act(() => void result.current.refetch());
    await waitingFor('a');
    const again = denial('denied again');
    await act(async () => answer('a', again));
    await waitFor(() =>
      expect(result.current.outcomes.a).toEqual({
        status: 'failed',
        error: again,
        retrying: false,
      }),
    );
  });
});
