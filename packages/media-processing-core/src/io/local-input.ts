import { createHash } from 'node:crypto';
import { createReadStream, createWriteStream } from 'node:fs';
import { mkdtemp, open, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { pipeline } from 'node:stream/promises';
import type { Readable } from 'node:stream';

export class ByteLimitExceededError extends Error {
  readonly maxBytes: number;
  constructor(maxBytes: number) {
    super(`source exceeded the ${maxBytes}-byte limit`);
    this.name = 'ByteLimitExceededError';
    this.maxBytes = maxBytes;
  }
}

export interface TempFileInput {
  localPath: string;
  bytesWritten: number;
  cleanup: () => Promise<void>;
}

export interface StreamToTempFileOptions {
  maxBytes: number;
  prefix?: string;
}

export async function streamToTempFile(
  source: Readable,
  options: StreamToTempFileOptions,
): Promise<TempFileInput> {
  const { maxBytes, prefix = 'media-input-' } = options;
  if (!Number.isFinite(maxBytes) || maxBytes <= 0) {
    throw new Error('streamToTempFile requires a positive finite maxBytes');
  }
  const dir = await mkdtemp(path.join(os.tmpdir(), prefix));
  const localPath = path.join(dir, 'input');
  const cleanup = async () => {
    // A temp folder that cannot be removed stays in the OS temp folder; the result does not depend on it.
    await rm(dir, { recursive: true, force: true }).catch(() => {});
  };

  let bytesWritten = 0;
  try {
    const sink = createWriteStream(localPath, { flags: 'wx' });
    await pipeline(
      source,
      async function* (chunks: AsyncIterable<Buffer | string>) {
        for await (const chunk of chunks) {
          const buf = typeof chunk === 'string' ? Buffer.from(chunk) : chunk;
          bytesWritten += buf.byteLength;
          if (bytesWritten > maxBytes) throw new ByteLimitExceededError(maxBytes);
          yield buf;
        }
      },
      sink,
    );
  } catch (err) {
    await cleanup();
    throw err;
  }
  return { localPath, bytesWritten, cleanup };
}

export async function hashFileSha256(localPath: string): Promise<string> {
  const hash = createHash('sha256');
  await pipeline(createReadStream(localPath), async (chunks: AsyncIterable<Buffer>) => {
    for await (const chunk of chunks) hash.update(chunk);
  });
  return hash.digest('hex');
}

export const FILE_HEADER_BYTES = 64 * 1024;

export async function readFileHeader(
  localPath: string,
  maxBytes: number = FILE_HEADER_BYTES,
): Promise<Uint8Array> {
  const handle = await open(localPath, 'r');
  try {
    const buf = Buffer.alloc(maxBytes);
    const { bytesRead } = await handle.read(buf, 0, maxBytes, 0);
    return buf.subarray(0, bytesRead);
  } finally {
    await handle.close();
  }
}
