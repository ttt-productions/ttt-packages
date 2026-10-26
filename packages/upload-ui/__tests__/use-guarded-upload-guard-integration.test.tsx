import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import React from 'react';
import type { FirebaseStorage } from 'firebase/storage';
import type { uploadFileResumable } from '@ttt-productions/upload-core/browser';
import type { UploadFileResumableResult } from '@ttt-productions/upload-core';

// Mocks must precede the component imports.

const uploadFileResumableMock = vi.fn<typeof uploadFileResumable>();
const UPLOADED: UploadFileResumableResult = {
  fullPath: 'uploads/a',
  contentType: 'image/jpeg',
  size: 1,
};
vi.mock('@ttt-productions/upload-core/browser', async (importOriginal) => {
  const { passThroughModule } = await import('../../../test/typed-mock.js');
  return passThroughModule<typeof import('@ttt-productions/upload-core/browser')>(importOriginal, {
    uploadFileResumable: (...args) => uploadFileResumableMock(...args),
  });
});

import { useGuardedUpload } from '../src/react/upload/use-guarded-upload.js';
import {
  LocalUploadGuardProvider,
  useLocalUploadGuard,
} from '../src/react/guard/local-upload-guard-provider.js';

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
    storage: {} as FirebaseStorage,
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
      () =>
        new Promise<UploadFileResumableResult>((resolve) => {
          resolveUpload = () => resolve(UPLOADED);
        }),
    );

    const { result } = renderHook(() => useGuardedUploadAndCount(), { wrapper });
    expect(result.current.activeUploadCount).toBe(0);

    let uploadDone: Promise<void> | undefined;
    act(() => {
      uploadDone = result.current.guarded(makeArgs());
    });

    expect(result.current.activeUploadCount).toBe(1);

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
      await expect(result.current.guarded(makeArgs())).rejects.toThrow('boom');
    });

    expect(result.current.activeUploadCount).toBe(0);
  });

  it('unregisters the upload when the signal is aborted', async () => {
    const abortErr = Object.assign(new Error('aborted'), { name: 'AbortError' });
    uploadFileResumableMock.mockRejectedValueOnce(abortErr);

    const controller = new AbortController();
    const { result } = renderHook(() => useGuardedUploadAndCount(), { wrapper });

    await act(async () => {
      await expect(result.current.guarded(makeArgs({ signal: controller.signal }))).rejects.toBe(
        abortErr,
      );
    });

    expect(result.current.activeUploadCount).toBe(0);
  });

  it('unregisters even when two concurrent uploads finish in different orders', async () => {
    let resolveA!: () => void;
    let resolveB!: () => void;

    uploadFileResumableMock
      .mockImplementationOnce(
        () =>
          new Promise<UploadFileResumableResult>((resolve) => {
            resolveA = () => resolve(UPLOADED);
          }),
      )
      .mockImplementationOnce(
        () =>
          new Promise<UploadFileResumableResult>((resolve) => {
            resolveB = () => resolve(UPLOADED);
          }),
      );

    const { result } = renderHook(() => useGuardedUploadAndCount(), { wrapper });

    let doneA: Promise<void> | undefined;
    let doneB: Promise<void> | undefined;

    act(() => {
      doneA = result.current.guarded(makeArgs({ uploadId: 'a' }));
      doneB = result.current.guarded(makeArgs({ uploadId: 'b' }));
    });

    expect(result.current.activeUploadCount).toBe(2);

    await act(async () => {
      resolveB();
      await doneB;
    });
    expect(result.current.activeUploadCount).toBe(1);

    await act(async () => {
      resolveA();
      await doneA;
    });
    expect(result.current.activeUploadCount).toBe(0);
  });
});
