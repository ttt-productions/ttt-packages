import type { FirebaseStorage, UploadMetadata, UploadTask, UploadTaskSnapshot } from "firebase/storage";
import type { UploadFileResumableResult } from "../types.js";

export type UploadProgressHandler = (p: {
  transferred: number;
  total: number;
  percent: number; // 0..100
  snapshot?: UploadTaskSnapshot;
}) => void;

export interface UploadFileResumableArgs {
  storage: FirebaseStorage;
  path: string;
  file: Blob | File;
  metadata?: UploadMetadata;
  onProgress?: UploadProgressHandler;

  /** Optional retry policy for transient failures. */
  retry?: {
    maxRetries?: number;
    baseDelayMs?: number;
    maxDelayMs?: number;
  };

  /** Optional cancellation signal. */
  signal?: AbortSignal;
}

export interface DeleteFileArgs {
  storage: FirebaseStorage;
  path: string;
}

export interface UploadController {
  id: string;
  task: UploadTask;

  pause: () => boolean;
  resume: () => boolean;
  cancel: () => boolean;

  /** Resolves on success, rejects on error/cancel. */
  done: Promise<UploadFileResumableResult>;
}

export interface StartUploadArgs extends Omit<UploadFileResumableArgs, "onProgress"> {
  /** Optional stable id for UI tracking. */
  id?: string;

  /**
   * UploadQueue-only: higher numbers run sooner.
   * Ignored by startResumableUpload/uploadFileResumable.
   */
  priority?: number;
}
