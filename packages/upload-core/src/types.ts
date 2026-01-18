import type { FirebaseStorage, UploadMetadata, UploadTask, UploadTaskSnapshot } from "firebase/storage";

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
}

export interface UploadFileResumableResult {
  downloadURL: string;
  fullPath: string;
  contentType: string | null;
  size: number;
}

export interface DeleteFileArgs {
  storage: FirebaseStorage;
  path: string;
}

export type UploadSessionStatus =
  | "idle"
  | "uploading"
  | "paused"
  | "success"
  | "error"
  | "canceled";

export interface UploadSessionState {
  id: string;
  status: UploadSessionStatus;
  path: string;

  transferred: number;
  total: number;
  percent: number; // 0..100

  startedAt: number;
  updatedAt: number;

  error?: unknown;
  result?: UploadFileResumableResult;
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
}
