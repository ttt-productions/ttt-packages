import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import React from 'react';

// --- mocks (must precede component imports) ---

const uploadFileResumableMock = vi.fn();
vi.mock('@ttt-productions/upload-core/browser', () => ({
  uploadFileResumable: (args: any) => uploadFileResumableMock(args),
}));

// --- imports after mocks ---

import { useGuardedUpload } from '../src/react/use-guarded-upload.js';
import {
  LocalUploadGuardProvider,
  useLocalUploadGuard,
} from '../src/react/local-upload-guard-provider.js';

function wrapper({ children }: { children: React.ReactNode }) {
  return React.createElement(LocalUploadGuardProvider, null, children);
}

function useGuardedUploadAndCount() {
  const guarded = useGuardedUpload();
  const { activeUploadCount } = useLocalUploadGuard();
  return { guarded, activeUploadCount };
}

function makeArgs(overrides: Record<string, unknown> = {}) {
  return {
    storage: {} as any,
    path: 'tmp/test.jpg',
    file: new File(['x'], 'test.jpg', { type: 'image/jpeg' }),
    metadata: { contentType: 'image/jpeg' },
    uploadId: 'upl_test',
    ...overrides,
  };
}

beforeEach(() => {
  uploadFileResumableMock.mockReset();
});

describe('useGuardedUpload — guard provider integration', () => {
  it('registers the upload before uploadFileResumable runs and unregisters after success', async () => {
    let resolveUpload!: () => void;
    uploadFileResumableMock.mockImplementation(
      () => new Promise<void>((resolve) => { resolveUpload = resolve; }),
    );

    const { result } = renderHook(() => useGuardedUploadAndCount(), { wrapper });
    expect(result.current.activeUploadCount).toBe(0);

    // Start the upload without awaiting — let it hang
    let uploadDone: Promise<void> | undefined;
    act(() => {
      uploadDone = result.current.guarded(makeArgs());
    });

    // Count should be 1 while upload is in flight
    expect(result.current.activeUploadCount).toBe(1);

    // Resolve the upload and flush
    await act(async () => {
      resolveUpload();
      await uploadDone;
    });

    expect(result.current.activeUploadCount).toBe(0);
    expect(uploadFileResumableMock).toHaveBeenCalledOnce();
  });

  it('unregisters the upload when uploadFileResumable rejects', async () => {
    uploadFileResumableMock.mockRejectedValueOnce(new Error('boom'));

    const { result } = renderHook(() => useGuardedUploadAndCount(), { wrapper });

    await act(async () => {
      await result.current.guarded(makeArgs()).catch(() => {});
    });

    expect(result.current.activeUploadCount).toBe(0);
  });

  it('unregisters the upload when the signal is aborted', async () => {
    const abortErr = Object.assign(new Error('aborted'), { name: 'AbortError' });
    uploadFileResumableMock.mockRejectedValueOnce(abortErr);

    const controller = new AbortController();
    const { result } = renderHook(() => useGuardedUploadAndCount(), { wrapper });

    await act(async () => {
      await result.current.guarded(makeArgs({ signal: controller.signal })).catch(() => {});
    });

    expect(result.current.activeUploadCount).toBe(0);
  });

  it('unregisters even when two concurrent uploads finish in different orders', async () => {
    let resolveA!: () => void;
    let resolveB!: () => void;

    uploadFileResumableMock
      .mockImplementationOnce(
        () => new Promise<void>((resolve) => { resolveA = resolve; }),
      )
      .mockImplementationOnce(
        () => new Promise<void>((resolve) => { resolveB = resolve; }),
      );

    const { result } = renderHook(() => useGuardedUploadAndCount(), { wrapper });

    let doneA: Promise<void> | undefined;
    let doneB: Promise<void> | undefined;

    act(() => {
      doneA = result.current.guarded(makeArgs({ uploadId: 'a' }));
      doneB = result.current.guarded(makeArgs({ uploadId: 'b' }));
    });

    expect(result.current.activeUploadCount).toBe(2);

    // Resolve B first
    await act(async () => {
      resolveB();
      await doneB;
    });
    expect(result.current.activeUploadCount).toBe(1);

    // Then resolve A
    await act(async () => {
      resolveA();
      await doneA;
    });
    expect(result.current.activeUploadCount).toBe(0);
  });
});
