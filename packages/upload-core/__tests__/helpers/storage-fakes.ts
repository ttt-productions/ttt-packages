import type {
  FirebaseStorage,
  StorageError,
  StorageReference,
  UploadMetadata,
  UploadTask,
  UploadTaskSnapshot,
} from 'firebase/storage';
import { vi } from 'vitest';

// The real SDK, though suites mock 'firebase/app' and 'firebase/storage': a reference built here
// is a real one, and building it opens no connection.
const { initializeApp } = await vi.importActual<typeof import('firebase/app')>('firebase/app');
const { getStorage } = await vi.importActual<typeof import('firebase/storage')>('firebase/storage');

let created = 0;

export function testStorage(): FirebaseStorage {
  created += 1;
  return getStorage(
    initializeApp(
      { projectId: 'demo-upload-core', storageBucket: 'demo-upload-core.appspot.com' },
      `upload-core-test-${created}`,
    ),
  );
}

export interface UploadTaskObservers {
  next?: (snapshot: UploadTaskSnapshot) => unknown;
  error?: (error: StorageError) => unknown;
  complete?: () => void;
}

export function fakeUploadTask(
  ref: StorageReference,
  data: Blob | Uint8Array | ArrayBuffer,
  metadata?: UploadMetadata,
) {
  const observers: UploadTaskObservers = {};
  const totalBytes = data instanceof Blob ? data.size : data.byteLength;
  const settled = new Promise<UploadTaskSnapshot>(() => {});
  const task = {
    cancel: vi.fn<UploadTask['cancel']>(() => true),
    pause: vi.fn<UploadTask['pause']>(() => true),
    resume: vi.fn<UploadTask['resume']>(() => true),
    on: vi.fn<UploadTask['on']>((_event, nextOrObserver, error, complete) => {
      if (typeof nextOrObserver === 'function') observers.next = nextOrObserver;
      else if (nextOrObserver) {
        observers.next = nextOrObserver.next ?? undefined;
        observers.error = nextOrObserver.error ?? undefined;
        observers.complete = nextOrObserver.complete ?? undefined;
      }
      if (error) observers.error = error;
      if (complete) observers.complete = complete;
      return () => {};
    }),
    then: (
      onFulfilled?: ((snapshot: UploadTaskSnapshot) => unknown) | null,
      onRejected?: ((error: StorageError) => unknown) | null,
    ) => settled.then(onFulfilled, onRejected),
    catch: (onRejected: (error: StorageError) => unknown) => settled.catch(onRejected),
    get snapshot(): UploadTaskSnapshot {
      return {
        bytesTransferred: 0,
        totalBytes,
        state: 'running',
        ref,
        task,
        metadata: {
          ...metadata,
          bucket: ref.bucket,
          fullPath: ref.fullPath,
          name: ref.name,
          generation: '1',
          metageneration: '1',
          size: totalBytes,
          timeCreated: '2000-01-01T00:00:00.000Z',
          updated: '2000-01-01T00:00:00.000Z',
          downloadTokens: undefined,
          ref,
        },
      };
    },
  } satisfies UploadTask;
  return { task, observers };
}

export type FakeUploadTask = ReturnType<typeof fakeUploadTask>;
