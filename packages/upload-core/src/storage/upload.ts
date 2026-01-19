import type { UploadFileResumableArgs, UploadController, UploadFileResumableResult } from "../types";
import { getFileSize } from "../utils/file-size";
import { upsertUploadSession } from "../utils/upload-store";

import {
  getDownloadURL,
  ref,
  uploadBytesResumable,
  type FirebaseStorage,
  type UploadMetadata,
  type UploadTaskSnapshot,
} from "firebase/storage";

function isAbortError(e: unknown) {
  return e instanceof DOMException && e.name === "AbortError";
}

export function startResumableUpload(args: {
  id: string;
  storage: FirebaseStorage;
  path: string;
  file: Blob;
  metadata?: UploadMetadata;
  onProgress?: UploadFileResumableArgs["onProgress"];
  signal?: AbortSignal;
}): UploadController {
  const { id, storage, path, file, metadata, onProgress, signal } = args;

  const r = ref(storage, path);
  const task = uploadBytesResumable(r, file, metadata);

  const startedAt = Date.now();

  upsertUploadSession({
    id,
    status: "uploading",
    path,
    transferred: 0,
    total: getFileSize(file),
    percent: 0,
    startedAt,
    updatedAt: startedAt,
  });

  let unsub: (() => void) | null = null;

  let resolveDone!: (v: UploadFileResumableResult) => void;
  let rejectDone!: (e: unknown) => void;
  const done = new Promise<UploadFileResumableResult>((res, rej) => {
    resolveDone = res;
    rejectDone = rej;
  });

  const onAbort = () => {
    try {
      task.cancel();
    } catch {}
  };

  if (signal) {
    if (signal.aborted) onAbort();
    signal.addEventListener("abort", onAbort, { once: true });
  }

  unsub = task.on(
    "state_changed",
    (snap: UploadTaskSnapshot) => {
      const transferred = snap.bytesTransferred ?? 0;
      const total = snap.totalBytes ?? getFileSize(file);
      const percent = total > 0 ? (transferred / total) * 100 : 0;

      upsertUploadSession({
        id,
        status:
          snap.state === "paused"
            ? "paused"
            : snap.state === "running"
            ? "uploading"
            : "uploading",
        path,
        transferred,
        total,
        percent,
        updatedAt: Date.now(),
      });

      onProgress?.({ transferred, total, percent, snapshot: snap });
    },
    async (err) => {
      if (signal) signal.removeEventListener("abort", onAbort);
      if (unsub) unsub();

      // normalize aborts as "canceled" (not "error")
      if (isAbortError(err)) {
        upsertUploadSession({
          id,
          status: "canceled",
          path,
          updatedAt: Date.now(),
          error: err,
        });
        return rejectDone(err);
      }

      upsertUploadSession({
        id,
        status: "error",
        path,
        updatedAt: Date.now(),
        error: err,
      });

      rejectDone(err);
    },
    async () => {
      try {
        const downloadURL = await getDownloadURL(task.snapshot.ref);
        const contentType = task.snapshot.metadata?.contentType ?? null;
        const size = task.snapshot.totalBytes ?? getFileSize(file);

        const result: UploadFileResumableResult = {
          downloadURL,
          fullPath: task.snapshot.ref.fullPath,
          contentType,
          size,
        };

        upsertUploadSession({
          id,
          status: "success",
          path,
          transferred: size,
          total: size,
          percent: 100,
          updatedAt: Date.now(),
          result,
        });

        resolveDone(result);
      } catch (e) {
        upsertUploadSession({
          id,
          status: "error",
          path,
          updatedAt: Date.now(),
          error: e,
        });
        rejectDone(e);
      } finally {
        if (signal) signal.removeEventListener("abort", onAbort);
        if (unsub) unsub();
      }
    }
  );

  return {
    id,
    task,
    pause: () => {
      try {
        return task.pause();
      } catch {
        return false;
      }
    },
    resume: () => {
      try {
        return task.resume();
      } catch {
        return false;
      }
    },
    cancel: () => {
      try {
        return task.cancel();
      } catch {
        return false;
      }
    },
    done,
  };
}

export async function uploadFileResumable(
  args: Omit<Parameters<typeof startResumableUpload>[0], "id"> & { id?: string }
): Promise<UploadFileResumableResult> {
  const id = args.id ?? `upl_${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`;
  const c = startResumableUpload({ ...args, id });
  return c.done;
}
