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

  /** Optional retry policy for transient failures. */
  retry?: {
    maxRetries?: number;
    baseDelayMs?: number;
    maxDelayMs?: number;
  };

  /** Optional cancellation signal. */
  signal?: AbortSignal;
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
  | "queued"
  | "uploading"
  | "paused"
  | "success"
  | "error"
  | "canceled";

export interface UploadSessionPersistenceAdapter {
  /** Return all session ids currently stored. */
  listIds: () => Promise<string[]> | string[];
  get: (id: string) => Promise<UploadSessionState | null> | UploadSessionState | null;
  set: (id: string, state: UploadSessionState) => Promise<void> | void;
  remove: (id: string) => Promise<void> | void;
}

export interface UploadQueueOptions {
  /** Maximum concurrent uploads. Default: 3 */
  concurrency?: number;
  /** Optional persistence adapter for session state. */
  persistence?: UploadSessionPersistenceAdapter;
}

export interface UploadSessionState {
  id: string;
  status: UploadSessionStatus;
  path: string;

  /** Monotonic version counter for state updates. */
  version: number;

  transferred: number;
  total: number;
  percent: number; // 0..100

  startedAt: number;
  updatedAt: number;

  error?: unknown;
  result?: UploadFileResumableResult;
}

export interface DisposeUploadSessionArgs {
  /** Session id to dispose. */
  id: string;
  /** If true, cancel any active upload task before disposal. Default true. */
  cancel?: boolean;
  /** If true, remove session state from the in-memory store. Default true. */
  remove?: boolean;
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
