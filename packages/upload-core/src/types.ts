import type { FirebaseStorage, UploadMetadata } from "firebase/storage";

export type UploadProgressHandler = (p: {
  transferred: number;
  total: number;
  percent: number;
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
