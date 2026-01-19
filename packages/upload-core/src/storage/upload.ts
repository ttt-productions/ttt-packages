import type {
  StartUploadArgs,
  UploadController,
  UploadFileResumableArgs,
  UploadFileResumableResult,
} from "../types";
import { getDownloadURL, ref, uploadBytesResumable } from "firebase/storage";
import type { UploadTaskSnapshot } from "firebase/storage";
import { clearUploadSessionListeners, removeUploadSession, upsertUploadSession } from "../utils/upload-store";
import { backoffDelayMs, sleep } from "../utils/retry";
import type { DisposeUploadSessionArgs } from "../types";

const controllerRegistry = new Map<string, UploadController>();

export function getUploadController(id: string): UploadController | undefined {
  return controllerRegistry.get(id);
}

export function disposeUploadSession(args: DisposeUploadSessionArgs): void {
  const cancel = args.cancel ?? true;
  const remove = args.remove ?? true;

  const c = controllerRegistry.get(args.id);
  if (c) {
    if (cancel) {
      try {
        c.cancel();
      } catch {}
    }
    controllerRegistry.delete(args.id);
  }

  clearUploadSessionListeners(args.id);
  if (remove) removeUploadSession(args.id);
}

function getSafeId(): string {
  try {
    const c = (globalThis as any).crypto;
    if (c?.randomUUID) return c.randomUUID();
    if (c?.getRandomValues) {
      const bytes = new Uint8Array(16);
      c.getRandomValues(bytes);
      // RFC 4122-ish v4 UUID formatting
      bytes[6] = (bytes[6] & 0x0f) | 0x40;
      bytes[8] = (bytes[8] & 0x3f) | 0x80;
      const hex = Array.from(bytes, (b: number) => b.toString(16).padStart(2, "0")).join("");
      return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
    }
  } catch {}
  // No safe crypto source available.
  throw new Error("crypto.randomUUID/getRandomValues not available");
}

function isRetryableStorageError(err: any): boolean {
  const code = String(err?.code ?? "");

  // Firebase Storage codes are typically like "storage/...".
  // Retry only transient-ish failures.
  if (
    code === "storage/retry-limit-exceeded" ||
    code === "storage/unknown" ||
    code === "storage/timeout" ||
    code === "storage/server-file-wrong-size"
  ) {
    return true;
  }

  // Common non-code transient errors.
  const msg = String(err?.message ?? "");
  return /network|offline|temporar|timeout|ECONNRESET|EAI_AGAIN|ENETDOWN|ENOTFOUND|ETIMEDOUT/i.test(msg);
}

function genId() {
  return `upl_${getSafeId()}`;
}

export async function uploadFileResumable(
  args: UploadFileResumableArgs
): Promise<UploadFileResumableResult> {
  const { storage, path, file, metadata, onProgress, retry, signal } = args;

  const maxRetries = Math.max(0, retry?.maxRetries ?? 0);
  const baseDelayMs = Math.max(0, retry?.baseDelayMs ?? 300);
  const maxDelayMs = Math.max(baseDelayMs, retry?.maxDelayMs ?? 5000);

  const storageRef = ref(storage, path);

  let attempt = 0;
  // eslint-disable-next-line no-constant-condition
  while (true) {
    if (signal?.aborted) throw new DOMException("Aborted", "AbortError");

    try {
      return await new Promise<UploadFileResumableResult>((resolve, reject) => {
        const task = uploadBytesResumable(storageRef, file, metadata);

        const onAbort = () => {
          try {
            task.cancel();
          } catch {}
        };
        if (signal) {
          if (signal.aborted) onAbort();
          signal.addEventListener("abort", onAbort, { once: true });
        }

        task.on(
          "state_changed",
          (snap) => {
            if (!onProgress) return;
            const total = snap.totalBytes || 0;
            const transferred = snap.bytesTransferred || 0;
            const percent = total > 0 ? (transferred / total) * 100 : 0;
            onProgress({ transferred, total, percent, snapshot: snap });
          },
          (err) => {
            if (signal) signal.removeEventListener("abort", onAbort);
            reject(err);
          },
          async () => {
            if (signal) signal.removeEventListener("abort", onAbort);
            const downloadURL = await getDownloadURL(task.snapshot.ref);
            resolve({
              downloadURL,
              fullPath: task.snapshot.ref.fullPath,
              contentType: task.snapshot.metadata.contentType ?? null,
              size: task.snapshot.totalBytes ?? file.size ?? 0,
            });
          }
        );
      });
    } catch (err: any) {
      // Never retry explicit cancellation.
      const code = String(err?.code ?? "");
      if (code === "storage/canceled" || err?.name === "AbortError") throw err;

      attempt += 1;
      const canRetry = attempt <= maxRetries && isRetryableStorageError(err);
      if (!canRetry) throw err;

      const delay = backoffDelayMs(attempt, baseDelayMs, maxDelayMs);
      await sleep(delay, signal);
    }
  }
}

export function startResumableUpload(args: StartUploadArgs): UploadController {
  const { storage, path, file, metadata, retry, signal } = args;
  const id = args.id ?? genId();

  const startedAt = Date.now();

  upsertUploadSession({
    id,
    status: "uploading",
    path,
    transferred: 0,
    total: file.size ?? 0,
    percent: 0,
    startedAt,
    updatedAt: startedAt,
  });

  const maxRetries = Math.max(0, retry?.maxRetries ?? 0);
  const baseDelayMs = Math.max(0, retry?.baseDelayMs ?? 300);
  const maxDelayMs = Math.max(baseDelayMs, retry?.maxDelayMs ?? 5000);

  const storageRef = ref(storage, path);
  let currentTask = uploadBytesResumable(storageRef, file, metadata);

  const controller: UploadController = {
    id,
    task: currentTask as any,
    pause: () => (currentTask as any).pause(),
    resume: () => (currentTask as any).resume(),
    cancel: () => (currentTask as any).cancel(),
    done: Promise.resolve() as any,
  };

  // Register for disposal/lookup.
  controllerRegistry.set(id, controller);

  const done = new Promise<UploadFileResumableResult>((resolve, reject) => {
    let attempt = 0;

    const bind = (task: any) => {
      const onAbort = () => {
        try {
          task.cancel();
        } catch {}
      };
      if (signal) {
        if (signal.aborted) onAbort();
        signal.addEventListener("abort", onAbort, { once: true });
      }

      task.on(
      "state_changed",
      (snap: UploadTaskSnapshot) => {
        const total = snap.totalBytes || 0;
        const transferred = snap.bytesTransferred || 0;
        const percent = total > 0 ? (transferred / total) * 100 : 0;

        const status =
          task.snapshot.state === "paused"
            ? "paused"
            : task.snapshot.state === "running"
              ? "uploading"
              : "uploading";

        upsertUploadSession({
          id,
          status,
          path,
          total,
          transferred,
          percent,
          updatedAt: Date.now(),
        });
      },
      async (error: unknown) => {
        const isCanceled =
          (error as any)?.code === "storage/canceled" ||
          ((error as any)?.name === "FirebaseError" && (error as any)?.code === "storage/canceled");

        if (signal) signal.removeEventListener("abort", onAbort);

        if (isCanceled || (error as any)?.name === "AbortError") {
          upsertUploadSession({
            id,
            status: "canceled",
            path,
            error,
            updatedAt: Date.now(),
          });
          reject(error);
          return;
        }

        attempt += 1;
        const canRetry = attempt <= maxRetries && isRetryableStorageError(error);
        if (canRetry) {
          const delay = backoffDelayMs(attempt, baseDelayMs, maxDelayMs);
          upsertUploadSession({
            id,
            status: "uploading",
            path,
            error,
            updatedAt: Date.now(),
          });
          try {
            await sleep(delay, signal);
          } catch (e) {
            reject(e);
            return;
          }

          currentTask = uploadBytesResumable(storageRef, file, metadata);
          controller.task = currentTask as any;
          bind(currentTask);
          return;
        }

        upsertUploadSession({
          id,
          status: "error",
          path,
          error,
          updatedAt: Date.now(),
        });

        reject(error);
      },
      async () => {
        if (signal) signal.removeEventListener("abort", onAbort);
        const downloadURL = await getDownloadURL(task.snapshot.ref);
        const result: UploadFileResumableResult = {
          downloadURL,
          fullPath: task.snapshot.ref.fullPath,
          contentType: task.snapshot.metadata.contentType ?? null,
          size: task.snapshot.totalBytes ?? file.size ?? 0,
        };

        upsertUploadSession({
          id,
          status: "success",
          path,
          transferred: task.snapshot.totalBytes || 0,
          total: task.snapshot.totalBytes || 0,
          percent: 100,
          result,
          updatedAt: Date.now(),
        });

        resolve(result);
      }
    );

    };

    bind(currentTask);
  });

  controller.done = done;

  controller.done.finally(() => {
    // Always release registry entry after completion.
    controllerRegistry.delete(id);
  });

  return controller;
}
