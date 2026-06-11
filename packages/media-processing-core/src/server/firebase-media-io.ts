// MediaIO adapter: reads the staged upload from Firebase Storage, writes
// processed outputs through a MediaObjectStore (R2 in deployed envs, the
// Storage emulator locally). Output keys are extension-less:
// `${outputKeyPrefix}/${outputKey}` — meaning lives in the asset registry,
// not the key. Writes return the object key; no URLs anywhere.

import { getStorage } from "firebase-admin/storage";
import type { MediaIO } from "../io/types.js";
import type { MediaObjectStore } from "./storage-ops.js";

export interface CreateObjectStoreMediaIOArgs {
  /** Firebase Storage staging path of the uploaded source file. */
  inputStoragePath: string;
  /** Store receiving the processed outputs (R2 or emulator). */
  outputStore: MediaObjectStore;
  /** Key prefix for outputs, e.g. `mediaAssets/{mediaAssetId}`. */
  outputKeyPrefix: string;
  /** Optional mime hint for the input. */
  inputMime?: string;
}

export function createObjectStoreMediaIO(args: CreateObjectStoreMediaIOArgs): MediaIO {
  const bucket = getStorage().bucket();

  return {
    input: {
      mime: args.inputMime,
      async readToFile(localPath: string) {
        await bucket.file(args.inputStoragePath).download({ destination: localPath });
      },
    },
    output: {
      async writeFromFile(localPath: string, outputKey: string) {
        const key = `${args.outputKeyPrefix}/${outputKey}`;
        const result = await args.outputStore.putFile({ localPath, key });
        return { path: result.key };
      },
    },
  };
}
