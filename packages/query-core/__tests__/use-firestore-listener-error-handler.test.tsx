import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';

// Controllable firebase/firestore mock: capture each opened listener's callbacks.
const { docCaps, colCaps, onSnapshotMock } = vi.hoisted(() => {
  const docCaps: Array<{ next: (snap: unknown) => void; error: (e: Error) => void }> = [];
  const colCaps: Array<{ next: (snap: unknown) => void; error: (e: Error) => void }> = [];
  const onSnapshotMock = vi.fn(
    (target: { __kind: 'doc' | 'col' }, _options: unknown, next: (s: unknown) => void, error: (e: Error) => void) => {
      (target.__kind === 'doc' ? docCaps : colCaps).push({ next, error });
      return vi.fn();
    },
  );
  return { docCaps, colCaps, onSnapshotMock };
});

vi.mock('firebase/firestore', () => ({
  doc: () => ({ __kind: 'doc' }),
  collection: () => ({ __kind: 'col' }),
  query: (ref: unknown) => ref,
  onSnapshot: onSnapshotMock,
  getDoc: vi.fn(async () => ({ exists: () => false })),
  getDocs: vi.fn(async () => ({ docs: [] })),
}));

import { useFirestoreDoc } from '../src/react/firestore/use-firestore-doc.js';
import { useFirestoreCollection } from '../src/react/firestore/use-firestore-collection.js';
import { FirestoreProvider, type FirestoreListenerErrorHandler } from '../src/react/firestore/context.js';
import { RESUBSCRIBE_DELAYS_MS } from '../src/react/firestore/resubscribe.js';

const permissionDenied = () =>
  Object.assign(new Error('Missing or insufficient permissions.'), { code: 'permission-denied' });
const unavailable = () => Object.assign(new Error('unavailable'), { code: 'unavailable' });

beforeEach(() => {
  docCaps.length = 0;
  colCaps.length = 0;
  onSnapshotMock.mockClear();
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

function wrapperWith(onListenerError?: FirestoreListenerErrorHandler) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: Infinity, staleTime: 0 } },
  });
  const Wrapper = ({ children }: { children: React.ReactNode }) =>
    React.createElement(
      QueryClientProvider,
      { client: queryClient },
      React.createElement(FirestoreProvider, { db: {} as never, onListenerError, children }),
    );
  Wrapper.displayName = 'ReportingWrapper';
  return Wrapper;
}

describe('a subscribed read hands its surfaced listener error to the provider handler', () => {
  it('useFirestoreDoc: once, naming the read, beside the error it keeps in its result', () => {
    const onListenerError = vi.fn();
    const { result } = renderHook(
      () => useFirestoreDoc({ docPath: 'users/u1', queryKey: ['user', 'u1'], subscribe: true }),
      { wrapper: wrapperWith(onListenerError) },
    );
    const failure = unavailable();
    act(() => docCaps[0].error(failure));

    expect(onListenerError).toHaveBeenCalledTimes(1);
    expect(onListenerError).toHaveBeenCalledWith(failure, {
      hook: 'useFirestoreDoc',
      queryKey: ['user', 'u1'],
      path: 'users/u1',
    });
    expect(result.current.error).toBe(failure);
    expect(console.error).not.toHaveBeenCalled();
  });

  it('useFirestoreCollection: once, naming the read', () => {
    const onListenerError = vi.fn();
    renderHook(
      () => useFirestoreCollection({ collectionPath: 'items', queryKey: ['items'], subscribe: true }),
      { wrapper: wrapperWith(onListenerError) },
    );
    const failure = unavailable();
    act(() => colCaps[0].error(failure));

    expect(onListenerError).toHaveBeenCalledTimes(1);
    expect(onListenerError).toHaveBeenCalledWith(failure, {
      hook: 'useFirestoreCollection',
      queryKey: ['items'],
      path: 'items',
    });
  });

  it('a permission-denied error reaches the handler only after its resubscribe ladder is spent', () => {
    vi.useFakeTimers();
    const onListenerError = vi.fn();
    renderHook(
      () => useFirestoreCollection({ collectionPath: 'items', queryKey: ['items'], subscribe: true }),
      { wrapper: wrapperWith(onListenerError) },
    );
    for (const delay of RESUBSCRIBE_DELAYS_MS) {
      act(() => colCaps[colCaps.length - 1].error(permissionDenied()));
      expect(onListenerError).not.toHaveBeenCalled();
      act(() => {
        vi.advanceTimersByTime(delay);
      });
    }
    act(() => colCaps[colCaps.length - 1].error(permissionDenied()));
    expect(onListenerError).toHaveBeenCalledTimes(1);
  });

  it('a retry that fails again is a second surfaced error, handed over once more', () => {
    const onListenerError = vi.fn();
    const { result } = renderHook(
      () => useFirestoreDoc({ docPath: 'users/u1', queryKey: ['user', 'u1'], subscribe: true }),
      { wrapper: wrapperWith(onListenerError) },
    );
    act(() => docCaps[0].error(unavailable()));
    act(() => {
      void result.current.refetch();
    });
    expect(docCaps).toHaveLength(2);
    act(() => docCaps[1].error(unavailable()));
    expect(onListenerError).toHaveBeenCalledTimes(2);
  });

  it('a new handler from the provider does not re-open the listener, and receives the next error', () => {
    const first = vi.fn();
    const second = vi.fn();
    let handler: FirestoreListenerErrorHandler = first;
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const db = {} as never;
    const Wrapper = ({ children }: { children: React.ReactNode }) =>
      React.createElement(
        QueryClientProvider,
        { client: queryClient },
        React.createElement(FirestoreProvider, { db, onListenerError: handler, children }),
      );
    const { rerender } = renderHook(
      () => useFirestoreDoc({ docPath: 'users/u1', queryKey: ['user', 'u1'], subscribe: true }),
      { wrapper: Wrapper },
    );
    handler = second;
    rerender();
    expect(onSnapshotMock).toHaveBeenCalledTimes(1);

    act(() => docCaps[0].error(unavailable()));
    expect(first).not.toHaveBeenCalled();
    expect(second).toHaveBeenCalledTimes(1);
  });

  it('writes the error to the console when the app supplied no handler', () => {
    renderHook(
      () => useFirestoreDoc({ docPath: 'users/u1', queryKey: ['user', 'u1'], subscribe: true }),
      { wrapper: wrapperWith() },
    );
    const failure = unavailable();
    act(() => docCaps[0].error(failure));
    expect(console.error).toHaveBeenCalledWith('[useFirestoreDoc] Subscription error:', failure);
  });
});
