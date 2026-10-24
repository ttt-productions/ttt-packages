import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest';
import type { FirebaseStorage } from 'firebase/storage';
import type { upsertUploadSession } from '../src/utils/upload-store.js';

// Mocks must precede the component imports.

const upsertUploadSessionMock = vi.fn<typeof upsertUploadSession>();
vi.mock('../src/utils/upload-store.js', () => ({
  upsertUploadSession: (...args: Parameters<typeof upsertUploadSession>) =>
    upsertUploadSessionMock(...args),
}));

const getDownloadURLMock = vi.hoisted(() => vi.fn(async () => 'https://example.com/test.jpg'));

type UploadObservers = {
  progress?: (snap: unknown) => void;
  error?: (err: unknown) => void;
  complete?: () => void;
};

type FakeUploadTask = {
  cancel: Mock<() => void>;
  pause: Mock<() => boolean>;
  resume: Mock<() => boolean>;
  snapshot: {
    ref: { fullPath: string };
    metadata: { contentType: string };
    totalBytes: number;
  };
  on: Mock<
    (
      event: string,
      onProgress: UploadObservers['progress'],
      onError: UploadObservers['error'],
      onComplete: UploadObservers['complete'],
    ) => () => void
  >;
};

let lastTask: FakeUploadTask | null = null;
let lastObservers: UploadObservers = {};

function startedTask(): FakeUploadTask {
  if (!lastTask) throw new Error('no upload task was started');
  return lastTask;
}

vi.mock('firebase/storage', () => ({
  ref: vi.fn((_storage: unknown, path: string) => ({ fullPath: path })),
  uploadBytesResumable: vi.fn((_ref: unknown, _file: unknown, _meta: unknown) => {
    const task: FakeUploadTask = {
      cancel: vi.fn<() => void>(),
      pause: vi.fn(() => true),
      resume: vi.fn(() => true),
      snapshot: {
        ref: { fullPath: 'tmp/test.jpg' },
        metadata: { contentType: 'image/jpeg' },
        totalBytes: 1,
      },
      on: vi.fn((_event, onProgress, onError, onComplete) => {
        lastObservers = { progress: onProgress, error: onError, complete: onComplete };
        return () => {};
      }),
    };
    lastTask = task;
    return task;
  }),
  getDownloadURL: getDownloadURLMock,
}));

import { startResumableUpload, uploadFileResumable } from '../src/browser/upload.js';

beforeEach(() => {
  upsertUploadSessionMock.mockReset();
  lastTask = null;
  lastObservers = {};
});

function storageCanceledError() {
  return Object.assign(
    new Error('Firebase Storage: User canceled the upload/download. (storage/canceled)'),
    {
      code: 'storage/canceled',
    },
  );
}

function makeFile() {
  // Blob.type is read-only in Node; the source reads only file.size, and contentType rides
  // args.metadata.
  return new Blob(['x']);
}

function makeArgs(overrides: Record<string, unknown> = {}) {
  return {
    id: 'upl_test',
    storage: {} as FirebaseStorage,
    path: 'tmp/test.jpg',
    file: makeFile(),
    metadata: { contentType: 'image/jpeg' },
    ...overrides,
  };
}

describe('startResumableUpload — abort behavior', () => {
  it('calls task.cancel() immediately when signal is already aborted at call time', () => {
    const controller = new AbortController();
    controller.abort();

    startResumableUpload({ ...makeArgs(), signal: controller.signal });

    expect(startedTask().cancel).toHaveBeenCalledOnce();
  });

  it('calls task.cancel() when signal aborts mid-upload', () => {
    const controller = new AbortController();

    startResumableUpload({ ...makeArgs(), signal: controller.signal });

    expect(startedTask().cancel).not.toHaveBeenCalled();

    controller.abort();

    expect(startedTask().cancel).toHaveBeenCalledOnce();
  });

  it('classifies AbortError as canceled in the upload-store', async () => {
    const controller = new AbortController();
    const c = startResumableUpload({ ...makeArgs(), signal: controller.signal });
    // done rejects with the failure; the case reads the upload-store instead.
    c.done.catch(() => {});

    await lastObservers.error!(new DOMException('aborted', 'AbortError'));

    expect(upsertUploadSessionMock).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'canceled' }),
    );
  });

  it('classifies non-Abort errors as error in the upload-store', async () => {
    const controller = new AbortController();
    const c = startResumableUpload({ ...makeArgs(), signal: controller.signal });
    // done rejects with the failure; the case reads the upload-store instead.
    c.done.catch(() => {});

    await lastObservers.error!(new Error('network failure'));

    expect(upsertUploadSessionMock).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'error' }),
    );
  });

  it('abort after completion does not call task.cancel() a second time', async () => {
    const controller = new AbortController();
    const c = startResumableUpload({ ...makeArgs(), signal: controller.signal });

    await lastObservers.complete!();
    await c.done;

    const callsBefore = startedTask().cancel.mock.calls.length;

    controller.abort();

    expect(startedTask().cancel.mock.calls.length).toBe(callsBefore);
  });

  it('rejects with the canonical AbortError when the SDK reports storage/canceled after the signal aborted', async () => {
    const controller = new AbortController();
    const c = startResumableUpload({ ...makeArgs(), signal: controller.signal });
    const outcome = c.done.then(
      () => null,
      (e: unknown) => e,
    );

    controller.abort();
    await lastObservers.error!(storageCanceledError());

    const err = await outcome;
    expect(err).toBeInstanceOf(DOMException);
    expect((err as DOMException).name).toBe('AbortError');
    expect(upsertUploadSessionMock).toHaveBeenLastCalledWith(
      expect.objectContaining({ status: 'canceled' }),
    );
  });

  it('treats storage/canceled from the controller cancel() as the canonical cancel', async () => {
    const c = startResumableUpload(makeArgs());
    const outcome = c.done.then(
      () => null,
      (e: unknown) => e,
    );

    c.cancel();
    await lastObservers.error!(storageCanceledError());

    expect(((await outcome) as DOMException).name).toBe('AbortError');
    expect(upsertUploadSessionMock).toHaveBeenLastCalledWith(
      expect.objectContaining({ status: 'canceled' }),
    );
  });

  it('keeps a storage/canceled the upload did not ask for as a real error', async () => {
    const controller = new AbortController();
    const c = startResumableUpload({ ...makeArgs(), signal: controller.signal });
    const outcome = c.done.then(
      () => null,
      (e: unknown) => e,
    );
    const remote = storageCanceledError();

    await lastObservers.error!(remote);

    expect(await outcome).toBe(remote);
    expect(upsertUploadSessionMock).toHaveBeenLastCalledWith(
      expect.objectContaining({ status: 'error' }),
    );
  });

  it('resolves the path, content type, and size without minting a download URL', async () => {
    const c = startResumableUpload(makeArgs());

    await lastObservers.complete!();

    await expect(c.done).resolves.toEqual({
      fullPath: 'tmp/test.jpg',
      contentType: 'image/jpeg',
      size: 1,
    });
    expect(getDownloadURLMock).not.toHaveBeenCalled();
  });

  it('uploadFileResumable rejects when contentType metadata is missing', async () => {
    await expect(
      uploadFileResumable({
        storage: {} as FirebaseStorage,
        path: 'x',
        file: makeFile(),
        metadata: { contentType: '' },
      }),
    ).rejects.toThrow(/contentType/i);
  });
});
