import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';

// Controllable firebase/firestore mock: capture the snapshot/error callbacks per
// opened listener so tests can emit listener errors and recovery snapshots, and count
// how many times a fresh listener was opened (resubscribes).
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
import { FirestoreProvider } from '../src/react/firestore/context.js';
import { RESUBSCRIBE_DELAYS_MS } from '../src/react/firestore/resubscribe.js';

// A Firestore permission-denied error carries `.code` — the discriminator the
// hooks retry on (never the message).
const permissionDenied = () =>
  Object.assign(new Error('Missing or insufficient permissions.'), { code: 'permission-denied' });

beforeEach(() => {
  docCaps.length = 0;
  colCaps.length = 0;
  onSnapshotMock.mockClear();
  vi.spyOn(console, 'error').mockImplementation(() => {});
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

function makeWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: Infinity, staleTime: 0 } },
  });
  const Wrapper = ({ children }: { children: React.ReactNode }) =>
    React.createElement(
      QueryClientProvider,
      { client: queryClient },
      React.createElement(FirestoreProvider, { db: {} as never, children }),
    );
  Wrapper.displayName = 'TestWrapper';
  return { queryClient, Wrapper };
}

const [D0, D1, D2] = RESUBSCRIBE_DELAYS_MS;

describe('useFirestoreDoc — bounded resubscribe on permission-denied', () => {
  it('does not surface the error; resubscribes after the first delay and heals on the next snapshot', () => {
    const { Wrapper } = makeWrapper();
    const { result } = renderHook(
      () => useFirestoreDoc({ docPath: 'users/u1', queryKey: ['user', 'u1'], subscribe: true }),
      { wrapper: Wrapper },
    );
    expect(onSnapshotMock).toHaveBeenCalledTimes(1);

    act(() => docCaps[0].error(permissionDenied()));
    // Silent heal in progress: no error surfaced, no new listener yet, reconnecting.
    expect(result.current.isError).toBe(false);
    expect(result.current.sourceState).toBe('connecting');
    expect(onSnapshotMock).toHaveBeenCalledTimes(1);

    act(() => vi.advanceTimersByTime(D0));
    expect(onSnapshotMock).toHaveBeenCalledTimes(2);

    act(() => docCaps[docCaps.length - 1].next({ exists: () => true, id: 'u1', data: () => ({ n: 1 }), metadata: { fromCache: false } }));
    expect(result.current.isError).toBe(false);
    expect(result.current.sourceState).toBe('live');
  });

  it('surfaces the error once the ladder is exhausted (3 retries at 5s/15s/45s)', () => {
    const { Wrapper } = makeWrapper();
    const { result } = renderHook(
      () => useFirestoreDoc({ docPath: 'users/u1', queryKey: ['user', 'u1'], subscribe: true }),
      { wrapper: Wrapper },
    );

    const boom = permissionDenied();
    act(() => docCaps[docCaps.length - 1].error(boom));
    act(() => vi.advanceTimersByTime(D0));
    act(() => docCaps[docCaps.length - 1].error(permissionDenied()));
    act(() => vi.advanceTimersByTime(D1));
    act(() => docCaps[docCaps.length - 1].error(permissionDenied()));
    act(() => vi.advanceTimersByTime(D2));
    // 1 initial + 3 resubscribes.
    expect(onSnapshotMock).toHaveBeenCalledTimes(4);
    expect(result.current.isError).toBe(false);

    // Fourth error has no ladder left → surfaces as before.
    act(() => docCaps[docCaps.length - 1].error(boom));
    expect(result.current.isError).toBe(true);
    expect(result.current.error).toBe(boom);
    expect(result.current.status).toBe('error');
    expect(result.current.sourceState).toBe('error');
  });

  it('surfaces a non-permission-denied error immediately (no retry)', () => {
    const { Wrapper } = makeWrapper();
    const { result } = renderHook(
      () => useFirestoreDoc({ docPath: 'users/u1', queryKey: ['user', 'u1'], subscribe: true }),
      { wrapper: Wrapper },
    );

    const boom = new Error('unavailable');
    act(() => docCaps[0].error(boom));
    expect(result.current.isError).toBe(true);
    expect(result.current.error).toBe(boom);

    act(() => vi.advanceTimersByTime(D0 + D1 + D2));
    expect(onSnapshotMock).toHaveBeenCalledTimes(1);
  });

  it('resets the ladder after a healthy snapshot (a later blip gets a fresh first delay)', () => {
    const { Wrapper } = makeWrapper();
    renderHook(
      () => useFirestoreDoc({ docPath: 'users/u1', queryKey: ['user', 'u1'], subscribe: true }),
      { wrapper: Wrapper },
    );

    act(() => docCaps[docCaps.length - 1].error(permissionDenied()));
    act(() => vi.advanceTimersByTime(D0));
    expect(onSnapshotMock).toHaveBeenCalledTimes(2);
    act(() => docCaps[docCaps.length - 1].next({ exists: () => true, id: 'u1', data: () => ({ n: 1 }), metadata: { fromCache: false } }));

    // A fresh blip resubscribes again after the FIRST delay (ladder was reset).
    act(() => docCaps[docCaps.length - 1].error(permissionDenied()));
    act(() => vi.advanceTimersByTime(D0));
    expect(onSnapshotMock).toHaveBeenCalledTimes(3);
  });

  it('clears a pending retry on unmount (no resubscribe after teardown)', () => {
    const { Wrapper } = makeWrapper();
    const { unmount } = renderHook(
      () => useFirestoreDoc({ docPath: 'users/u1', queryKey: ['user', 'u1'], subscribe: true }),
      { wrapper: Wrapper },
    );

    act(() => docCaps[0].error(permissionDenied()));
    unmount();
    act(() => vi.advanceTimersByTime(D0 + D1 + D2));
    expect(onSnapshotMock).toHaveBeenCalledTimes(1);
  });
});

describe('useFirestoreCollection — bounded resubscribe on permission-denied', () => {
  const goodSnap = () => ({ docs: [{ id: 'i1', data: () => ({ name: 'x' }) }], metadata: { fromCache: false } });

  it('does not surface the error; resubscribes after the first delay and heals on the next snapshot', () => {
    const { Wrapper } = makeWrapper();
    const { result } = renderHook(
      () => useFirestoreCollection({ collectionPath: 'items', queryKey: ['items'], subscribe: true }),
      { wrapper: Wrapper },
    );
    expect(onSnapshotMock).toHaveBeenCalledTimes(1);

    act(() => colCaps[0].error(permissionDenied()));
    expect(result.current.isError).toBe(false);
    expect(result.current.sourceState).toBe('connecting');
    expect(onSnapshotMock).toHaveBeenCalledTimes(1);

    act(() => vi.advanceTimersByTime(D0));
    expect(onSnapshotMock).toHaveBeenCalledTimes(2);

    act(() => colCaps[colCaps.length - 1].next(goodSnap()));
    expect(result.current.isError).toBe(false);
    expect(result.current.sourceState).toBe('live');
  });

  it('surfaces the error once the ladder is exhausted (3 retries at 5s/15s/45s)', () => {
    const { Wrapper } = makeWrapper();
    const { result } = renderHook(
      () => useFirestoreCollection({ collectionPath: 'items', queryKey: ['items'], subscribe: true }),
      { wrapper: Wrapper },
    );

    const boom = permissionDenied();
    act(() => colCaps[colCaps.length - 1].error(boom));
    act(() => vi.advanceTimersByTime(D0));
    act(() => colCaps[colCaps.length - 1].error(permissionDenied()));
    act(() => vi.advanceTimersByTime(D1));
    act(() => colCaps[colCaps.length - 1].error(permissionDenied()));
    act(() => vi.advanceTimersByTime(D2));
    expect(onSnapshotMock).toHaveBeenCalledTimes(4);
    expect(result.current.isError).toBe(false);

    act(() => colCaps[colCaps.length - 1].error(boom));
    expect(result.current.isError).toBe(true);
    expect(result.current.error).toBe(boom);
    expect(result.current.status).toBe('error');
    expect(result.current.sourceState).toBe('error');
  });

  it('surfaces a non-permission-denied error immediately (no retry)', () => {
    const { Wrapper } = makeWrapper();
    const { result } = renderHook(
      () => useFirestoreCollection({ collectionPath: 'items', queryKey: ['items'], subscribe: true }),
      { wrapper: Wrapper },
    );

    const boom = new Error('unavailable');
    act(() => colCaps[0].error(boom));
    expect(result.current.isError).toBe(true);
    expect(result.current.error).toBe(boom);

    act(() => vi.advanceTimersByTime(D0 + D1 + D2));
    expect(onSnapshotMock).toHaveBeenCalledTimes(1);
  });

  it('clears a pending retry on unmount (no resubscribe after teardown)', () => {
    const { Wrapper } = makeWrapper();
    const { unmount } = renderHook(
      () => useFirestoreCollection({ collectionPath: 'items', queryKey: ['items'], subscribe: true }),
      { wrapper: Wrapper },
    );

    act(() => colCaps[0].error(permissionDenied()));
    unmount();
    act(() => vi.advanceTimersByTime(D0 + D1 + D2));
    expect(onSnapshotMock).toHaveBeenCalledTimes(1);
  });
});
