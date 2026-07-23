// Final-media object-store chokepoint — every final-media write/copy/delete in
// the system goes through a MediaObjectStore. Inline storage-provider calls for
// FINAL media are forbidden outside this module. (Upload STAGING stays plain
// Firebase Storage and is not this module's concern.)
//
// There are two implementations:
//  - R2 (S3-compatible) for deployed environments — the only place final user
//    media lives in prod/dev; bytes are served exclusively by the gateway Worker.
//  - Firebase Storage emulator for local dev/tests — objects get a FIXED
//    caller-supplied download token so deterministic emulator URLs work with
//    zero Cloudflare involvement. Production NEVER mints download tokens.
//
// Writes return `{ key }` — never URLs. Display URLs are built at render time
// from asset refs (see the consuming app's media-asset-url helper).

import { createReadStream, createWriteStream } from "node:fs";
import { stat } from "node:fs/promises";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import { AwsClient } from "aws4fetch";
import type { getStorage } from "firebase-admin/storage";
import {
  defaultR2RetrySeams,
  fetchWithR2Retry,
  type R2RetrySeams,
} from "./r2-retry.js";

// Re-export the exhaustion error so callers can recognize an exhausted R2
// operation. The rest of the retry helper stays private to this module.
export { R2StorageError } from "./r2-retry.js";

/** Firebase Admin Storage Bucket — inferred to avoid @google-cloud/storage dep. */
export type Bucket = ReturnType<ReturnType<typeof getStorage>["bucket"]>;

export interface ObjectWriteResult {
  key: string;
  sizeBytes: number;
  contentType: string;
}

export interface ObjectReadResult {
  sizeBytes: number;
  contentType: string;
}

export interface MediaObjectStore {
  /** Upload a local file to the store at `key`. */
  putFile(args: { localPath: string; key: string; contentType?: string }): Promise<ObjectWriteResult>;
  /** Server-side copy within the store. */
  copy(args: { fromKey: string; toKey: string }): Promise<{ key: string }>;
  /**
   * Download an object's bytes from the store to a local file (streamed, so a
   * large video never sits fully in memory). Used by safety evidence capture to
   * pull prod media — which in deployed envs lives in R2 — before writing it into
   * the separate (GCS) evidence vault: capture is inherently read-here-then-write,
   * NOT a server-side copy, because source and vault are different backends.
   */
  readToFile(args: { key: string; localPath: string }): Promise<ObjectReadResult>;
  /** Delete an object. Missing objects are a no-op, not an error. */
  delete(key: string): Promise<void>;
}

const DEFAULT_CACHE_CONTROL = "public, max-age=31536000, immutable";

// ---------------------------------------------------------------------------
// R2 (S3-compatible) store — deployed environments
// ---------------------------------------------------------------------------

export interface CreateR2ObjectStoreArgs {
  accountId: string;
  accessKeyId: string;
  secretAccessKey: string;
  bucket: string;
  /** Override for tests; defaults to the real R2 S3 endpoint. */
  endpoint?: string;
  /** Override fetch for tests. */
  fetchImpl?: typeof fetch;
  /** Test seam: override the retry sleep (defaults to real `setTimeout`). */
  sleepImpl?: (ms: number) => Promise<void>;
  /** Test seam: override the backoff jitter source (defaults to `Math.random`). */
  randomImpl?: () => number;
  /** Test seam: override the clock used for HTTP-date `Retry-After` (defaults to `Date.now`). */
  nowImpl?: () => number;
}

export function createR2ObjectStore(args: CreateR2ObjectStoreArgs): MediaObjectStore {
  const endpoint = (args.endpoint ?? `https://${args.accountId}.r2.cloudflarestorage.com`).replace(/\/$/, "");
  const client = new AwsClient({
    accessKeyId: args.accessKeyId,
    secretAccessKey: args.secretAccessKey,
    service: "s3",
    region: "auto",
  });
  const doFetch = args.fetchImpl ?? fetch;

  // Retry seams: production defaults are internal; tests inject deterministic
  // sleep/random/now. putFile/copy/readToFile ride the bounded retry helper;
  // delete stays one-shot (never routes through it — see below).
  const defaults = defaultR2RetrySeams();
  const seams: R2RetrySeams = {
    sleep: args.sleepImpl ?? defaults.sleep,
    random: args.randomImpl ?? defaults.random,
    now: args.nowImpl ?? defaults.now,
  };

  const objectUrl = (key: string) =>
    `${endpoint}/${args.bucket}/${key.split("/").map(encodeURIComponent).join("/")}`;

  async function signedFetch(url: string, init: RequestInit & { headers?: Record<string, string> }) {
    const signed = await client.sign(url, { ...init, aws: { allHeaders: true } } as any);
    return doFetch(signed, { ...(init.body ? { duplex: "half" } : {}) } as any);
  }

  return {
    async putFile({ localPath, key, contentType }) {
      // stat() once, outside the retry loop: a missing input file is a
      // deterministic local error and must fail immediately, never retry.
      const { size } = await stat(localPath);
      const ct = contentType ?? getMimeFromExt(extractExt(localPath));
      return fetchWithR2Retry({
        operation: "putFile",
        bucket: args.bucket,
        key,
        seams,
        // Fresh signed request AND a fresh read stream on every attempt — a
        // consumed stream is never reused.
        runAttempt: async () => {
          const res = await signedFetch(objectUrl(key), {
            method: "PUT",
            headers: {
              "content-type": ct,
              "content-length": String(size),
              "cache-control": DEFAULT_CACHE_CONTROL,
            },
            body: createReadStream(localPath) as unknown as BodyInit,
          });
          if (res.ok) {
            return { kind: "success" as const, value: { key, sizeBytes: size, contentType: ct } };
          }
          return { kind: "response" as const, response: res };
        },
      });
    },

    async copy({ fromKey, toKey }) {
      // Preserve the exact x-amz-copy-source across every re-signed attempt.
      const copySource = `/${args.bucket}/${fromKey.split("/").map(encodeURIComponent).join("/")}`;
      return fetchWithR2Retry({
        operation: "copy",
        bucket: args.bucket,
        key: toKey,
        seams,
        runAttempt: async () => {
          const res = await signedFetch(objectUrl(toKey), {
            method: "PUT",
            headers: { "x-amz-copy-source": copySource },
          });
          if (res.ok) {
            return { kind: "success" as const, value: { key: toKey } };
          }
          return { kind: "response" as const, response: res };
        },
      });
    },

    async readToFile({ key, localPath }) {
      return fetchWithR2Retry({
        operation: "readToFile",
        bucket: args.bucket,
        key,
        seams,
        runAttempt: async () => {
          const res = await signedFetch(objectUrl(key), { method: "GET" });
          if (!res.ok || !res.body) {
            return { kind: "response" as const, response: res };
          }
          const contentType = res.headers.get("content-type") ?? "application/octet-stream";
          // Pipe ONLY after a successful response, and open the destination in
          // truncating mode ('w') on every attempt so a partial download from a
          // prior attempt can never prefix/corrupt this one. res.body is a web
          // ReadableStream; stream it to disk so large media never sits fully in
          // memory. A transient body/network stream failure here throws and is
          // retried by the helper; a deterministic local fs error is not.
          await pipeline(
            Readable.fromWeb(res.body as Parameters<typeof Readable.fromWeb>[0]),
            createWriteStream(localPath, { flags: "w" }),
          );
          const { size } = await stat(localPath);
          return { kind: "success" as const, value: { sizeBytes: size, contentType } };
        },
      });
    },

    async delete(key) {
      // Intentionally one-shot: delete is never retried (see r2-retry.ts header).
      const res = await signedFetch(objectUrl(key), { method: "DELETE" });
      // S3 DELETE returns 204 even for missing keys; anything else non-ok is real.
      if (!res.ok && res.status !== 404) {
        throw new Error(`R2 delete failed for ${key}: ${res.status} ${await safeText(res)}`);
      }
    },
  };
}

async function safeText(res: Response): Promise<string> {
  try {
    return (await res.text()).slice(0, 500);
  } catch {
    return "<no body>";
  }
}

// ---------------------------------------------------------------------------
// Firebase Storage emulator store — local dev / tests only
// ---------------------------------------------------------------------------

export interface CreateEmulatorObjectStoreArgs {
  bucket: Bucket;
  /** Fixed token attached to every object so deterministic emulator URLs work
   * (token URLs bypass rules in the emulator). Pass the app's constant. */
  downloadToken: string;
}

export function createFirebaseEmulatorObjectStore(args: CreateEmulatorObjectStoreArgs): MediaObjectStore {
  const { bucket, downloadToken } = args;
  return {
    async putFile({ localPath, key, contentType }) {
      const { size } = await stat(localPath);
      const ct = contentType ?? getMimeFromExt(extractExt(localPath));
      await bucket.upload(localPath, {
        destination: key,
        metadata: {
          contentType: ct,
          cacheControl: DEFAULT_CACHE_CONTROL,
          metadata: { firebaseStorageDownloadTokens: downloadToken },
        },
      });
      return { key, sizeBytes: size, contentType: ct };
    },

    async copy({ fromKey, toKey }) {
      await bucket.file(fromKey).copy(bucket.file(toKey));
      await bucket.file(toKey).setMetadata({
        metadata: { firebaseStorageDownloadTokens: downloadToken },
      });
      return { key: toKey };
    },

    async readToFile({ key, localPath }) {
      const file = bucket.file(key);
      await file.download({ destination: localPath });
      const [meta] = await file.getMetadata();
      const { size } = await stat(localPath);
      const contentType = (meta.contentType as string | undefined) ?? "application/octet-stream";
      return { sizeBytes: size, contentType };
    },

    async delete(key) {
      try {
        await bucket.file(key).delete();
      } catch (e: any) {
        if (e?.code === 404 || /No such object/i.test(String(e?.message))) return;
        throw e;
      }
    },
  };
}

// ---------------------------------------------------------------------------

function extractExt(localPath: string): string {
  return localPath.split(".").pop() || "";
}

export function getMimeFromExt(ext: string): string {
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
