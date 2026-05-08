// Storage write operations — chokepoint for every file-storage side-effect
// in the system. Inline `bucket.upload()`, `bucket.file().move()`,
// `bucket.file().copy()`, and `setMetadata({ firebaseStorageDownloadTokens })`
// calls are forbidden outside this module.
//
// Every operation generates a fresh download token, attaches it to the file's
// metadata, and returns a `StorageWriteResult` with the emulator-aware URL.

import { randomUUID } from "node:crypto";
import type { getStorage } from "firebase-admin/storage";
import { buildFirebaseDownloadUrl } from "./build-download-url.js";

/** Firebase Admin Storage Bucket — inferred to avoid @google-cloud/storage dep. */
export type Bucket = ReturnType<ReturnType<typeof getStorage>["bucket"]>;

export interface StorageWriteResult {
  url: string;
  path: string;
  token: string;
}

const DEFAULT_CACHE_CONTROL = "public, max-age=31536000";

/**
 * Upload a local file to Storage. Generates a download token, attaches it
 * to the file's metadata, and returns the emulator-aware download URL.
 *
 * Use this for: pipeline outputs (sharp, ffmpeg) and any other "local file
 * → Storage" flow.
 */
export async function uploadFileToStorage(args: {
  bucket: Bucket;
  localPath: string;
  destinationPath: string;
  contentType?: string;
  cacheControl?: string;
}): Promise<StorageWriteResult> {
  const token = randomUUID();
  const contentType =
    args.contentType ?? getMimeFromExt(extractExt(args.localPath));

  await args.bucket.upload(args.localPath, {
    destination: args.destinationPath,
    metadata: {
      contentType,
      cacheControl: args.cacheControl ?? DEFAULT_CACHE_CONTROL,
      metadata: { firebaseStorageDownloadTokens: token },
    },
  });

  return {
    url: buildFirebaseDownloadUrl(args.bucket.name, args.destinationPath, token),
    path: args.destinationPath,
    token,
  };
}

/**
 * Move or copy a file already in Storage to a new location. Generates a
 * fresh download token at the destination, attaches it, and returns the
 * emulator-aware download URL.
 *
 * Use this for: library publish (copies from project to library), streetz
 * non-media file moves, job-posting / job-reply / chat-attachment
 * relocations, and any other "Storage → Storage" flow.
 */
export async function relocateStorageFile(args: {
  bucket: Bucket;
  fromPath: string;
  toPath: string;
  mode: "move" | "copy";
}): Promise<StorageWriteResult> {
  const token = randomUUID();

  if (args.mode === "move") {
    await args.bucket.file(args.fromPath).move(args.toPath);
  } else {
    await args.bucket.file(args.fromPath).copy(args.bucket.file(args.toPath));
  }

  await args.bucket.file(args.toPath).setMetadata({
    metadata: { firebaseStorageDownloadTokens: token },
  });

  return {
    url: buildFirebaseDownloadUrl(args.bucket.name, args.toPath, token),
    path: args.toPath,
    token,
  };
}

/**
 * Attach a fresh download token to a file already at its final Storage
 * location. Use when the file is already in place and only needs a token
 * (e.g., content-moderation rejection where the file was renamed earlier).
 */
export async function attachDownloadToken(args: {
  bucket: Bucket;
  storagePath: string;
}): Promise<StorageWriteResult> {
  const token = randomUUID();

  await args.bucket.file(args.storagePath).setMetadata({
    metadata: { firebaseStorageDownloadTokens: token },
  });

  return {
    url: buildFirebaseDownloadUrl(args.bucket.name, args.storagePath, token),
    path: args.storagePath,
    token,
  };
}

function extractExt(localPath: string): string {
  return localPath.split(".").pop() || "";
}

function getMimeFromExt(ext: string): string {
  switch (ext.toLowerCase()) {
    case "jpg":
    case "jpeg":
      return "image/jpeg";
    case "png":
      return "image/png";
    case "webp":
      return "image/webp";
    case "mp4":
      return "video/mp4";
    case "webm":
      return "video/webm";
    case "m4a":
      return "audio/mp4";
    case "aac":
      return "audio/aac";
    case "mp3":
      return "audio/mpeg";
    default:
      return "application/octet-stream";
  }
}
