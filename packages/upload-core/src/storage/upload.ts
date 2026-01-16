import type { UploadFileResumableArgs, UploadFileResumableResult } from "../types";
import { getDownloadURL, ref, uploadBytesResumable } from "firebase/storage";

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
        onProgress({ transferred, total, percent });
      },
      (err) => reject(err),
      async () => {
        const downloadURL = await getDownloadURL(task.snapshot.ref);
        resolve({
          downloadURL,
          fullPath: task.snapshot.ref.fullPath,
          contentType: task.snapshot.metadata.contentType ?? null,
          size: task.snapshot.totalBytes ?? (file as any).size ?? 0
        });
      }
    );
  });
}
