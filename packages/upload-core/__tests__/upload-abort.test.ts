import { describe, it, expect, vi, beforeEach } from 'vitest';

// --- mocks (must precede component imports) ---

const upsertUploadSessionMock = vi.fn();
vi.mock('../src/utils/upload-store.js', () => ({
  upsertUploadSession: (s: unknown) => upsertUploadSessionMock(s),
}));

const getDownloadURLMock = vi.hoisted(() => vi.fn(async () => 'https://example.com/test.jpg'));

let lastTask: any = null;
let lastObservers: {
  progress?: (snap: any) => void;
  error?: (err: any) => void;
  complete?: () => void;
} = {};

vi.mock('firebase/storage', () => ({
  ref: vi.fn((_storage: unknown, path: string) => ({ fullPath: path })),
  uploadBytesResumable: vi.fn((_ref: unknown, _file: unknown, _meta: unknown) => {
    const task = {
      cancel: vi.fn(),
      pause: vi.fn(() => true),
      resume: vi.fn(() => true),
      snapshot: {
        ref: { fullPath: 'tmp/test.jpg' },
        metadata: { contentType: 'image/jpeg' },
        totalBytes: 1,
      },
      on: vi.fn((_event: string, onProgress: any, onError: any, onComplete: any) => {
        lastObservers = { progress: onProgress, error: onError, complete: onComplete };
        return () => {};
      }),
    };
    lastTask = task;
    return task;
  }),
  getDownloadURL: getDownloadURLMock,
}));

import { startResumableUpload, uploadFileResumable } from '../src/storage/upload.js';

beforeEach(() => {
  upsertUploadSessionMock.mockReset();
  lastTask = null;
  lastObservers = {};
});

/** The error shape the Storage SDK rejects a cancelled upload task with. */
function storageCanceledError() {
  return Object.assign(new Error('Firebase Storage: User canceled the upload/download. (storage/canceled)'), {
    code: 'storage/canceled',
  });
}

function makeFile() {
  // Node environment: Blob.type is read-only so we can't assign it.
  // The source only reads file.size (via getFileSize), not file.type.
  // contentType is passed separately via args.metadata.
  return new Blob(['x']);
}

function makeArgs(overrides: Record<string, unknown> = {}) {
  return {
    id: 'upl_test',
    storage: {} as any,
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

    expect(lastTask.cancel).toHaveBeenCalledOnce();
  });

  it('calls task.cancel() when signal aborts mid-upload', () => {
    const controller = new AbortController();

    startResumableUpload({ ...makeArgs(), signal: controller.signal });

    expect(lastTask.cancel).not.toHaveBeenCalled();

    controller.abort();

    expect(lastTask.cancel).toHaveBeenCalledOnce();
  });

  it('classifies AbortError as canceled in the upload-store', async () => {
    const controller = new AbortController();
    const c = startResumableUpload({ ...makeArgs(), signal: controller.signal });
    c.done.catch(() => {});

    await lastObservers.error!(new DOMException('aborted', 'AbortError'));

    expect(upsertUploadSessionMock).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'canceled' }),
    );
  });

  it('classifies non-Abort errors as error in the upload-store', async () => {
    const controller = new AbortController();
    const c = startResumableUpload({ ...makeArgs(), signal: controller.signal });
    c.done.catch(() => {});

    await lastObservers.error!(new Error('network failure'));

    expect(upsertUploadSessionMock).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'error' }),
    );
  });

  it('abort after completion does not call task.cancel() a second time', async () => {
    const controller = new AbortController();
    const c = startResumableUpload({ ...makeArgs(), signal: controller.signal });

    // Simulate successful completion
    await lastObservers.complete!();
    await c.done;

    const callsBefore = (lastTask.cancel as ReturnType<typeof vi.fn>).mock.calls.length;

    // Abort after completion — listener should have been removed
    controller.abort();

    expect((lastTask.cancel as ReturnType<typeof vi.fn>).mock.calls.length).toBe(callsBefore);
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
    expect(upsertUploadSessionMock).toHaveBeenLastCalledWith(expect.objectContaining({ status: 'canceled' }));
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
    expect(upsertUploadSessionMock).toHaveBeenLastCalledWith(expect.objectContaining({ status: 'canceled' }));
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
    expect(upsertUploadSessionMock).toHaveBeenLastCalledWith(expect.objectContaining({ status: 'error' }));
  });

  it('resolves the path, content type, and size without minting a download URL', async () => {
    const c = startResumableUpload(makeArgs());

    await lastObservers.complete!();

    await expect(c.done).resolves.toEqual({ fullPath: 'tmp/test.jpg', contentType: 'image/jpeg', size: 1 });
    expect(getDownloadURLMock).not.toHaveBeenCalled();
  });

  it('uploadFileResumable rejects when contentType metadata is missing', async () => {
    await expect(
      uploadFileResumable({
        storage: {} as any,
        path: 'x',
        file: makeFile(),
        metadata: { contentType: '' as any },
      }),
    ).rejects.toThrow(/contentType/i);
  });
});
