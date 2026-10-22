import type {
  FirebaseStorage,
  UploadMetadata,
  UploadTask,
  UploadTaskSnapshot,
} from 'firebase/storage';
import type { UploadFileResumableResult } from '../types.js';

export type UploadProgressHandler = (p: {
  transferred: number;
  total: number;
  percent: number;
  snapshot?: UploadTaskSnapshot;
}) => void;

export interface UploadFileResumableArgs {
  storage: FirebaseStorage;
  path: string;
  file: Blob | File;
  metadata?: UploadMetadata;
  onProgress?: UploadProgressHandler;

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

  done: Promise<UploadFileResumableResult>;
}

export interface StartUploadArgs extends Omit<UploadFileResumableArgs, 'onProgress'> {
  id?: string;

  priority?: number;
}
