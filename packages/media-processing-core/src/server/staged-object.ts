import { isObjectNotFoundError } from './gcs-errors.js';
import type { Bucket } from './storage-ops.js';

export interface StagedObjectMetadata {
  contentType?: string;
  size?: string | number;
  generation?: string | number;
  [field: string]: unknown;
}

export type StagedUploadMetadataRead =
  { found: true; metadata: StagedObjectMetadata } | { found: false };

export async function readStagedUploadMetadata(
  bucket: Bucket,
  storagePath: string,
): Promise<StagedUploadMetadataRead> {
  try {
    const [metadata] = await bucket.file(storagePath).getMetadata();
    return { found: true, metadata };
  } catch (e) {
    if (isObjectNotFoundError(e)) return { found: false };
    throw e;
  }
}

export function stagedObjectGenerationFromMetadata(metadata: {
  generation?: string | number | null;
}): string | undefined {
  const { generation } = metadata;
  if (generation === undefined || generation === null) return undefined;
  const value = String(generation);
  return value === '' ? undefined : value;
}

export type StorageObjectMetadataField = 'generation' | 'size' | 'etag' | 'lastModified';

export class UnreadableStorageObjectMetadataError extends Error {
  constructor(
    public readonly bucket: string,
    public readonly key: string,
    public readonly field: StorageObjectMetadataField,
  ) {
    super(`storage object metadata has no readable ${field}`);
    this.name = 'UnreadableStorageObjectMetadataError';
  }
}

export function requireStorageObjectGeneration(
  metadata: { generation?: string | number | null },
  object: { bucket: string; key: string },
): string {
  const generation = stagedObjectGenerationFromMetadata(metadata);
  if (generation === undefined) {
    throw new UnreadableStorageObjectMetadataError(object.bucket, object.key, 'generation');
  }
  return generation;
}

export interface ReadStagedObjectGenerationOptions {
  onReadFailure?: (error: unknown) => void;
}

export async function readStagedObjectGeneration(
  bucket: Bucket,
  storagePath: string | undefined,
  options: ReadStagedObjectGenerationOptions = {},
): Promise<string | undefined> {
  if (!storagePath) return undefined;
  try {
    const [metadata] = await bucket.file(storagePath).getMetadata();
    return stagedObjectGenerationFromMetadata(metadata);
  } catch (e) {
    options.onReadFailure?.(e);
    return undefined;
  }
}

export function pinnedGcsUri(gcsUri: string, generation: string | undefined): string {
  return generation ? `${gcsUri}#${generation}` : gcsUri;
}
