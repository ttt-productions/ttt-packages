// Bounded-memory local-input primitives (canonical-upload-content-classification,
// bounded-memory unit). Safety scanning and hashing must never hold a full media
// source in JS memory: sources stream to a generation-pinned temp file with a
// hard byte cap, hashes stream from disk, and signature checks read only a
// bounded header. These primitives are generic (no storage/vendor deps) — the
// caller supplies the Readable and owns generation pinning.

import { createHash } from "node:crypto";
import { createReadStream, createWriteStream } from "node:fs";
import { mkdtemp, open, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { pipeline } from "node:stream/promises";
import type { Readable } from "node:stream";

/** Thrown by {@link streamToTempFile} when the source exceeds `maxBytes`. */
export class ByteLimitExceededError extends Error {
  readonly maxBytes: number;
  constructor(maxBytes: number) {
    super(`source exceeded the ${maxBytes}-byte limit`);
    this.name = "ByteLimitExceededError";
    this.maxBytes = maxBytes;
  }
}

export interface TempFileInput {
  /** Absolute path of the fully-written temp file. */
  localPath: string;
  /** Total bytes written (always <= maxBytes). */
  bytesWritten: number;
  /** Removes the temp file and its private directory. Idempotent; never throws. */
  cleanup: () => Promise<void>;
}

export interface StreamToTempFileOptions {
  /** HARD cap: the stream is destroyed and the temp file removed the moment the
   *  cap is crossed, so an oversized source never fully lands on disk. */
  maxBytes: number;
  /** Temp-dir prefix (default "media-input-"). */
  prefix?: string;
}

/**
 * Streams a Readable into a private temp file with a hard byte cap and
 * constant memory. On success the caller MUST invoke `cleanup()` in a
 * `finally`. On any failure (cap exceeded, stream error) the temp file is
 * removed before the error propagates.
 */
export async function streamToTempFile(
  source: Readable,
  options: StreamToTempFileOptions,
): Promise<TempFileInput> {
  const { maxBytes, prefix = "media-input-" } = options;
  if (!Number.isFinite(maxBytes) || maxBytes <= 0) {
    throw new Error("streamToTempFile requires a positive finite maxBytes");
  }
  const dir = await mkdtemp(path.join(os.tmpdir(), prefix));
  const localPath = path.join(dir, "input");
  const cleanup = async () => {
    await rm(dir, { recursive: true, force: true }).catch(() => {});
  };

  let bytesWritten = 0;
  try {
    const sink = createWriteStream(localPath, { flags: "wx" });
    await pipeline(source, async function* (chunks: AsyncIterable<Buffer | string>) {
      for await (const chunk of chunks) {
        const buf = typeof chunk === "string" ? Buffer.from(chunk) : chunk;
        bytesWritten += buf.byteLength;
        if (bytesWritten > maxBytes) throw new ByteLimitExceededError(maxBytes);
        yield buf;
      }
    }, sink);
  } catch (err) {
    await cleanup();
    throw err;
  }
  return { localPath, bytesWritten, cleanup };
}

/** Streams a file through SHA-256 (constant memory) and returns the lowercase hex digest. */
export async function hashFileSha256(localPath: string): Promise<string> {
  const hash = createHash("sha256");
  await pipeline(createReadStream(localPath), async (chunks: AsyncIterable<Buffer>) => {
    for await (const chunk of chunks) hash.update(chunk);
  });
  return hash.digest("hex");
}

/** Default header window for signature-family checks (matches the inspector's sniff window). */
export const FILE_HEADER_BYTES = 64 * 1024;

/**
 * Reads at most `maxBytes` (default 64 KiB) from the start of a file — the
 * bounded input for {@link detectSignatureFamily}-style checks without loading
 * the whole source.
 */
export async function readFileHeader(
  localPath: string,
  maxBytes: number = FILE_HEADER_BYTES,
): Promise<Uint8Array> {
  const handle = await open(localPath, "r");
  try {
    const buf = Buffer.alloc(maxBytes);
    const { bytesRead } = await handle.read(buf, 0, maxBytes, 0);
    return buf.subarray(0, bytesRead);
  } finally {
    await handle.close();
  }
}
