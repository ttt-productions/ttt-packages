import type {
  StartUploadArgs,
  UploadController,
  UploadFileResumableArgs,
  UploadFileResumableResult,
} from "../types";
import { getDownloadURL, ref, uploadBytesResumable } from "firebase/storage";
import { upsertUploadSession } from "../utils/upload-store";

function genId() {
  return `upl_${Math.random().toString(36).slice(2)}_${Date.now().toString(36)}`;
}

export async function uploadFileResumable(
  args: UploadFileResumableArgs
): Promise<UploadFileResumableResult> {
  const { storage, path, file, metadata, onProgress } = args;

  const storageRef = ref(storage, path);

  return await new Promise((resolve, reject) => {
    const task = uploadBytesResumable(storageRef, file, metadata);

    task.on(
      "state_changed",
      (snap) => {
        if (!onProgress) return;
        const total = snap.totalBytes || 0;
        const transferred = snap.bytesTransferred || 0;
        const percent = total > 0 ? (transferred / total) * 100 : 0;
        onProgress({ transferred, total, percent, snapshot: snap });
      },
      (err) => reject(err),
      async () => {
        const downloadURL = await getDownloadURL(task.snapshot.ref);
        resolve({
          downloadURL,
          fullPath: task.snapshot.ref.fullPath,
          contentType: task.snapshot.metadata.contentType ?? null,
          size: task.snapshot.totalBytes ?? (file as any).size ?? 0,
        });
      }
    );
  });
}

export function startResumableUpload(args: StartUploadArgs): UploadController {
  const { storage, path, file, metadata } = args;
  const id = args.id ?? genId();

  const startedAt = Date.now();

  upsertUploadSession({
    id,
    status: "uploading",
    path,
    transferred: 0,
    total: (file as any).size ?? 0,
    percent: 0,
    startedAt,
    updatedAt: startedAt,
  });

  const storageRef = ref(storage, path);
  const task = uploadBytesResumable(storageRef, file, metadata);

  const done = new Promise<UploadFileResumableResult>((resolve, reject) => {
    task.on(
      "state_changed",
      (snap) => {
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
      (error) => {
        const isCanceled =
          (error as any)?.code === "storage/canceled" ||
          (error as any)?.name === "FirebaseError" && (error as any)?.code === "storage/canceled";

        upsertUploadSession({
          id,
          status: isCanceled ? "canceled" : "error",
          path,
          error,
          updatedAt: Date.now(),
        });

        reject(error);
      },
      async () => {
        const downloadURL = await getDownloadURL(task.snapshot.ref);
        const result: UploadFileResumableResult = {
          downloadURL,
          fullPath: task.snapshot.ref.fullPath,
          contentType: task.snapshot.metadata.contentType ?? null,
          size: task.snapshot.totalBytes ?? (file as any).size ?? 0,
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
  });

  return {
    id,
    task,
    pause: () => task.pause(),
    resume: () => task.resume(),
    cancel: () => task.cancel(),
    done,
  };
}
