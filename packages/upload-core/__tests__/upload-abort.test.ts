import { describe, it, expect, vi, beforeEach } from 'vitest';
import { StorageError, StorageErrorCode } from 'firebase/storage';
import type { upsertUploadSession } from '../src/utils/upload-store.js';
import type { FakeUploadTask } from './helpers/storage-fakes.js';
import { testStorage } from './helpers/storage-fakes.js';

const upsertUploadSessionMock = vi.fn<typeof upsertUploadSession>();
vi.mock(import('../src/utils/upload-store.js'), async (importOriginal) => {
  const { stubModule } = await import('@ttt-productions/dev-standards/testing');
  return stubModule(importOriginal, {
    upsertUploadSession: (...args) => upsertUploadSessionMock(...args),
  });
});

const storageFakes = vi.hoisted(() => {
  const uploads: FakeUploadTask[] = [];
  return {
    uploads,
    getDownloadURL: vi.fn<typeof import('firebase/storage').getDownloadURL>(
      async () => 'https://example.com/test.jpg',
    ),
  };
});

vi.mock(import('firebase/storage'), async (importOriginal) => {
  const { passThroughModule } = await import('@ttt-productions/dev-standards/testing');
  const { fakeUploadTask } = await import('./helpers/storage-fakes.js');
  return passThroughModule(importOriginal, {
    uploadBytesResumable: (ref, data, metadata) => {
      const upload = fakeUploadTask(ref, data, metadata);
      storageFakes.uploads.push(upload);
      return upload.task;
    },
    getDownloadURL: storageFakes.getDownloadURL,
  });
});

function startedUpload(): FakeUploadTask {
  const upload = storageFakes.uploads.at(-1);
  if (!upload) throw new Error('no upload task was started');
  return upload;
}

const startedTask = () => startedUpload().task;
const observers = () => startedUpload().observers;

import { startResumableUpload, uploadFileResumable } from '../src/browser/upload.js';

beforeEach(() => {
  upsertUploadSessionMock.mockReset();
  storageFakes.uploads.length = 0;
});

function storageCanceledError() {
  return new StorageError(StorageErrorCode.CANCELED, 'User canceled the upload/download.');
}

function makeFile() {
  // Blob.type is read-only in Node; the source reads only file.size, and contentType rides
  // args.metadata.
  return new Blob(['x']);
}

function makeArgs(overrides: Record<string, unknown> = {}) {
  return {
    id: 'upl_test',
    storage: testStorage(),
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

  it('classifies non-Abort errors as error in the upload-store', async () => {
    const controller = new AbortController();
    const c = startResumableUpload({ ...makeArgs(), signal: controller.signal });
    // done rejects with the failure; the case reads the upload-store instead.
    c.done.catch(() => {});

    await observers().error!(new StorageError(StorageErrorCode.UNKNOWN, 'network failure'));

    expect(upsertUploadSessionMock).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'error' }),
    );
  });

  it('abort after completion does not call task.cancel() a second time', async () => {
    const controller = new AbortController();
    const c = startResumableUpload({ ...makeArgs(), signal: controller.signal });

    await observers().complete!();
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
    await observers().error!(storageCanceledError());

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
    await observers().error!(storageCanceledError());

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

    await observers().error!(remote);

    expect(await outcome).toBe(remote);
    expect(upsertUploadSessionMock).toHaveBeenLastCalledWith(
      expect.objectContaining({ status: 'error' }),
    );
  });

  it('resolves the path, content type, and size without minting a download URL', async () => {
    const c = startResumableUpload(makeArgs());

    await observers().complete!();

    await expect(c.done).resolves.toEqual({
      fullPath: 'tmp/test.jpg',
      contentType: 'image/jpeg',
      size: 1,
    });
    expect(storageFakes.getDownloadURL).not.toHaveBeenCalled();
  });

  it('uploadFileResumable rejects when contentType metadata is missing', async () => {
    await expect(
      uploadFileResumable({
        storage: testStorage(),
        path: 'x',
        file: makeFile(),
        metadata: { contentType: '' },
      }),
    ).rejects.toThrow(/contentType/i);
  });
});
