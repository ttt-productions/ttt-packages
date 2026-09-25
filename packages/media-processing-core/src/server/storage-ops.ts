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
  R2StorageError,
  type R2RetrySeams,
} from "./r2-retry.js";
import { requireStorageObjectGeneration, UnreadableStorageObjectMetadataError } from "./staged-object.js";

// Re-export the exhaustion error so callers can recognize an exhausted R2
// operation. The rest of the retry helper stays private to this module.
export { R2StorageError };

/**
 * A copy found an object at its destination key that is not this copy's result, and
 * wrote nothing; that object is untouched. The key is a PROPERTY, never message text, so
 * an escaping error never carries an object key to monitoring.
 */
export class ObjectAlreadyExistsError extends Error {
  constructor(public readonly key: string) {
    super("copy destination already holds another object");
    this.name = "ObjectAlreadyExistsError";
  }
}

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

export interface ObjectCopyResult {
  key: string;
  /**
   * `true` when the destination already held this copy's result — the same source version,
   * committed by an earlier attempt whose answer was lost or by a concurrent identical
   * copy; `false` when this call committed it.
   */
  alreadyPresent: boolean;
}

/**
 * What `deleteCopy` found at the destination: `deleted` — a copy of the source, now removed;
 * `absent` — no object; `notThisCopy` — an object this package did not copy from that
 * source, left untouched.
 */
export type DeleteCopyResult = "deleted" | "absent" | "notThisCopy";

// Every copy records on its destination which source version it holds. A copy whose
// destination already exists compares this record with its own, so it recognizes its
// own earlier result and never mistakes another writer's object for it. The values are
// URI-encoded because R2 carries custom metadata in HTTP headers, which must be ASCII.
const COPY_SOURCE_METADATA_KEY = "copy-source";
const COPY_SOURCE_VERSION_METADATA_KEY = "copy-source-version";

type CopyProvenance = Record<typeof COPY_SOURCE_METADATA_KEY | typeof COPY_SOURCE_VERSION_METADATA_KEY, string>;

function copyProvenance(fromKey: string, sourceVersion: string): CopyProvenance {
  return {
    [COPY_SOURCE_METADATA_KEY]: encodeURIComponent(fromKey),
    [COPY_SOURCE_VERSION_METADATA_KEY]: encodeURIComponent(sourceVersion),
  };
}

/** Whether an object's custom metadata, read through `readMetadata`, names exactly this provenance. */
function holdsProvenance(readMetadata: (name: string) => unknown, provenance: CopyProvenance): boolean {
  return Object.entries(provenance).every(([name, value]) => readMetadata(name) === value);
}

/**
 * Whether an object's custom metadata records a copy of `fromKey`, of whichever source
 * version: `deleteCopy` reads only the destination, so it cannot know the source's version.
 * A record naming the source without a version is not provenance this package wrote.
 */
function recordsCopyOf(readMetadata: (name: string) => unknown, fromKey: string): boolean {
  const version = readMetadata(COPY_SOURCE_VERSION_METADATA_KEY);
  return (
    readMetadata(COPY_SOURCE_METADATA_KEY) === encodeURIComponent(fromKey) &&
    typeof version === "string" &&
    version !== ""
  );
}

/** The content headers a copy carries from its source: HTTP header name → Cloud Storage field. */
const CARRIED_CONTENT_HEADERS = {
  "content-type": "contentType",
  "cache-control": "cacheControl",
  "content-disposition": "contentDisposition",
  "content-encoding": "contentEncoding",
} as const;

type CarriedContentField = (typeof CARRIED_CONTENT_HEADERS)[keyof typeof CARRIED_CONTENT_HEADERS];

export interface MediaObjectStore {
  /**
   * Upload a local file to the store at `key`. Objects are written with a
   * one-year `immutable` cache-control, so keys are write-once: a replacement is
   * written under a NEW key and the app repoints its reference to it. Overwriting
   * an existing key would keep serving the old bytes from caches for up to a year.
   */
  putFile(args: { localPath: string; key: string; contentType?: string }): Promise<ObjectWriteResult>;
  /**
   * Server-side copy within the store. It never overwrites and is idempotent: it commits
   * only when `toKey` holds no object, in one call that writes the destination fully
   * formed (the source version's bytes and content headers, its provenance, and this
   * store's token policy). When `toKey` already holds this copy's result — a retry of
   * the same copy of the same source version — it resolves with `alreadyPresent: true`;
   * when it holds anything else, it throws `ObjectAlreadyExistsError` and leaves that
   * object untouched. It never deletes anything.
   */
  copy(args: { fromKey: string; toKey: string }): Promise<ObjectCopyResult>;
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
  /**
   * Delete `toKey` only when the object there is a copy of `fromKey` this package made: its
   * own recorded provenance must name `fromKey` as its source. Only the destination is read,
   * so this works after the source is gone. Any other object — a copy of another source, or
   * one with no provenance — is left untouched and answers `notThisCopy`.
   *
   * Firebase Storage deletes only the generation it checked; an object replaced after the
   * check is checked again, never deleted blind. R2's DeleteObject takes no precondition, so
   * there the delete follows the check unconditioned. That gap is harmless only under the key
   * contract: keys are write-once and a copy never replaces an object, so in the gap the
   * checked object can only be removed; and a copy's key is derived from its source, so the
   * only object that can land there afterwards is another copy of the same source.
   */
  deleteCopy(args: { fromKey: string; toKey: string }): Promise<DeleteCopyResult>;
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

  // A GET whose body is discarded unread, not a HEAD: a HEAD's error response carries no
  // body, so the S3 error code that tells a missing key from a missing bucket would be lost.
  async function readObjectHeaders(key: string, operation: "copy" | "deleteCopy"): Promise<Headers> {
    return fetchWithR2Retry({
      operation,
      bucket: args.bucket,
      key,
      seams,
      runAttempt: async () => {
        const res = await signedFetch(objectUrl(key), { method: "GET" });
        if (!res.ok) return { kind: "response" as const, response: res };
        await res.body?.cancel();
        return { kind: "success" as const, value: res.headers };
      },
    });
  }

  // R2 exposes no object version id, so a source version is its ETag, last-modified time,
  // and size together: replacing the source changes at least one of them unless the new
  // content has the same MD5-derived ETag and lands within the same second. A multipart
  // upload's ETag is not the content's MD5, but it is the same kind of version token.
  function readSourceVersion(headers: Headers, key: string): { etag: string; version: string } {
    const etag = headers.get("etag");
    if (!etag) throw new UnreadableStorageObjectMetadataError(args.bucket, key, "etag");
    const lastModified = headers.get("last-modified");
    if (!lastModified) throw new UnreadableStorageObjectMetadataError(args.bucket, key, "lastModified");
    const size = headers.get("content-length");
    if (!size) throw new UnreadableStorageObjectMetadataError(args.bucket, key, "size");
    return { etag, version: `${etag} ${lastModified} ${size}` };
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
      const source = await readObjectHeaders(fromKey, "copy");
      const { etag, version } = readSourceVersion(source, fromKey);
      const provenance = copyProvenance(fromKey, version);
      const headers: Record<string, string> = {
        "x-amz-copy-source": `/${args.bucket}/${fromKey.split("/").map(encodeURIComponent).join("/")}`,
        // Pins the copy to the source version the provenance names.
        "x-amz-copy-source-if-match": etag,
        // R2's destination-conditional CopyObject extension, checked when the copy commits;
        // S3's x-amz-copy-source-if-* headers condition only the source.
        "cf-copy-destination-if-none-match": "*",
        // The destination takes exactly the headers below rather than the source's, so it
        // commits fully formed in this one call.
        "x-amz-metadata-directive": "REPLACE",
      };
      for (const name of Object.keys(CARRIED_CONTENT_HEADERS)) {
        const value = source.get(name);
        if (value !== null) headers[name] = value;
      }
      for (const [name, value] of Object.entries(provenance)) headers[`x-amz-meta-${name}`] = value;

      try {
        await fetchWithR2Retry({
          operation: "copy",
          bucket: args.bucket,
          key: toKey,
          seams,
          runAttempt: async () => {
            const res = await signedFetch(objectUrl(toKey), { method: "PUT", headers });
            if (res.ok) return { kind: "success" as const, value: undefined };
            return { kind: "response" as const, response: res };
          },
        });
        return { key: toKey, alreadyPresent: false };
      } catch (e) {
        if (!(e instanceof R2StorageError && e.status === 412)) throw e;
        // R2 answers 412 both for an existing destination and for a source that changed
        // after it was read; only an existing destination can be this copy's result.
        let destination: Headers;
        try {
          destination = await readObjectHeaders(toKey, "copy");
        } catch (readError) {
          if (isObjectNotFoundError(readError)) throw e;
          throw readError;
        }
        if (holdsProvenance((name) => destination.get(`x-amz-meta-${name}`), provenance)) {
          return { key: toKey, alreadyPresent: true };
        }
        throw new ObjectAlreadyExistsError(toKey);
      }
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
        throw new R2StorageError({
          operation: "delete",
          bucket: args.bucket,
          key,
          attempts: 1,
          status: res.status,
          responseText: await safeText(res),
        });
      }
    },

    async deleteCopy({ fromKey, toKey }) {
      let destination: Headers;
      try {
        destination = await readObjectHeaders(toKey, "deleteCopy");
      } catch (e) {
        if (isObjectNotFoundError(e)) return "absent";
        throw e;
      }
      if (!recordsCopyOf((name) => destination.get(`x-amz-meta-${name}`), fromKey)) return "notThisCopy";
      // Unconditioned: R2's DeleteObject honors no precondition header, so none is sent — one
      // it silently ignored would only look like protection. `MediaObjectStore.deleteCopy`
      // states why the gap after the check is harmless. One-shot, like `delete`.
      const res = await signedFetch(objectUrl(toKey), { method: "DELETE" });
      if (res.ok) return "deleted";
      const error = new R2StorageError({
        operation: "deleteCopy",
        bucket: args.bucket,
        key: toKey,
        attempts: 1,
        status: res.status,
        responseText: await safeText(res),
      });
      if (isObjectNotFoundError(error)) return "absent";
      throw error;
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

/**
 * How many times `deleteCopy` checks a Firebase Storage destination before giving up. Keys
 * are write-once, so one change between the check and the delete is already rare; an object
 * still changing after that is left alone and the precondition failure is rethrown.
 */
const DELETE_COPY_MAX_READS = 2;

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
      const [source] = await bucket.file(fromKey).getMetadata();
      const generation = requireStorageObjectGeneration(source, { bucket: bucket.name, key: fromKey });
      const provenance = copyProvenance(fromKey, generation);
      const contentHeaders: Partial<Record<CarriedContentField, string>> = {};
      for (const field of Object.values(CARRIED_CONTENT_HEADERS)) {
        const value = source[field];
        if (typeof value === "string" && value !== "") contentHeaders[field] = value;
      }
      try {
        // A rewrite's resource REPLACES the destination's metadata rather than merging with
        // the source's, so this one call commits the destination fully formed: the source's
        // content headers, the provenance, and this store's token policy — never a token the
        // source carried. The source is pinned to the generation the provenance names, so a
        // 412 can only mean the destination exists; a replaced source fails as not-found.
        await bucket.file(fromKey, { generation }).copy(bucket.file(toKey), {
          ...contentHeaders,
          metadata: downloadToken === null ? provenance : { ...provenance, [DOWNLOAD_TOKENS_METADATA_KEY]: downloadToken },
          preconditionOpts: { ifGenerationMatch: 0 },
        });
        return { key: toKey, alreadyPresent: false };
      } catch (e) {
        if (!isPreconditionFailedError(e)) throw e;
        let destinationMetadata: Record<string, unknown> | undefined;
        try {
          const [destination] = await bucket.file(toKey).getMetadata();
          destinationMetadata = destination.metadata ?? undefined;
        } catch (readError) {
          if (isObjectNotFoundError(readError)) throw e;
          throw readError;
        }
        if (holdsProvenance((name) => destinationMetadata?.[name], provenance)) {
          return { key: toKey, alreadyPresent: true };
        }
        throw new ObjectAlreadyExistsError(toKey);
      }
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

    async deleteCopy({ fromKey, toKey }) {
      const file = bucket.file(toKey);
      for (let read = 1; ; read++) {
        let custom: Record<string, unknown> | undefined;
        let generation: string | number | null | undefined;
        try {
          const [destination] = await file.getMetadata();
          custom = destination.metadata ?? undefined;
          generation = destination.generation;
        } catch (e) {
          if (isObjectNotFoundError(e)) return "absent";
          throw e;
        }
        if (!recordsCopyOf((name) => custom?.[name], fromKey)) return "notThisCopy";
        // The delete names the generation just checked, so it can only remove that object.
        const checked = requireStorageObjectGeneration({ generation }, { bucket: bucket.name, key: toKey });
        try {
          await file.delete({ ifGenerationMatch: checked });
          return "deleted";
        } catch (e) {
          if (isObjectNotFoundError(e)) return "absent";
          // A 412 means the object changed after it was checked: check what is there now.
          if (!isPreconditionFailedError(e) || read >= DELETE_COPY_MAX_READS) throw e;
        }
      }
    },
  };
}

/** The Cloud Storage Admin SDK's numeric `412`: a generation precondition did not hold. */
function isPreconditionFailedError(e: unknown): boolean {
  return (e as { code?: unknown } | null | undefined)?.code === 412;
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
