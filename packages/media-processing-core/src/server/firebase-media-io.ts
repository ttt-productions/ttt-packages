// Firebase Storage MediaIO adapter for the media-processing pipeline.
//
// Internals delegate to `uploadFileToStorage` so URL construction and
// token attachment have a single source of truth.

import { getStorage } from "firebase-admin/storage";
import type { MediaIO } from "../io/types.js";
import { uploadFileToStorage } from "./storage-ops.js";

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

        const result = await uploadFileToStorage({
          bucket,
          localPath,
          destinationPath,
        });

        return { url: result.url, path: result.path };
      },
    },
  };
}
