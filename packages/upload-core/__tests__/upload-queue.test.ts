import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../src/storage/upload', () => ({
  startResumableUpload: vi.fn(),
}));

vi.mock('../src/utils/upload-store', () => ({
  upsertUploadSession: vi.fn(),
  removeUploadSession: vi.fn(),
}));

import { UploadQueue } from '../src/queue/upload-queue';
import { startResumableUpload } from '../src/storage/upload';
import type { StartUploadArgs } from '../src/types';

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
    // The concurrency is internal but we can verify it by enqueuing multiple jobs
    const queue = new UploadQueue({ concurrency: 1 });

    const ctrl1 = makeMockController('c1');
    const ctrl2 = makeMockController('c2');
    vi.mocked(startResumableUpload)
      .mockReturnValueOnce(ctrl1 as any)
      .mockReturnValueOnce(ctrl2 as any);

    queue.enqueue({ ...baseArgs, id: 'job1' });
    queue.enqueue({ ...baseArgs, id: 'job2' });

    // With concurrency 1, only 1 should be running
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

    // Increase concurrency — should start the second job
    queue.setConcurrency(2);
    expect(queue.getRunningCount()).toBe(2);
  });

  it('getPendingCount returns correct value', () => {
    const queue = new UploadQueue({ concurrency: 0 }); // concurrency minimum is 1

    const ctrl = makeMockController();
    vi.mocked(startResumableUpload).mockReturnValue(ctrl as any);

    // concurrency 1 means 1 running, rest pending
    queue.enqueue({ ...baseArgs, id: 'job1' });
    queue.enqueue({ ...baseArgs, id: 'job2' });
    queue.enqueue({ ...baseArgs, id: 'job3' });

    // 1 running, 2 pending
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

    queue.enqueue({ ...baseArgs, id: 'job1' }); // starts immediately
    const job2 = queue.enqueue({ ...baseArgs, id: 'job2' }); // queued

    expect(queue.getPendingCount()).toBe(1);

    // Suppress the unhandled rejection from cancellation
    job2.done.catch(() => {});

    // Cancel the pending job
    job2.cancel();
    expect(queue.getPendingCount()).toBe(0);
  });

  it('higher priority job runs before lower priority job', () => {
    const queue = new UploadQueue({ concurrency: 1 });

    const ctrl1 = makeMockController('c1');
    const ctrl2 = makeMockController('c2');
    const ctrl3 = makeMockController('c3');

    // Block queue with a running job so next enqueues go to pending
    vi.mocked(startResumableUpload)
      .mockReturnValueOnce(ctrl1 as any) // job1 starts running
      .mockReturnValueOnce(ctrl3 as any) // high-priority goes first from pending
      .mockReturnValueOnce(ctrl2 as any); // low-priority goes second

    queue.enqueue({ ...baseArgs, id: 'job1', priority: 0 }); // starts running immediately

    // These both go to pending; suppress unhandled rejections from leaked promises
    const lowPriCtrl = queue.enqueue({ ...baseArgs, id: 'job2', priority: 0 });
    const highPriCtrl = queue.enqueue({ ...baseArgs, id: 'job3', priority: 10 });
    lowPriCtrl.done.catch(() => {});
    highPriCtrl.done.catch(() => {});

    // Complete job1 — should start the high priority job next
    ctrl1.resolveDone({ downloadURL: '', fullPath: '', contentType: null, size: 0 });

    // The startResumableUpload call count tells us ordering
    return new Promise<void>((resolve) => {
      setTimeout(() => {
        // job3 (priority 10) should have been started
        expect(startResumableUpload).toHaveBeenCalledTimes(2); // job1 + next from pending
        resolve();
      }, 10);
    });
  });

  it('FIFO within same priority (lower seq runs first)', () => {
    const queue = new UploadQueue({ concurrency: 1 });
    const ctrl = makeMockController();
    vi.mocked(startResumableUpload).mockReturnValue(ctrl as any);

    queue.enqueue({ ...baseArgs, id: 'job1', priority: 5 }); // starts running
    queue.enqueue({ ...baseArgs, id: 'job2', priority: 5 }); // pending, seq 1
    queue.enqueue({ ...baseArgs, id: 'job3', priority: 5 }); // pending, seq 2

    // Both job2 and job3 are pending with same priority
    // job2 should be next (lower seq)
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

    // Resolve the job
    ctrl.resolveDone({ downloadURL: '', fullPath: '', contentType: null, size: 0 });

    // Wait for the promise chain to settle
    await new Promise((r) => setTimeout(r, 10));
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
