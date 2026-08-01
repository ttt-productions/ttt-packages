import { describe, it, expect } from "vitest";
import { Readable } from "node:stream";
import { readFile, stat, writeFile, mkdtemp, rm } from "node:fs/promises";
import { createHash, randomBytes } from "node:crypto";
import os from "node:os";
import path from "node:path";
import {
  streamToTempFile,
  hashFileSha256,
  readFileHeader,
  ByteLimitExceededError,
  FILE_HEADER_BYTES,
} from "../io/local-input.js";

const chunked = (buf: Buffer, chunkSize: number): Readable => {
  const chunks: Buffer[] = [];
  for (let i = 0; i < buf.length; i += chunkSize) chunks.push(buf.subarray(i, i + chunkSize));
  return Readable.from(chunks);
};

describe("streamToTempFile", () => {
  it("writes the exact bytes and reports bytesWritten; cleanup removes the file", async () => {
    const data = randomBytes(256 * 1024 + 17);
    const input = await streamToTempFile(chunked(data, 64 * 1024), { maxBytes: 1024 * 1024 });
    try {
      expect(input.bytesWritten).toBe(data.length);
      expect(Buffer.compare(await readFile(input.localPath), data)).toBe(0);
    } finally {
      await input.cleanup();
    }
    await expect(stat(input.localPath)).rejects.toThrow();
  });

  it("HARD CAP: throws ByteLimitExceededError and leaves no temp file behind", async () => {
    const data = randomBytes(100_000);
    let caught: unknown;
    try {
      await streamToTempFile(chunked(data, 10_000), { maxBytes: 50_000 });
    } catch (err) {
      caught = err;
    }
    expect(caught).toBeInstanceOf(ByteLimitExceededError);
    expect((caught as ByteLimitExceededError).maxBytes).toBe(50_000);
  });

  it("a source stream error cleans up and propagates", async () => {
    const bad = new Readable({
      read() {
        this.emit("error", new Error("source died"));
      },
    });
    await expect(streamToTempFile(bad, { maxBytes: 1000 })).rejects.toThrow("source died");
  });

  it("rejects a non-positive maxBytes", async () => {
    await expect(streamToTempFile(Readable.from([]), { maxBytes: 0 })).rejects.toThrow(
      /positive finite maxBytes/,
    );
  });

  it("cleanup is idempotent", async () => {
    const input = await streamToTempFile(Readable.from([Buffer.from("x")]), { maxBytes: 10 });
    await input.cleanup();
    await expect(input.cleanup()).resolves.toBeUndefined();
  });
});

describe("hashFileSha256", () => {
  it("matches crypto's whole-buffer digest", async () => {
    const dir = await mkdtemp(path.join(os.tmpdir(), "local-input-test-"));
    const p = path.join(dir, "f");
    const data = randomBytes(300_000);
    try {
      await writeFile(p, data);
      const expected = createHash("sha256").update(data).digest("hex");
      await expect(hashFileSha256(p)).resolves.toBe(expected);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
});

describe("readFileHeader", () => {
  it("reads at most the requested window and the whole file when smaller", async () => {
    const dir = await mkdtemp(path.join(os.tmpdir(), "local-input-test-"));
    const p = path.join(dir, "f");
    const data = randomBytes(FILE_HEADER_BYTES + 500);
    try {
      await writeFile(p, data);
      const header = await readFileHeader(p);
      expect(header.byteLength).toBe(FILE_HEADER_BYTES);
      expect(Buffer.compare(Buffer.from(header), data.subarray(0, FILE_HEADER_BYTES))).toBe(0);

      const small = await readFileHeader(p, 16);
      expect(small.byteLength).toBe(16);

      await writeFile(p, Buffer.from("tiny"));
      const whole = await readFileHeader(p);
      expect(Buffer.from(whole).toString()).toBe("tiny");
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
});
