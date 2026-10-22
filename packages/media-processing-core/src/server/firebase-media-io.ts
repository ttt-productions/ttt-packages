import { getStorage } from 'firebase-admin/storage';
import type { MediaIO } from '../io/types.js';
import type { MediaObjectStore } from './storage-ops.js';

export interface CreateObjectStoreMediaIOArgs {
  inputStoragePath: string;
  outputStore: MediaObjectStore;
  outputKeyPrefix: string;
  inputMime?: string;
  /** GCS generations exceed 2^53, so the string form is accepted too. */
  inputGeneration?: string | number;
}

export function createObjectStoreMediaIO(args: CreateObjectStoreMediaIOArgs): MediaIO {
  const bucket = getStorage().bucket();

  return {
    input: {
      mime: args.inputMime,
      async readToFile(localPath: string) {
        const file =
          args.inputGeneration != null
            ? bucket.file(args.inputStoragePath, { generation: args.inputGeneration })
            : bucket.file(args.inputStoragePath);
        await file.download({ destination: localPath });
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
