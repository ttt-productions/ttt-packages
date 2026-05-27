import { describe, it, expect, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import React from 'react';
import {
  InFlightUploadsProvider,
  type InFlightUploadsAdapter,
  type FirestoreSubscribeFn,
  type FirestoreLikeSnapshot,
  type ParsedPendingMedia,
} from '../src/react/in-flight-uploads-provider.js';
import { useUploadProcessing } from '../src/react/use-upload-processing.js';

function makeAdapter(): InFlightUploadsAdapter {
  return {
    getCurrentUserId: () => 'user1',
    db: {},
    collectionPath: 'pendingMedia',
    listenerWindowMs: 60_000,
    parsePendingMedia: (raw) => raw as ParsedPendingMedia,
    onUploadCompleted: vi.fn(),
    onUploadFailed: vi.fn(),
    onUploadRejected: vi.fn(),
    onMonitoringEvent: vi.fn(),
  };
}

function makeDriver() {
  let driver: ((s: FirestoreLikeSnapshot) => void) | null = null;
  const subscribe: FirestoreSubscribeFn = (args) => {
    driver = args.onSnapshot;
    return () => {};
  };
  const drive = (changes: Array<{ type: 'added' | 'modified' | 'removed'; id: string; data?: unknown }>) => {
    if (!driver) throw new Error('No subscriber');
    driver({
      docChanges: () =>
        changes.map((c) => ({ type: c.type, doc: { id: c.id, data: () => c.data ?? {} } })),
    });
  };
  return { subscribe, drive };
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

describe('useUploadProcessing', () => {
  it('returns idle when no upload exists', () => {
    const adapter = makeAdapter();
    const { subscribe } = makeDriver();
    const { result } = renderHook(() => useUploadProcessing(null), { wrapper: wrap(adapter, subscribe) });
    expect(result.current.status).toBe('idle');
    expect(result.current.isProcessing).toBe(false);
  });

  it('returns processing state for a pending upload', () => {
    const adapter = makeAdapter();
    const { subscribe, drive } = makeDriver();
    const { result } = renderHook(() => useUploadProcessing('d1'), { wrapper: wrap(adapter, subscribe) });
    act(() => {
      drive([{ type: 'added', id: 'd1', data: { id: 'd1', userId: 'user1', fileOrigin: 'sample-origin', status: 'pending', createdAt: Date.now(), surface: '/x' } }]);
    });
    expect(result.current.isProcessing).toBe(true);
    expect(result.current.status).toBe('pending');
  });

  it('fires onTerminal once on completed transition', () => {
    const adapter = makeAdapter();
    const { subscribe, drive } = makeDriver();
    const onTerminal = vi.fn();
    renderHook(() => useUploadProcessing('d1', onTerminal), { wrapper: wrap(adapter, subscribe) });
    const base = { id: 'd1', userId: 'user1', fileOrigin: 'sample-origin', createdAt: Date.now(), surface: '/x' };
    act(() => {
      drive([{ type: 'added', id: 'd1', data: { ...base, status: 'pending' } }]);
    });
    act(() => {
      drive([{ type: 'modified', id: 'd1', data: { ...base, status: 'completed', completedAt: Date.now() } }]);
    });
    expect(onTerminal).toHaveBeenCalledTimes(1);
    expect(onTerminal.mock.calls[0][0]).toMatchObject({ status: 'success', isComplete: true });
  });

  it('does not re-fire onTerminal on repeated terminal updates', () => {
    const adapter = makeAdapter();
    const { subscribe, drive } = makeDriver();
    const onTerminal = vi.fn();
    renderHook(() => useUploadProcessing('d1', onTerminal), { wrapper: wrap(adapter, subscribe) });
    const base = { id: 'd1', userId: 'user1', fileOrigin: 'sample-origin', createdAt: Date.now(), surface: '/x' };
    act(() => {
      drive([{ type: 'added', id: 'd1', data: { ...base, status: 'pending' } }]);
    });
    act(() => {
      drive([{ type: 'modified', id: 'd1', data: { ...base, status: 'completed', completedAt: Date.now() } }]);
    });
    act(() => {
      drive([{ type: 'modified', id: 'd1', data: { ...base, status: 'completed', completedAt: Date.now(), uploadTrayClearedAt: Date.now() } }]);
    });
    expect(onTerminal).toHaveBeenCalledTimes(1);
  });

  it('supports message overrides', () => {
    const adapter = makeAdapter();
    const { subscribe, drive } = makeDriver();
    const { result } = renderHook(() => useUploadProcessing('d1', undefined, { processingMessage: 'Working on it...' }), {
      wrapper: wrap(adapter, subscribe),
    });
    act(() => {
      drive([{ type: 'added', id: 'd1', data: { id: 'd1', userId: 'user1', fileOrigin: 'sample-origin', status: 'pending', createdAt: Date.now(), surface: '/x' } }]);
    });
    expect(result.current.message).toBe('Working on it...');
  });
});
