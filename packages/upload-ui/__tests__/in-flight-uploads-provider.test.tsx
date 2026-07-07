import { describe, it, expect, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import React from 'react';
import {
  InFlightUploadsProvider,
  useInFlightUploadsState,
  useUploadActivityState,
  useInFlightUpload,
  useUploadsSourceState,
  type InFlightUploadsAdapter,
  type FirestoreSubscribeFn,
  type FirestoreLikeSnapshot,
  type ParsedPendingMedia,
} from '../src/react/in-flight-uploads-provider.js';

function makeAdapter(overrides: Partial<InFlightUploadsAdapter> = {}): InFlightUploadsAdapter {
  return {
    getCurrentUserId: () => 'user1',
    db: {},
    collectionPath: 'pendingMedia',
    listenerWindowMs: 60_000,
    parsePendingMedia: (raw: unknown) => raw as ParsedPendingMedia,
    onUploadCompleted: vi.fn(),
    onUploadFailed: vi.fn(),
    onUploadRejected: vi.fn(),
    onMonitoringEvent: vi.fn(),
    ...overrides,
  };
}

type DriverSnapshot = (snapshot: FirestoreLikeSnapshot) => void;
function makeDriver(): { subscribe: FirestoreSubscribeFn; drive: DriverSnapshot; driveError: (e: unknown) => void; unsubCalls: { count: number } } {
  let driver: DriverSnapshot | null = null;
  let errorDriver: ((e: unknown) => void) | null = null;
  const unsubCalls = { count: 0 };
  const subscribe: FirestoreSubscribeFn = (args) => {
    driver = args.onSnapshot;
    errorDriver = args.onError;
    return () => {
      unsubCalls.count += 1;
    };
  };
  const drive: DriverSnapshot = (snapshot) => {
    if (!driver) throw new Error('No active subscriber');
    driver(snapshot);
  };
  const driveError = (e: unknown) => {
    if (!errorDriver) throw new Error('No active subscriber');
    errorDriver(e);
  };
  return { subscribe, drive, driveError, unsubCalls };
}

/** A metadata-bearing snapshot (no doc changes) to drive source-state transitions. */
function metaSnapshot(fromCache: boolean): FirestoreLikeSnapshot {
  return { docChanges: () => [], metadata: { fromCache } };
}

function makeSnapshot(changes: Array<{ type: 'added' | 'modified' | 'removed'; id: string; data?: unknown }>): FirestoreLikeSnapshot {
  return {
    docChanges: () =>
      changes.map((c) => ({
        type: c.type,
        doc: { id: c.id, data: () => c.data ?? {} },
      })),
  };
}

function wrap(adapter: InFlightUploadsAdapter, subscribe: FirestoreSubscribeFn) {
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return (
      <InFlightUploadsProvider adapter={adapter} subscribe={subscribe}>
        {children}
      </InFlightUploadsProvider>
    );
  };
}

describe('InFlightUploadsProvider', () => {
  it('throws when read hooks used outside provider', () => {
    expect(() => renderHook(() => useInFlightUploadsState())).toThrow(/must be used within/);
    expect(() => renderHook(() => useInFlightUpload('x'))).toThrow(/must be used within/);
  });

  it('initial snapshot with already-terminal doc does NOT fire callbacks', () => {
    const adapter = makeAdapter();
    const { subscribe, drive } = makeDriver();
    renderHook(() => useInFlightUploadsState(), { wrapper: wrap(adapter, subscribe) });

    const parsed: ParsedPendingMedia = {
      id: 'doc1',
      userId: 'user1',
      fileOrigin: 'sample-origin',
      status: 'completed',
      createdAt: Date.now(),
      surface: '/uploads-demo',
      completedAt: Date.now(),
    };
    act(() => {
      drive(makeSnapshot([{ type: 'added', id: 'doc1', data: parsed }]));
    });

    expect(adapter.onUploadCompleted).not.toHaveBeenCalled();
    expect(adapter.onUploadFailed).not.toHaveBeenCalled();
    expect(adapter.onUploadRejected).not.toHaveBeenCalled();
  });

  it('fires onUploadCompleted on non-terminal â†’ terminal transition in a non-initial snapshot', () => {
    const adapter = makeAdapter();
    const { subscribe, drive } = makeDriver();
    renderHook(() => useInFlightUploadsState(), { wrapper: wrap(adapter, subscribe) });

    const base = { id: 'd1', userId: 'user1', fileOrigin: 'sample-origin', createdAt: Date.now(), surface: '/uploads-demo' };
    act(() => {
      drive(makeSnapshot([{ type: 'added', id: 'd1', data: { ...base, status: 'pending' } }]));
    });
    act(() => {
      drive(makeSnapshot([{ type: 'modified', id: 'd1', data: { ...base, status: 'completed', completedAt: Date.now() } }]));
    });

    expect(adapter.onUploadCompleted).toHaveBeenCalledTimes(1);
  });

  it('fires onUploadFailed and onUploadRejected on the matching transition', () => {
    const adapter = makeAdapter();
    const { subscribe, drive } = makeDriver();
    renderHook(() => useInFlightUploadsState(), { wrapper: wrap(adapter, subscribe) });

    const base = { id: 'd1', userId: 'user1', fileOrigin: 'sample-origin', createdAt: Date.now(), surface: '/uploads-demo' };
    act(() => {
      drive(makeSnapshot([{ type: 'added', id: 'd1', data: { ...base, status: 'pending' } }]));
    });
    act(() => {
      drive(
        makeSnapshot([
          { type: 'modified', id: 'd1', data: { ...base, status: 'failed', failedAt: Date.now(), errorCategory: 'storage', errorMessage: 'boom' } },
        ]),
      );
    });
    expect(adapter.onUploadFailed).toHaveBeenCalledTimes(1);
    expect(adapter.onUploadRejected).not.toHaveBeenCalled();

    const base2 = { id: 'd2', userId: 'user1', fileOrigin: 'sample-origin', createdAt: Date.now(), surface: '/uploads-demo' };
    act(() => {
      drive(makeSnapshot([{ type: 'added', id: 'd2', data: { ...base2, status: 'pending' } }]));
    });
    act(() => {
      drive(
        makeSnapshot([
          { type: 'modified', id: 'd2', data: { ...base2, status: 'rejected', rejectedAt: Date.now(), rejectionType: 'media', errorMessage: 'nope' } },
        ]),
      );
    });
    expect(adapter.onUploadRejected).toHaveBeenCalledTimes(1);
  });

  it('parse errors route to onMonitoringEvent with type "parse-error" and do not crash', () => {
    const parser = vi.fn(() => {
      throw new Error('bad doc');
    });
    const adapter = makeAdapter({ parsePendingMedia: parser });
    const { subscribe, drive } = makeDriver();
    renderHook(() => useInFlightUploadsState(), { wrapper: wrap(adapter, subscribe) });

    act(() => {
      drive(makeSnapshot([{ type: 'added', id: 'd1', data: { junk: true } }]));
    });

    expect(adapter.onMonitoringEvent).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'parse-error', docId: 'd1' }),
    );
    expect(adapter.onUploadCompleted).not.toHaveBeenCalled();
  });

  it('records breadcrumb on every observed terminal transition', () => {
    const adapter = makeAdapter();
    const { subscribe, drive } = makeDriver();
    renderHook(() => useInFlightUploadsState(), { wrapper: wrap(adapter, subscribe) });

    const base = { id: 'd1', userId: 'user1', fileOrigin: 'sample-origin', createdAt: Date.now(), surface: '/uploads-demo' };
    act(() => {
      drive(makeSnapshot([{ type: 'added', id: 'd1', data: { ...base, status: 'pending' } }]));
    });
    act(() => {
      drive(makeSnapshot([{ type: 'modified', id: 'd1', data: { ...base, status: 'completed', completedAt: Date.now() } }]));
    });

    const breadcrumbs = (adapter.onMonitoringEvent as ReturnType<typeof vi.fn>).mock.calls
      .map((c) => c[0])
      .filter((e: { type: string }) => e.type === 'breadcrumb');
    expect(breadcrumbs).toHaveLength(1);
  });

  it('removes uploads from state when doc type is "removed"', () => {
    const adapter = makeAdapter();
    const { subscribe, drive } = makeDriver();
    const { result } = renderHook(() => useInFlightUploadsState(), { wrapper: wrap(adapter, subscribe) });

    const base = { id: 'd1', userId: 'user1', fileOrigin: 'sample-origin', createdAt: Date.now(), surface: '/uploads-demo' };
    act(() => {
      drive(makeSnapshot([{ type: 'added', id: 'd1', data: { ...base, status: 'pending' } }]));
    });
    expect(result.current.size).toBe(1);

    act(() => {
      drive(makeSnapshot([{ type: 'removed', id: 'd1' }]));
    });
    expect(result.current.size).toBe(0);
  });

  it('unsubscribes on user sign-out (userId â†’ null)', () => {
    let currentUserId: string | null = 'user1';
    const adapter = makeAdapter({ getCurrentUserId: () => currentUserId });
    const { subscribe, drive: _drive, unsubCalls } = makeDriver();
    void _drive;
    const { rerender } = renderHook(() => useInFlightUploadsState(), { wrapper: wrap(adapter, subscribe) });

    expect(unsubCalls.count).toBe(0);
    currentUserId = null;
    rerender();
    expect(unsubCalls.count).toBe(1);
  });

  it('resets in-memory state on UID-A â†’ UID-B transition without an intermediate null', () => {
    let currentUserId: string | null = 'userA';
    const adapter = makeAdapter({ getCurrentUserId: () => currentUserId });
    const { subscribe, drive } = makeDriver();
    const { result, rerender } = renderHook(() => useInFlightUploadsState(), {
      wrapper: wrap(adapter, subscribe),
    });

    // UID-A: seed a terminal doc so seenTerminalIdsRef / statusByIdRef have content.
    act(() => {
      drive(
        makeSnapshot([
          {
            type: 'added',
            id: 'docA',
            data: {
              id: 'docA',
              userId: 'userA',
              fileOrigin: 'sample-origin',
              status: 'completed',
              createdAt: Date.now(),
              completedAt: Date.now(),
              surface: '/x',
            },
          },
        ]),
      );
    });
    expect(result.current.get('docA')).toBeDefined();

    // UID-A â†’ UID-B (no intermediate null).
    currentUserId = 'userB';
    rerender();

    // After the transition, the uploads map must be empty (UID-A's docA is gone).
    expect(result.current.size).toBe(0);

    // And UID-B's initial snapshot must be treated as initial â€” drive a
    // terminal doc and confirm the completion callback does NOT fire
    // (initial-snapshot suppression is back in effect).
    act(() => {
      drive(
        makeSnapshot([
          {
            type: 'added',
            id: 'docB',
            data: {
              id: 'docB',
              userId: 'userB',
              fileOrigin: 'sample-origin',
              status: 'completed',
              createdAt: Date.now(),
              completedAt: Date.now(),
              surface: '/x',
            },
          },
        ]),
      );
    });
    expect(adapter.onUploadCompleted).not.toHaveBeenCalled();
  });

  it('useUploadActivityState filters cleared terminal items and sorts newest first', () => {
    const adapter = makeAdapter();
    const { subscribe, drive } = makeDriver();
    const { result } = renderHook(() => useUploadActivityState(), { wrapper: wrap(adapter, subscribe) });

    act(() => {
      drive(
        makeSnapshot([
          { type: 'added', id: 'a', data: { id: 'a', userId: 'user1', fileOrigin: 'sample-origin', status: 'pending', createdAt: 100, surface: '/x' } },
          { type: 'added', id: 'b', data: { id: 'b', userId: 'user1', fileOrigin: 'sample-origin', status: 'pending', createdAt: 300, surface: '/x' } },
          { type: 'added', id: 'c', data: { id: 'c', userId: 'user1', fileOrigin: 'sample-origin', status: 'completed', createdAt: 200, surface: '/x', completedAt: 250, uploadTrayClearedAt: 260 } },
        ]),
      );
    });

    expect(result.current.map((u) => u.id)).toEqual(['b', 'a']);
  });
});

describe('InFlightUploadsProvider — rejected seen fields (round-9 finding 9)', () => {
  it('carries uploadTraySeenAt/By through fromParsed on the rejected branch', () => {
    const adapter = makeAdapter();
    const { subscribe, drive } = makeDriver();
    const { result } = renderHook(() => useInFlightUpload('r1'), { wrapper: wrap(adapter, subscribe) });

    act(() => {
      drive(
        makeSnapshot([
          {
            type: 'added',
            id: 'r1',
            data: {
              id: 'r1',
              userId: 'user1',
              fileOrigin: 'sample-origin',
              status: 'rejected',
              createdAt: 100,
              surface: '/x',
              rejectedAt: 110,
              rejectionType: 'media',
              errorMessage: 'nope',
              uploadTraySeenAt: 120,
              uploadTraySeenBy: 'user1',
            },
          },
        ]),
      );
    });

    const upload = result.current;
    expect(upload?.status).toBe('rejected');
    // Before the fix these were dropped → a seen rejected upload relit the Files dot forever.
    expect(upload).toMatchObject({ uploadTraySeenAt: 120, uploadTraySeenBy: 'user1' });
  });
});

describe('InFlightUploadsProvider — source state', () => {
  it('starts connecting and goes live on a server-confirmed snapshot', () => {
    const adapter = makeAdapter();
    const { subscribe, drive } = makeDriver();
    const { result } = renderHook(() => useUploadsSourceState(), { wrapper: wrap(adapter, subscribe) });

    expect(result.current).toBe('connecting');
    act(() => drive(metaSnapshot(false)));
    expect(result.current).toBe('live');
  });

  it('stays connecting on a cache-first snapshot until the server confirms', () => {
    const adapter = makeAdapter();
    const { subscribe, drive } = makeDriver();
    const { result } = renderHook(() => useUploadsSourceState(), { wrapper: wrap(adapter, subscribe) });

    act(() => drive(metaSnapshot(true)));
    expect(result.current).toBe('connecting');
    act(() => drive(metaSnapshot(false)));
    expect(result.current).toBe('live');
  });

  it('goes offline after live when only cached data arrives, then back to live', () => {
    const adapter = makeAdapter();
    const { subscribe, drive } = makeDriver();
    const { result } = renderHook(() => useUploadsSourceState(), { wrapper: wrap(adapter, subscribe) });

    act(() => drive(metaSnapshot(false)));
    expect(result.current).toBe('live');
    act(() => drive(metaSnapshot(true)));
    expect(result.current).toBe('offline');
    act(() => drive(metaSnapshot(false)));
    expect(result.current).toBe('live');
  });

  it('a listener error RETRIES (connecting) instead of going terminal — see the resubscribe describe', () => {
    vi.useFakeTimers();
    try {
      const adapter = makeAdapter();
      const { subscribe, drive, driveError } = makeDriver();
      const { result } = renderHook(() => useUploadsSourceState(), { wrapper: wrap(adapter, subscribe) });

      act(() => drive(metaSnapshot(false)));
      act(() => driveError(new Error('permission-denied')));
      expect(result.current).toBe('connecting');
    } finally {
      vi.useRealTimers();
    }
  });

  it('resets to connecting when the user identity changes', () => {
    let currentUserId: string | null = 'userA';
    const adapter = makeAdapter({ getCurrentUserId: () => currentUserId });
    const { subscribe, drive } = makeDriver();
    const { result, rerender } = renderHook(() => useUploadsSourceState(), { wrapper: wrap(adapter, subscribe) });

    act(() => drive(metaSnapshot(false)));
    expect(result.current).toBe('live');

    currentUserId = 'userB';
    rerender();
    expect(result.current).toBe('connecting');
  });
});

describe('bounded resubscribe on listener error', () => {
  it('retries after an error (connecting, new subscription) and recovers to live', () => {
    vi.useFakeTimers();
    try {
      const adapter = makeAdapter();
      const d = makeDriver();
      let subscribeCount = 0;
      const countingSubscribe: FirestoreSubscribeFn = (args) => {
        subscribeCount += 1;
        return d.subscribe(args);
      };
      const { result } = renderHook(() => useUploadsSourceState(), {
        wrapper: wrap(adapter, countingSubscribe),
      });
      expect(subscribeCount).toBe(1);

      // Cold-session race (e.g. App Check enforcement before the token mints).
      act(() => d.driveError(new Error('permission-denied')));
      expect(result.current).toBe('connecting'); // retrying, NOT terminal

      act(() => {
        vi.advanceTimersByTime(1_000);
      });
      expect(subscribeCount).toBe(2);

      act(() => d.drive(metaSnapshot(false)));
      expect(result.current).toBe('live');
    } finally {
      vi.useRealTimers();
    }
  });

  it('goes terminal error only after exhausting the retry ladder', () => {
    vi.useFakeTimers();
    try {
      const adapter = makeAdapter();
      const d = makeDriver();
      const { result } = renderHook(() => useUploadsSourceState(), {
        wrapper: wrap(adapter, d.subscribe),
      });
      for (const ms of [1_000, 3_000, 10_000, 30_000]) {
        act(() => d.driveError(new Error('denied')));
        expect(result.current).toBe('connecting');
        act(() => {
          vi.advanceTimersByTime(ms);
        });
      }
      // Fifth consecutive error: ladder exhausted → terminal.
      act(() => d.driveError(new Error('denied')));
      expect(result.current).toBe('error');
    } finally {
      vi.useRealTimers();
    }
  });
});
