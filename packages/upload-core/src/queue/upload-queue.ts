import type { UploadController, UploadFileResumableResult, UploadQueueOptions, StartUploadArgs } from "../types";
import { getFileSize } from "../utils/file-size";
import { upsertUploadSession, removeUploadSession } from "../utils/upload-store";
import { startResumableUpload } from "../storage/upload";

function safeId() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}
function noopBool() {
  return false;
}

type Job = {
  id: string;
  args: StartUploadArgs & { priority?: number };
  priority: number; // higher = sooner
  seq: number; // FIFO within same priority
  resolveController: (c: UploadController) => void;
  rejectController: (e: unknown) => void;
};

export class UploadQueue {
  private concurrency: number;
  private running = 0;
  private pending: Job[] = [];
  private seq = 0;

  constructor(opts?: UploadQueueOptions) {
    this.concurrency = Math.max(1, opts?.concurrency ?? 2);
  }

  setConcurrency(n: number) {
    this.concurrency = Math.max(1, n);
    this.pump();
  }

  getPendingCount() {
    return this.pending.length;
  }

  getRunningCount() {
    return this.running;
  }

  enqueue(args: StartUploadArgs & { priority?: number }): UploadController {
    const id = args.id ?? `upl_${safeId()}`;
    const priority = args.priority ?? 0;

    const startedAt = Date.now();
    upsertUploadSession({
      id,
      status: "queued",
      path: args.path,
      transferred: 0,
      total: getFileSize(args.file),
      percent: 0,
      startedAt,
      updatedAt: startedAt,
    });

    let real: UploadController | null = null;

    let resolveDone!: (r: UploadFileResumableResult) => void;
    let rejectDone!: (e: unknown) => void;

    const done = new Promise<UploadFileResumableResult>((res, rej) => {
      resolveDone = res;
      rejectDone = rej;
    });

    const controller: UploadController = {
      id,
      task: null as any,
      pause: () => (real ? real.pause() : noopBool()),
      resume: () => (real ? real.resume() : noopBool()),
      cancel: () => {
        if (real) return real.cancel();
        this.pending = this.pending.filter((j) => j.id !== id);
        removeUploadSession(id);
        rejectDone(new DOMException("Aborted", "AbortError"));
        return true;
      },
      done,
    };

    const job: Job = {
      id,
      args: { ...args, id },
      priority,
      seq: this.seq++,
      resolveController: (c) => {
        real = c;
        controller.task = c.task;
        controller.pause = c.pause;
        controller.resume = c.resume;
        controller.cancel = c.cancel;
        c.done.then(resolveDone, rejectDone);
      },
      rejectController: (e) => rejectDone(e),
    };

    this.pending.push(job);
    this.pump();

    return controller;
  }

  private pump() {
    while (this.running < this.concurrency && this.pending.length > 0) {
      this.pending.sort((a, b) => (b.priority - a.priority) || (a.seq - b.seq));

      const job = this.pending.shift()!;
      this.running += 1;

      try {
        const { priority: _p, ...rest } = job.args;
        const c = startResumableUpload({
          ...(rest as any),
          id: job.id, // guarantee
        });

        job.resolveController(c);

        c.done.finally(() => {
          this.running -= 1;
          this.pump();
        });
      } catch (e) {
        this.running -= 1;

        upsertUploadSession({
          id: job.id,
          status: "error",
          path: job.args.path,
          error: e,
          updatedAt: Date.now(),
        });

        job.rejectController(e);
        this.pump();
      }
    }
  }
}
