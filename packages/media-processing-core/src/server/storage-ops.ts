import { createReadStream, createWriteStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { AwsClient } from 'aws4fetch';
import type { getStorage } from 'firebase-admin/storage';
import { NEUTRAL_CONTENT_TYPE } from '@ttt-productions/media-schemas';
import { isObjectNotFoundError } from './gcs-errors.js';
import {
  defaultR2RetrySeams,
  fetchWithR2Retry,
  R2StorageError,
  type R2RetrySeams,
} from './r2-retry.js';
import {
  requireStorageObjectGeneration,
  UnreadableStorageObjectMetadataError,
} from './staged-object.js';

export class ObjectAlreadyExistsError extends Error {
  constructor(public readonly key: string) {
    super('copy destination already holds another object');
    this.name = 'ObjectAlreadyExistsError';
  }
}

/** Inferred from usage so the package takes no @google-cloud/storage dependency. */
export type Bucket = ReturnType<ReturnType<typeof getStorage>['bucket']>;

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
  alreadyPresent: boolean;
}

export type DeleteCopyResult = 'deleted' | 'absent' | 'notThisCopy';

// URI-encoded: R2 carries custom metadata in HTTP headers, which must be ASCII.
const COPY_SOURCE_METADATA_KEY = 'copy-source';
const COPY_SOURCE_VERSION_METADATA_KEY = 'copy-source-version';

type CopyProvenance = Record<
  typeof COPY_SOURCE_METADATA_KEY | typeof COPY_SOURCE_VERSION_METADATA_KEY,
  string
>;

function copyProvenance(fromKey: string, sourceVersion: string): CopyProvenance {
  return {
    [COPY_SOURCE_METADATA_KEY]: encodeURIComponent(fromKey),
    [COPY_SOURCE_VERSION_METADATA_KEY]: encodeURIComponent(sourceVersion),
  };
}

function holdsProvenance(
  readMetadata: (name: string) => unknown,
  provenance: CopyProvenance,
): boolean {
  return Object.entries(provenance).every(([name, value]) => readMetadata(name) === value);
}

function recordsCopyOf(readMetadata: (name: string) => unknown, fromKey: string): boolean {
  const version = readMetadata(COPY_SOURCE_VERSION_METADATA_KEY);
  return (
    readMetadata(COPY_SOURCE_METADATA_KEY) === encodeURIComponent(fromKey) &&
    typeof version === 'string' &&
    version !== ''
  );
}

const CARRIED_CONTENT_HEADERS = {
  'content-type': 'contentType',
  'cache-control': 'cacheControl',
  'content-disposition': 'contentDisposition',
  'content-encoding': 'contentEncoding',
} as const;

type CarriedContentField = (typeof CARRIED_CONTENT_HEADERS)[keyof typeof CARRIED_CONTENT_HEADERS];

export interface MediaObjectStore {
  /** Objects carry a one-year `immutable` cache-control, so a key is write-once: an overwrite keeps serving the old bytes from caches. */
  putFile(args: {
    localPath: string;
    key: string;
    contentType?: string;
  }): Promise<ObjectWriteResult>;
  copy(args: { fromKey: string; toKey: string }): Promise<ObjectCopyResult>;
  readToFile(args: { key: string; localPath: string }): Promise<ObjectReadResult>;
  delete(key: string): Promise<void>;
  deleteCopy(args: { fromKey: string; toKey: string }): Promise<DeleteCopyResult>;
}

const DEFAULT_CACHE_CONTROL = 'public, max-age=31536000, immutable';

export interface CreateR2ObjectStoreArgs {
  accountId: string;
  accessKeyId: string;
  secretAccessKey: string;
  bucket: string;
  endpoint?: string;
  fetchImpl?: typeof fetch;
  sleepImpl?: (ms: number) => Promise<void>;
  randomImpl?: () => number;
  nowImpl?: () => number;
}

export function createR2ObjectStore(args: CreateR2ObjectStoreArgs): MediaObjectStore {
  const endpoint = (args.endpoint ?? `https://${args.accountId}.r2.cloudflarestorage.com`).replace(
    /\/$/,
    '',
  );
  const client = new AwsClient({
    accessKeyId: args.accessKeyId,
    secretAccessKey: args.secretAccessKey,
    service: 's3',
    region: 'auto',
  });
  const doFetch = args.fetchImpl ?? fetch;

  const defaults = defaultR2RetrySeams();
  const seams: R2RetrySeams = {
    sleep: args.sleepImpl ?? defaults.sleep,
    random: args.randomImpl ?? defaults.random,
    now: args.nowImpl ?? defaults.now,
  };

  const objectUrl = (key: string) =>
    `${endpoint}/${args.bucket}/${key.split('/').map(encodeURIComponent).join('/')}`;

  async function signedFetch(
    url: string,
    init: RequestInit & { headers?: Record<string, string> },
  ) {
    const signed = await client.sign(url, { ...init, aws: { allHeaders: true } });
    // Node's fetch rejects a streamed body without `duplex: 'half'`, which the RequestInit type omits.
    const streaming: RequestInit & { duplex?: 'half' } = init.body ? { duplex: 'half' } : {};
    return doFetch(signed, streaming);
  }

  // A GET, not a HEAD: a HEAD's error response has no body, so the S3 error code would be lost.
  async function readObjectHeaders(
    key: string,
    operation: 'copy' | 'deleteCopy',
  ): Promise<Headers> {
    return fetchWithR2Retry({
      operation,
      bucket: args.bucket,
      key,
      seams,
      runAttempt: async () => {
        const res = await signedFetch(objectUrl(key), { method: 'GET' });
        if (!res.ok) return { kind: 'response' as const, response: res };
        await res.body?.cancel();
        return { kind: 'success' as const, value: res.headers };
      },
    });
  }

  // R2 exposes no object version id, so a source version is its ETag, last-modified time, and size together.
  function readSourceVersion(headers: Headers, key: string): { etag: string; version: string } {
    const etag = headers.get('etag');
    if (!etag) throw new UnreadableStorageObjectMetadataError(args.bucket, key, 'etag');
    const lastModified = headers.get('last-modified');
    if (!lastModified)
      throw new UnreadableStorageObjectMetadataError(args.bucket, key, 'lastModified');
    const size = headers.get('content-length');
    if (!size) throw new UnreadableStorageObjectMetadataError(args.bucket, key, 'size');
    return { etag, version: `${etag} ${lastModified} ${size}` };
  }

  return {
    async putFile({ localPath, key, contentType }) {
      const { size } = await stat(localPath);
      const ct = contentType ?? getMimeFromExt(extractExt(localPath));
      return fetchWithR2Retry({
        operation: 'putFile',
        bucket: args.bucket,
        key,
        seams,
        // A fresh signed request and read stream on every attempt: a consumed stream cannot be re-read.
        runAttempt: async () => {
          const res = await signedFetch(objectUrl(key), {
            method: 'PUT',
            headers: {
              'content-type': ct,
              'content-length': String(size),
              'cache-control': DEFAULT_CACHE_CONTROL,
            },
            // Node's fetch streams a Node ReadStream body, which the DOM BodyInit type does not name.
            body: createReadStream(localPath) as unknown as BodyInit,
          });
          if (res.ok) {
            return { kind: 'success' as const, value: { key, sizeBytes: size, contentType: ct } };
          }
          return { kind: 'response' as const, response: res };
        },
      });
    },

    async copy({ fromKey, toKey }) {
      const source = await readObjectHeaders(fromKey, 'copy');
      const { etag, version } = readSourceVersion(source, fromKey);
      const provenance = copyProvenance(fromKey, version);
      const headers: Record<string, string> = {
        'x-amz-copy-source': `/${args.bucket}/${fromKey.split('/').map(encodeURIComponent).join('/')}`,
        'x-amz-copy-source-if-match': etag,
        // R2's destination-conditional CopyObject extension; S3's x-amz-copy-source-if-* headers condition only the source.
        'cf-copy-destination-if-none-match': '*',
        'x-amz-metadata-directive': 'REPLACE',
      };
      for (const name of Object.keys(CARRIED_CONTENT_HEADERS)) {
        const value = source.get(name);
        if (value !== null) headers[name] = value;
      }
      for (const [name, value] of Object.entries(provenance)) headers[`x-amz-meta-${name}`] = value;

      try {
        await fetchWithR2Retry({
          operation: 'copy',
          bucket: args.bucket,
          key: toKey,
          seams,
          runAttempt: async () => {
            const res = await signedFetch(objectUrl(toKey), { method: 'PUT', headers });
            if (res.ok) return { kind: 'success' as const, value: undefined };
            return { kind: 'response' as const, response: res };
          },
        });
        return { key: toKey, alreadyPresent: false };
      } catch (e) {
        if (!(e instanceof R2StorageError && e.status === 412)) throw e;
        // R2 answers 412 both for an existing destination and for a source that changed after it was read.
        let destination: Headers;
        try {
          destination = await readObjectHeaders(toKey, 'copy');
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
        operation: 'readToFile',
        bucket: args.bucket,
        key,
        seams,
        runAttempt: async () => {
          const res = await signedFetch(objectUrl(key), { method: 'GET' });
          if (!res.ok || !res.body) {
            return { kind: 'response' as const, response: res };
          }
          const contentType = res.headers.get('content-type') ?? NEUTRAL_CONTENT_TYPE;
          // Truncating mode ('w') on every attempt, so a partial earlier download never prefixes this one.
          await pipeline(
            Readable.fromWeb(res.body as Parameters<typeof Readable.fromWeb>[0]),
            createWriteStream(localPath, { flags: 'w' }),
          );
          const { size } = await stat(localPath);
          return { kind: 'success' as const, value: { sizeBytes: size, contentType } };
        },
      });
    },

    async delete(key) {
      const res = await signedFetch(objectUrl(key), { method: 'DELETE' });
      // S3 DELETE returns 204 even for missing keys; anything else non-ok is real.
      if (!res.ok && res.status !== 404) {
        throw new R2StorageError({
          operation: 'delete',
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
        destination = await readObjectHeaders(toKey, 'deleteCopy');
      } catch (e) {
        if (isObjectNotFoundError(e)) return 'absent';
        throw e;
      }
      if (!recordsCopyOf((name) => destination.get(`x-amz-meta-${name}`), fromKey))
        return 'notThisCopy';
      // R2's DeleteObject honors no precondition header, so none is sent.
      const res = await signedFetch(objectUrl(toKey), { method: 'DELETE' });
      if (res.ok) return 'deleted';
      const error = new R2StorageError({
        operation: 'deleteCopy',
        bucket: args.bucket,
        key: toKey,
        attempts: 1,
        status: res.status,
        responseText: await safeText(res),
      });
      if (isObjectNotFoundError(error)) return 'absent';
      throw error;
    },
  };
}

async function safeText(res: Response): Promise<string> {
  try {
    return (await res.text()).slice(0, 500);
  } catch {
    return '<no body>';
  }
}

const DOWNLOAD_TOKENS_METADATA_KEY = 'firebaseStorageDownloadTokens';

const DELETE_COPY_MAX_READS = 2;

export interface CreateFirebaseStorageObjectStoreArgs {
  bucket: Bucket;
}

export function createFirebaseStorageObjectStore(
  args: CreateFirebaseStorageObjectStoreArgs,
): MediaObjectStore {
  return createFirebaseStore(args.bucket, null);
}

export interface CreateEmulatorObjectStoreArgs extends CreateFirebaseStorageObjectStoreArgs {
  downloadToken: string;
}

export function createFirebaseEmulatorObjectStore(
  args: CreateEmulatorObjectStoreArgs,
): MediaObjectStore {
  return createFirebaseStore(args.bucket, args.downloadToken);
}

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
      await bucket.upload(localPath, {
        destination: key,
        metadata: {
          contentType: ct,
          cacheControl: DEFAULT_CACHE_CONTROL,
          ...(downloadToken === null
            ? {}
            : { metadata: { [DOWNLOAD_TOKENS_METADATA_KEY]: downloadToken } }),
        },
      });
      return { key, sizeBytes: size, contentType: ct };
    },

    async copy({ fromKey, toKey }) {
      const [source] = await bucket.file(fromKey).getMetadata();
      const generation = requireStorageObjectGeneration(source, {
        bucket: bucket.name,
        key: fromKey,
      });
      const provenance = copyProvenance(fromKey, generation);
      const contentHeaders: Partial<Record<CarriedContentField, string>> = {};
      for (const field of Object.values(CARRIED_CONTENT_HEADERS)) {
        const value = source[field];
        if (typeof value === 'string' && value !== '') contentHeaders[field] = value;
      }
      try {
        // A rewrite's resource replaces the destination's metadata rather than merging with the source's.
        await bucket.file(fromKey, { generation }).copy(bucket.file(toKey), {
          ...contentHeaders,
          metadata:
            downloadToken === null
              ? provenance
              : { ...provenance, [DOWNLOAD_TOKENS_METADATA_KEY]: downloadToken },
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
          if (isObjectNotFoundError(e)) return 'absent';
          throw e;
        }
        if (!recordsCopyOf((name) => custom?.[name], fromKey)) return 'notThisCopy';
        const checked = requireStorageObjectGeneration(
          { generation },
          { bucket: bucket.name, key: toKey },
        );
        try {
          await file.delete({ ifGenerationMatch: checked });
          return 'deleted';
        } catch (e) {
          if (isObjectNotFoundError(e)) return 'absent';
          if (!isPreconditionFailedError(e) || read >= DELETE_COPY_MAX_READS) throw e;
        }
      }
    },
  };
}

function isPreconditionFailedError(e: unknown): boolean {
  return (e as { code?: unknown } | null | undefined)?.code === 412;
}

function extractExt(localPath: string): string {
  return localPath.split('.').pop() || '';
}

export function getMimeFromExt(ext: string): string {
  switch (ext.toLowerCase()) {
    case 'jpg':
    case 'jpeg':
      return 'image/jpeg';
    case 'png':
      return 'image/png';
    case 'webp':
      return 'image/webp';
    case 'mp4':
      return 'video/mp4';
    case 'webm':
      return 'video/webm';
    case 'm4a':
      return 'audio/mp4';
    case 'aac':
      return 'audio/aac';
    case 'mp3':
      return 'audio/mpeg';
    default:
      return NEUTRAL_CONTENT_TYPE;
  }
}
