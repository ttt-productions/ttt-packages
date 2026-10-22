export interface UploadFileResumableResult {
  fullPath: string;
  contentType: string | null;
  size: number;
}

export type UploadSessionStatus =
  'idle' | 'queued' | 'uploading' | 'paused' | 'success' | 'error' | 'canceled';

export interface UploadSessionPersistenceAdapter {
  listIds: () => Promise<string[]> | string[];
  get: (id: string) => Promise<UploadSessionState | null> | UploadSessionState | null;
  set: (id: string, state: UploadSessionState) => Promise<void> | void;
  remove: (id: string) => Promise<void> | void;
}

export interface UploadQueueOptions {
  concurrency?: number;
  persistence?: UploadSessionPersistenceAdapter;
}

export interface UploadSessionState {
  id: string;
  status: UploadSessionStatus;
  path: string;

  version: number;

  transferred: number;
  total: number;
  percent: number;

  startedAt: number;
  updatedAt: number;

  error?: unknown;
  result?: UploadFileResumableResult;
}

export interface DisposeUploadSessionArgs {
  id: string;
  cancel?: boolean;
  remove?: boolean;
}
