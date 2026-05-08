// Firebase Storage MediaIO adapter for the media-processing pipeline.
// Server-only — relies on firebase-admin. Imported via `/server` subpath.
//
// The adapter constructs download URLs that respect emulator mode:
// when `FIREBASE_STORAGE_EMULATOR_HOST` is set (the Firebase Admin SDK
// auto-sets it when the Storage emulator is running), URLs target the
// local emulator; otherwise they target the production Firebase Storage
// CDN. This is critical for E2E tests — without it, the browser fetches
// production URLs that 404 because the file lives in the local emulator.

import { getStorage } from "firebase-admin/storage";
import { randomUUID } from "node:crypto";
import type { MediaIO } from "../io/types.js";

export interface CreateFirebaseMediaIOArgs {
  inputStoragePath: string;
  outputStorageBasePath: string;
}

export function createFirebaseMediaIO(args: CreateFirebaseMediaIOArgs): MediaIO {
  const bucket = getStorage().bucket();

  return {
    input: {
      async readToFile(localPath: string) {
        await bucket.file(args.inputStoragePath).download({ destination: localPath });
      },
    },
    output: {
      async writeFromFile(localPath: string, outputKey: string) {
        const ext = localPath.split(".").pop() || "";
        const destinationPath = `${args.outputStorageBasePath}/${outputKey}.${ext}`;
        const downloadToken = randomUUID();

        await bucket.upload(localPath, {
          destination: destinationPath,
          metadata: {
            contentType: getMimeFromExt(ext),
            cacheControl: "public, max-age=31536000",
            metadata: { firebaseStorageDownloadTokens: downloadToken },
          },
        });

        const encodedPath = encodeURIComponent(destinationPath);
        const emulatorHost = process.env.FIREBASE_STORAGE_EMULATOR_HOST;
        const baseUrl = emulatorHost
          ? `http://${emulatorHost}`
          : "https://firebasestorage.googleapis.com";
        const url = `${baseUrl}/v0/b/${bucket.name}/o/${encodedPath}?alt=media&token=${downloadToken}`;

        return { url, path: destinationPath };
      },
    },
  };
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
