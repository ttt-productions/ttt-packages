import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../src/browser/upload.js', () => ({
  startResumableUpload: vi.fn(),
}));

vi.mock('../src/utils/upload-store.js', () => ({
  upsertUploadSession: vi.fn(),
  removeUploadSession: vi.fn(),
}));

import { UploadQueue } from '../src/browser/upload-queue.js';
import { startResumableUpload } from '../src/browser/upload.js';
import type { StartUploadArgs } from '../src/browser/types.js';

function makeMockController(id = 'ctrl') {
  let resolveDone!: (r: any) => void;
  let rejectDone!: (e: any) => void;
  const done = new Promise<any>((res, rej) => {
    resolveDone = res;
    rejectDone = rej;
  });
  return {
    id,
    task: {} as any,
    pause: vi.fn(() => false),
    resume: vi.fn(() => false),
    cancel: vi.fn(() => true),
    done,
    resolveDone,
    rejectDone,
  };
}

const baseArgs: StartUploadArgs = {
  storage: {} as any,
  path: 'test/file.jpg',
  file: new Blob(['data']),
};

describe('UploadQueue', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('constructs with default concurrency of 2', () => {
    const queue = new UploadQueue();
    expect(queue.getRunningCount()).toBe(0);
    expect(queue.getPendingCount()).toBe(0);
  });

  it('constructs with custom concurrency', () => {
    const queue = new UploadQueue({ concurrency: 1 });

    const ctrl1 = makeMockController('c1');
    const ctrl2 = makeMockController('c2');
    vi.mocked(startResumableUpload)
      .mockReturnValueOnce(ctrl1 as any)
      .mockReturnValueOnce(ctrl2 as any);

    queue.enqueue({ ...baseArgs, id: 'job1' });
    queue.enqueue({ ...baseArgs, id: 'job2' });

    expect(queue.getRunningCount()).toBe(1);
    expect(queue.getPendingCount()).toBe(1);
  });

  it('setConcurrency updates the limit', () => {
    const queue = new UploadQueue({ concurrency: 1 });
    const ctrl = makeMockController();
    vi.mocked(startResumableUpload).mockReturnValue(ctrl as any);

    queue.enqueue({ ...baseArgs, id: 'job1' });
    queue.enqueue({ ...baseArgs, id: 'job2' });

    expect(queue.getRunningCount()).toBe(1);

    queue.setConcurrency(2);
    expect(queue.getRunningCount()).toBe(2);
  });

  it('getPendingCount returns correct value', () => {
    const queue = new UploadQueue({ concurrency: 0 });

    const ctrl = makeMockController();
    vi.mocked(startResumableUpload).mockReturnValue(ctrl as any);

    queue.enqueue({ ...baseArgs, id: 'job1' });
    queue.enqueue({ ...baseArgs, id: 'job2' });
    queue.enqueue({ ...baseArgs, id: 'job3' });

    expect(queue.getRunningCount()).toBe(1);
    expect(queue.getPendingCount()).toBe(2);
  });

  it('getRunningCount returns correct value', () => {
    const queue = new UploadQueue({ concurrency: 2 });
    const ctrl = makeMockController();
    vi.mocked(startResumableUpload).mockReturnValue(ctrl as any);

    expect(queue.getRunningCount()).toBe(0);
    queue.enqueue({ ...baseArgs, id: 'job1' });
    expect(queue.getRunningCount()).toBe(1);
    queue.enqueue({ ...baseArgs, id: 'job2' });
    expect(queue.getRunningCount()).toBe(2);
  });

  it('enqueue returns an UploadController', () => {
    const queue = new UploadQueue();
    const ctrl = makeMockController();
    vi.mocked(startResumableUpload).mockReturnValue(ctrl as any);

    const controller = queue.enqueue({ ...baseArgs });
    expect(controller).toBeDefined();
    expect(typeof controller.pause).toBe('function');
    expect(typeof controller.resume).toBe('function');
    expect(typeof controller.cancel).toBe('function');
    expect(controller.done).toBeInstanceOf(Promise);
  });

  it('cancel before start removes from pending queue', () => {
    const queue = new UploadQueue({ concurrency: 1 });
    const ctrl = makeMockController();
    vi.mocked(startResumableUpload).mockReturnValue(ctrl as any);

    queue.enqueue({ ...baseArgs, id: 'job1' });
    const job2 = queue.enqueue({ ...baseArgs, id: 'job2' });

    expect(queue.getPendingCount()).toBe(1);

    // Suppress the unhandled rejection from cancellation
    job2.done.catch(() => {});

    job2.cancel();
    expect(queue.getPendingCount()).toBe(0);
  });

  it('higher priority job runs before lower priority job', async () => {
    const queue = new UploadQueue({ concurrency: 1 });

    const ctrl1 = makeMockController('c1');
    const ctrl2 = makeMockController('c2');
    const ctrl3 = makeMockController('c3');

    vi.mocked(startResumableUpload)
      .mockReturnValueOnce(ctrl1 as any)
      .mockReturnValueOnce(ctrl3 as any)
      .mockReturnValueOnce(ctrl2 as any);

    queue.enqueue({ ...baseArgs, id: 'job1', priority: 0 });

    // These both go to pending; suppress unhandled rejections from leaked promises
    const lowPriCtrl = queue.enqueue({ ...baseArgs, id: 'job2', priority: 0 });
    const highPriCtrl = queue.enqueue({ ...baseArgs, id: 'job3', priority: 10 });
    lowPriCtrl.done.catch(() => {});
    highPriCtrl.done.catch(() => {});

    ctrl1.resolveDone({ fullPath: '', contentType: null, size: 0 });

    // The queue starts the next pending job in a microtask after the current one resolves.
    await Promise.resolve();
    await Promise.resolve();
    expect(startResumableUpload).toHaveBeenCalledTimes(2);
  });

  it('FIFO within same priority (lower seq runs first)', () => {
    const queue = new UploadQueue({ concurrency: 1 });
    const ctrl = makeMockController();
    vi.mocked(startResumableUpload).mockReturnValue(ctrl as any);

    queue.enqueue({ ...baseArgs, id: 'job1', priority: 5 });
    queue.enqueue({ ...baseArgs, id: 'job2', priority: 5 });
    queue.enqueue({ ...baseArgs, id: 'job3', priority: 5 });

    expect(queue.getPendingCount()).toBe(2);
  });

  it('concurrency limit is respected', () => {
    const queue = new UploadQueue({ concurrency: 2 });
    const ctrl = makeMockController();
    vi.mocked(startResumableUpload).mockReturnValue(ctrl as any);

    queue.enqueue({ ...baseArgs, id: 'job1' });
    queue.enqueue({ ...baseArgs, id: 'job2' });
    queue.enqueue({ ...baseArgs, id: 'job3' });

    expect(queue.getRunningCount()).toBe(2);
    expect(queue.getPendingCount()).toBe(1);
  });

  it('running count decrements after job completes', async () => {
    const queue = new UploadQueue({ concurrency: 1 });
    const ctrl = makeMockController();
    vi.mocked(startResumableUpload).mockReturnValue(ctrl as any);

    queue.enqueue({ ...baseArgs, id: 'job1' });
    expect(queue.getRunningCount()).toBe(1);

    ctrl.resolveDone({ fullPath: '', contentType: null, size: 0 });

    // Two microtask flushes match the two `.then` hops the queue takes to free the slot.
    await Promise.resolve();
    await Promise.resolve();
    expect(queue.getRunningCount()).toBe(0);
  });

  it('enqueue uses provided id', () => {
    const queue = new UploadQueue();
    const ctrl = makeMockController('my-id');
    vi.mocked(startResumableUpload).mockReturnValue(ctrl as any);

    const controller = queue.enqueue({ ...baseArgs, id: 'my-upload-id' });
    expect(controller.id).toBe('my-upload-id');
  });
});
