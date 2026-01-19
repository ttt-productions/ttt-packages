import type {
  StartUploadArgs,
  UploadController,
  UploadQueueOptions,
  UploadFileResumableResult,
} from "../types";
import { removeUploadSession, upsertUploadSession } from "../utils/upload-store";
import { disposeUploadSession, startResumableUpload } from "../storage/upload";

type Job = {
  id: string;
  args: StartUploadArgs;
  resolveController: (c: UploadController) => void;
  rejectController: (e: unknown) => void;
};

function noopBool() {
  return false;
}

function safeId(): string {
  try {
    const c = (globalThis as any).crypto;
    if (c?.randomUUID) return c.randomUUID();
    if (c?.getRandomValues) {
      const bytes = new Uint8Array(16);
      c.getRandomValues(bytes);
      bytes[6] = (bytes[6] & 0x0f) | 0x40;
      bytes[8] = (bytes[8] & 0x3f) | 0x80;
      const hex = Array.from(bytes, (b: number) => b.toString(16).padStart(2, "0")).join("");
      return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
    }
  } catch {}
  throw new Error("crypto.randomUUID/getRandomValues not available");
}

export class UploadQueue {
  private concurrency: number;
  private running = 0;
  private pending: Job[] = [];

  constructor(opts?: UploadQueueOptions) {
    this.concurrency = Math.max(1, opts?.concurrency ?? 3);
  }

  setConcurrency(n: number) {
    this.concurrency = Math.max(1, n);
    this.pump();
  }

  enqueue(args: StartUploadArgs): UploadController {
    const id = args.id ?? `upl_${safeId()}`;

    const startedAt = Date.now();
    upsertUploadSession({
      id,
      status: "queued",
      path: args.path,
      transferred: 0,
      total: (args.file as Blob).size ?? 0,
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

    // A placeholder controller that becomes live once the job starts.
    const controller: UploadController = {
      id,
      task: (null as any),
      pause: () => (real ? real.pause() : noopBool()),
      resume: () => (real ? real.resume() : noopBool()),
      cancel: () => {
        if (real) {
          return real.cancel();
        }
        // Cancel before it starts.
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
      resolveController: (c) => {
        real = c;
        controller.task = c.task;
        controller.pause = c.pause;
        controller.resume = c.resume;
        controller.cancel = c.cancel;
        c.done.then(resolveDone, rejectDone);
      },
      rejectController: (e) => {
        rejectDone(e);
      },
    };

    this.pending.push(job);
    this.pump();

    return controller;
  }

  private pump() {
    while (this.running < this.concurrency && this.pending.length > 0) {
      const job = this.pending.shift()!;
      this.running += 1;

      try {
        const c = startResumableUpload(job.args);
        job.resolveController(c);

        c.done.finally(() => {
          this.running -= 1;
          // Ensure listeners/controllers are not leaked.
          disposeUploadSession({ id: c.id, cancel: false, remove: false });
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
