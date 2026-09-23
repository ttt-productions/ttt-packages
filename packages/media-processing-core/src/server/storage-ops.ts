// Final-media object-store chokepoint — every final-media write/copy/delete in
// the system goes through a MediaObjectStore. Inline storage-provider calls for
// FINAL media are forbidden outside this module. (Upload STAGING stays plain
// Firebase Storage and is not this module's concern.)
//
// Implementations (the consuming app picks one per environment):
//  - R2 (S3-compatible) for deployed environments whose final media lives in
//    R2 and is served by an edge gateway.
//  - Firebase Storage for deployed environments whose final media lives in
//    Firebase Storage. Token-free: it writes and copies no download token, so
//    its objects are readable only through the app's own access path (Storage
//    rules). Firebase can still mint a token later (a client getDownloadURL, the
//    console); the app's read path must never do so.
//  - Firebase Storage emulator for local dev/tests — the Firebase Storage store
//    plus a FIXED caller-supplied download token on every object, so
//    deterministic emulator URLs work. Production NEVER mints download tokens.
//
// Writes return `{ key }` — never URLs. Display URLs are built at render time
// from asset refs (see the consuming app's media-asset-url helper).

import { createReadStream, createWriteStream } from "node:fs";
import { stat } from "node:fs/promises";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import { AwsClient } from "aws4fetch";
import type { getStorage } from "firebase-admin/storage";
import { NEUTRAL_CONTENT_TYPE } from "@ttt-productions/media-schemas";
import { isObjectNotFoundError } from "./gcs-errors.js";
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
  /**
   * Upload a local file to the store at `key`. Objects are written with a
   * one-year `immutable` cache-control, so keys are write-once: a replacement is
   * written under a NEW key and the app repoints its reference to it. Overwriting
   * an existing key would keep serving the old bytes from caches for up to a year.
   */
  putFile(args: { localPath: string; key: string; contentType?: string }): Promise<ObjectWriteResult>;
  /** Server-side copy within the store. */
  copy(args: { fromKey: string; toKey: string }): Promise<{ key: string }>;
  /**
   * Download an object's bytes from the store to a local file (streamed, so a
   * large video never sits fully in memory). Used by safety evidence capture to
   * pull final media — which may live in a different backend (R2) — before
   * writing it into the separate (GCS) evidence vault: capture is inherently
   * read-here-then-write, NOT a server-side copy, because source and vault can
   * be different backends.
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
          const contentType = res.headers.get("content-type") ?? NEUTRAL_CONTENT_TYPE;
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
// Firebase Storage stores — deployed (token-free) and emulator (fixed token)
// ---------------------------------------------------------------------------

/** Custom-metadata key Firebase Storage reads download tokens from. */
const DOWNLOAD_TOKENS_METADATA_KEY = "firebaseStorageDownloadTokens";

export interface CreateFirebaseStorageObjectStoreArgs {
  bucket: Bucket;
}

/** Firebase Storage store for deployed environments. Token-free (see header). */
export function createFirebaseStorageObjectStore(args: CreateFirebaseStorageObjectStoreArgs): MediaObjectStore {
  return createFirebaseStore(args.bucket, null);
}

export interface CreateEmulatorObjectStoreArgs extends CreateFirebaseStorageObjectStoreArgs {
  /** Fixed token attached to every object so deterministic emulator URLs work
   * (token URLs bypass rules in the emulator). Pass the app's constant. */
  downloadToken: string;
}

/** Local dev / tests only: the Firebase Storage store plus a fixed download token. */
export function createFirebaseEmulatorObjectStore(args: CreateEmulatorObjectStoreArgs): MediaObjectStore {
  return createFirebaseStore(args.bucket, args.downloadToken);
}

/** `downloadToken` is the store's token policy: `null` = token-free, a string = that token on every object. */
function createFirebaseStore(bucket: Bucket, downloadToken: string | null): MediaObjectStore {
  async function deleteObject(key: string): Promise<void> {
    try {
      await bucket.file(key).delete();
    } catch (e) {
      if (isObjectNotFoundError(e)) return;
      throw e;
    }
  }

  return {
    async putFile({ localPath, key, contentType }) {
      const { size } = await stat(localPath);
      const ct = contentType ?? getMimeFromExt(extractExt(localPath));
      // An upload replaces the object and all of its metadata, so a token-free
      // put carries no custom metadata at all.
      await bucket.upload(localPath, {
        destination: key,
        metadata: {
          contentType: ct,
          cacheControl: DEFAULT_CACHE_CONTROL,
          ...(downloadToken === null ? {} : { metadata: { [DOWNLOAD_TOKENS_METADATA_KEY]: downloadToken } }),
        },
      });
      return { key, sizeBytes: size, contentType: ct };
    },

    async copy({ fromKey, toKey }) {
      const [, rewrite] = await bucket.file(fromKey).copy(bucket.file(toKey));
      // A copy carries the source's custom metadata, token included. Stamp the
      // destination with this store's policy: the fixed token, or `null`, which
      // deletes any token the source carried. Pinning the stamp to the rewritten
      // object's metageneration makes it conditionally idempotent, so the
      // library retries transient failures instead of giving up after one try.
      const metageneration = (rewrite as { resource?: { metageneration?: string | number } } | undefined)
        ?.resource?.metageneration;
      try {
        await bucket.file(toKey).setMetadata(
          { metadata: { [DOWNLOAD_TOKENS_METADATA_KEY]: downloadToken } },
          metageneration === undefined ? {} : { ifMetagenerationMatch: metageneration },
        );
      } catch (stampError) {
        // Never leave the destination live under the wrong token policy: remove
        // it and fail the copy, so the caller retries the whole copy.
        try {
          await deleteObject(toKey);
        } catch (cleanupError) {
          throw new AggregateError(
            [stampError, cleanupError],
            `Copy to ${toKey}: stamping download-token metadata failed and the destination could not be removed`,
            { cause: cleanupError },
          );
        }
        throw stampError;
      }
      return { key: toKey };
    },

    async readToFile({ key, localPath }) {
      const file = bucket.file(key);
      await file.download({ destination: localPath });
      const [meta] = await file.getMetadata();
      const { size } = await stat(localPath);
      const contentType = (meta.contentType as string | undefined) ?? NEUTRAL_CONTENT_TYPE;
      return { sizeBytes: size, contentType };
    },

    delete: deleteObject,
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
      return NEUTRAL_CONTENT_TYPE;
  }
}
