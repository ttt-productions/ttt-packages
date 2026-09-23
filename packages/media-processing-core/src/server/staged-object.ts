// Admin-SDK reads of a STAGED upload object (the client-written staging copy a
// processor reads from). The accept-time verdict over the metadata is the pure
// `verifyStagedUploadMetadata` in `@ttt-productions/media-schemas`.

import { isObjectNotFoundError } from "./gcs-errors.js";
import type { Bucket } from "./storage-ops.js";

/** The stored-object metadata fields these reads use (the Admin SDK returns more). */
export interface StagedObjectMetadata {
  contentType?: string;
  size?: string | number;
  generation?: string | number;
  [field: string]: unknown;
}

export type StagedUploadMetadataRead =
  | { found: true; metadata: StagedObjectMetadata }
  | { found: false };

/**
 * Read a staged object's stored metadata (`contentType`, `size`, `generation`, …) for
 * `verifyStagedUploadMetadata`. A missing object is `{ found: false }`; any other read
 * failure throws.
 */
export async function readStagedUploadMetadata(bucket: Bucket, storagePath: string): Promise<StagedUploadMetadataRead> {
  try {
    const [metadata] = await bucket.file(storagePath).getMetadata();
    return { found: true, metadata };
  } catch (e) {
    if (isObjectNotFoundError(e)) return { found: false };
    throw e;
  }
}

/**
 * The staged object's generation from metadata the caller already fetched, as a string
 * (GCS generations exceed 2^53) — the one normalization `readStagedObjectGeneration`
 * applies, for a processor that already holds the object's metadata and must not read
 * it again. `undefined` when the metadata carries no generation (the emulator may not).
 */
export function stagedObjectGenerationFromMetadata(metadata: {
  generation?: string | number | null;
}): string | undefined {
  const { generation } = metadata;
  return generation === undefined || generation === null ? undefined : String(generation);
}

export interface ReadStagedObjectGenerationOptions {
  /** Called when the generation cannot be read (the caller logs it); reads then stay unpinned. */
  onReadFailure?: (error: unknown) => void;
}

/**
 * The staged object's current generation, as a string (GCS generations exceed 2^53).
 *
 * This is the one value that pins every later read of the staged bytes — the processing
 * download, a moderation scan, a hash — to the SAME immutable object, so "processed
 * bytes == scanned bytes == hashed bytes" holds even if the staging path were
 * overwritten (a pinned read resolves exactly the captured generation). Returns
 * `undefined` when no path is given, the object reports no generation (the emulator may
 * not), or the read fails — best effort: callers fall back to unpinned reads, and a
 * create-only staging rule stays the primary defense.
 */
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

/**
 * A `gs://` URI pinned to a captured generation (`gs://bucket/path#<generation>`), so a
 * service reading by URI (a moderation scan) reads the same bytes the processor did.
 * Without a generation it is the bare URI.
 */
export function pinnedGcsUri(gcsUri: string, generation: string | undefined): string {
  return generation ? `${gcsUri}#${generation}` : gcsUri;
}
