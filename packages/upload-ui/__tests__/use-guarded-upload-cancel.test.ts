import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import React from 'react';
import type { FirebaseStorage } from 'firebase/storage';
import type { uploadFileResumable } from '@ttt-productions/upload-core/browser';
import type { UploadFileResumableResult } from '@ttt-productions/upload-core';
import type { UploadState } from '@ttt-productions/media-schemas';

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
import { LocalUploadGuardProvider } from '../src/react/guard/local-upload-guard-provider.js';

function wrapper({ children }: { children: React.ReactNode }) {
  return React.createElement(LocalUploadGuardProvider, null, children);
}

function makeArgs(overrides: Partial<Parameters<ReturnType<typeof useGuardedUpload>>[0]> = {}) {
  return {
    storage: {} as FirebaseStorage,
    path: 'tmp/test.jpg',
    file: new File(['x'], 'test.jpg', { type: 'image/jpeg' }),
    metadata: { contentType: 'image/jpeg' },
    uploadId: 'upl_test_1',
    ...overrides,
  };
}

describe('useGuardedUpload — AbortSignal threading', () => {
  beforeEach(() => {
    uploadFileResumableMock.mockReset();
  });

  it('passes signal through to uploadFileResumable', async () => {
    uploadFileResumableMock.mockResolvedValueOnce(UPLOADED);
    const controller = new AbortController();
    const { result } = renderHook(() => useGuardedUpload(), { wrapper });

    await act(async () => {
      await result.current(makeArgs({ signal: controller.signal }));
    });

    expect(uploadFileResumableMock).toHaveBeenCalledOnce();
    const [callArgs] = uploadFileResumableMock.mock.calls[0];
    expect(callArgs.signal).toBe(controller.signal);
  });

  it('rejects with AbortError when the signal is aborted mid-upload', async () => {
    const abortErr = Object.assign(new Error('aborted'), { name: 'AbortError' });
    uploadFileResumableMock.mockRejectedValueOnce(abortErr);
    const controller = new AbortController();
    const { result } = renderHook(() => useGuardedUpload(), { wrapper });

    await expect(
      act(async () => {
        await result.current(makeArgs({ signal: controller.signal }));
      }),
    ).rejects.toMatchObject({ name: 'AbortError' });
  });

  it('reports preparing phase before uploadFileResumable is called, never reports finalizing on abort', async () => {
    const abortErr = Object.assign(new Error('aborted'), { name: 'AbortError' });
    uploadFileResumableMock.mockRejectedValueOnce(abortErr);
    const onProgress = vi.fn<(state: UploadState | null) => void>();
    const controller = new AbortController();
    const { result } = renderHook(() => useGuardedUpload(), { wrapper });

    await expect(
      act(async () => {
        await result.current(makeArgs({ signal: controller.signal, onProgress }));
      }),
    ).rejects.toMatchObject({ name: 'AbortError' });

    const phases = onProgress.mock.calls.map((c) => c[0]?.phase);
    expect(phases).toContain('preparing');
    expect(phases).not.toContain('finalizing');
  });

  it('still reports finalizing on successful upload (signal present but never aborted)', async () => {
    uploadFileResumableMock.mockResolvedValueOnce(UPLOADED);
    const onProgress = vi.fn<(state: UploadState | null) => void>();
    const controller = new AbortController();
    const { result } = renderHook(() => useGuardedUpload(), { wrapper });

    await act(async () => {
      await result.current(makeArgs({ signal: controller.signal, onProgress }));
    });

    const phases = onProgress.mock.calls.map((c) => c[0]?.phase);
    expect(phases).toContain('preparing');
    expect(phases).toContain('finalizing');
  });

  it('works without a signal', async () => {
    uploadFileResumableMock.mockResolvedValueOnce(UPLOADED);
    const { result } = renderHook(() => useGuardedUpload(), { wrapper });

    await act(async () => {
      await result.current(makeArgs());
    });

    const [callArgs] = uploadFileResumableMock.mock.calls[0];
    expect(callArgs.signal).toBeUndefined();
  });
});
