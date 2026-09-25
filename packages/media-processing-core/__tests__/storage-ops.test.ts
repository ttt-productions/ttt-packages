import { describe, it, expect, vi } from 'vitest';
import { mkdtemp, writeFile, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import {
  createR2ObjectStore,
  createFirebaseEmulatorObjectStore,
  createFirebaseStorageObjectStore,
  getMimeFromExt,
  ObjectAlreadyExistsError,
  R2StorageError,
  type Bucket,
} from '../src/server/storage-ops.js';
import { UnreadableStorageObjectMetadataError } from '../src/server/staged-object.js';
import { isObjectNotFoundError } from '../src/server/gcs-errors.js';

// Track every createReadStream call so the "fresh stream per PUT attempt" test
// can prove a new stream object is created each attempt. Everything else in
// node:fs passes straight through to the real implementation.
const fsHoisted = vi.hoisted(() => ({ readStreamCalls: [] as unknown[] }));
vi.mock('node:fs', async (importOriginal) => {
  const actual = await importOriginal<typeof import('node:fs')>();
  return {
    ...actual,
    createReadStream: (...streamArgs: Parameters<typeof actual.createReadStream>) => {
      const stream = actual.createReadStream(...streamArgs);
      fsHoisted.readStreamCalls.push(stream);
      return stream;
    },
  };
});

async function makeLocalFile(name: string, content = 'bytes'): Promise<string> {
  const dir = await mkdtemp(path.join(tmpdir(), 'storage-ops-'));
  const p = path.join(dir, name);
  await writeFile(p, content);
  return p;
}

function makeR2(fetchImpl: typeof fetch) {
  return createR2ObjectStore({
    accountId: 'acct',
    accessKeyId: 'AKID',
    secretAccessKey: 'SECRET',
    bucket: 'ttt-media-test',
    fetchImpl,
  });
}

describe('createR2ObjectStore', () => {
  it('putFile PUTs to the bucket/key URL with content headers and returns { key } — never a URL', async () => {
    const localPath = await makeLocalFile('clip.mp4', 'vid');
    const fetchMock = vi.fn(async (_input: Request) => new Response(null, { status: 200 }));
    const store = makeR2(fetchMock as unknown as typeof fetch);

    const result = await store.putFile({ localPath, key: 'mediaAssets/asset1/main' });

    expect(result.key).toBe('mediaAssets/asset1/main');
    expect(result.contentType).toBe('video/mp4');
    expect(result.sizeBytes).toBe(3);
    expect(result).not.toHaveProperty('url');
    expect(result).not.toHaveProperty('token');

    const req = fetchMock.mock.calls[0][0];
    expect(req.method).toBe('PUT');
    expect(req.url).toBe('https://acct.r2.cloudflarestorage.com/ttt-media-test/mediaAssets/asset1/main');
    expect(req.headers.get('content-type')).toBe('video/mp4');
    expect(req.headers.get('authorization')).toMatch(/AWS4-HMAC-SHA256/);
  });

  it('putFile throws on a non-ok response', async () => {
    const localPath = await makeLocalFile('a.jpg');
    const fetchMock = vi.fn(async () => new Response('denied', { status: 403 }));
    const store = makeR2(fetchMock as unknown as typeof fetch);
    await expect(store.putFile({ localPath, key: 'k' })).rejects.toThrow(/403/);
  });

  it('delete tolerates 404 (missing object is a no-op)', async () => {
    const fetchMock = vi.fn(async () => new Response(null, { status: 404 }));
    const store = makeR2(fetchMock as unknown as typeof fetch);
    await expect(store.delete('mediaAssets/gone/main')).resolves.toBeUndefined();
  });

  it('delete throws on a real failure', async () => {
    const fetchMock = vi.fn(async () => new Response('boom', { status: 500 }));
    const store = makeR2(fetchMock as unknown as typeof fetch);
    await expect(store.delete('k')).rejects.toThrow(/500/);
  });

  it('a failed delete is an R2StorageError carrying the bucket and key as properties, never in its message', async () => {
    const body = '<Error><Code>InternalError</Code><Key>mediaAssets/asset9/main</Key></Error>';
    const fetchMock = vi.fn(async () => new Response(body, { status: 500 }));

    const error = await makeR2(fetchMock as unknown as typeof fetch)
      .delete('mediaAssets/asset9/main')
      .catch((e: unknown) => e);

    expect(error).toBeInstanceOf(R2StorageError);
    expect(error).toMatchObject({
      operation: 'delete',
      bucket: 'ttt-media-test',
      key: 'mediaAssets/asset9/main',
      attempts: 1,
      status: 500,
    });
    expect((error as Error).message).toBe('R2 delete failed after 1 attempt(s): status 500 InternalError');
  });
});

/**
 * Firebase Admin bucket double for put/read/delete. `file(key)` returns a per-key
 * handle, and every call lands in one ordered `events` log tagged with the key it
 * acted on.
 */
function makeFirebaseBucketMock(
  opts: {
    storedContentType?: string;
    deleteError?: Error;
  } = {},
) {
  const events: Array<{ op: string; key: string; arg?: any; options?: any }> = [];
  const upload = vi.fn(async (_localPath: string, uploadOpts: any) => {
    events.push({ op: 'upload', key: uploadOpts.destination, arg: uploadOpts });
  });
  const file = vi.fn((key: string) => ({
    name: key,
    download: vi.fn(async ({ destination }: { destination: string }) => {
      await writeFile(destination, 'stored-bytes');
      events.push({ op: 'download', key, arg: destination });
    }),
    getMetadata: vi.fn(async () => [{ contentType: opts.storedContentType }]),
    delete: vi.fn(async () => {
      if (opts.deleteError) throw opts.deleteError;
      events.push({ op: 'delete', key });
    }),
  }));
  return { bucket: { name: 'test-bucket', upload, file } as unknown as Bucket, upload, events };
}

describe('createFirebaseStorageObjectStore (deployed, token-free)', () => {
  it('putFile uploads with content type + immutable cache-control and NO download token', async () => {
    const localPath = await makeLocalFile('badge.webp', 'webp!');
    const { bucket, upload } = makeFirebaseBucketMock();
    const store = createFirebaseStorageObjectStore({ bucket });

    const result = await store.putFile({ localPath, key: 'processed/award1/md' });

    expect(result).toEqual({ key: 'processed/award1/md', sizeBytes: 5, contentType: 'image/webp' });
    const [uploadedPath, opts] = upload.mock.calls[0];
    expect(uploadedPath).toBe(localPath);
    expect(opts.destination).toBe('processed/award1/md');
    expect(opts.metadata).toEqual({
      contentType: 'image/webp',
      cacheControl: 'public, max-age=31536000, immutable',
    });
    expect(JSON.stringify(opts)).not.toMatch(/firebaseStorageDownloadTokens/);
  });

  it('putFile honors an explicit content type over the extension', async () => {
    const localPath = await makeLocalFile('main');
    const { bucket, upload } = makeFirebaseBucketMock();
    const store = createFirebaseStorageObjectStore({ bucket });

    const result = await store.putFile({ localPath, key: 'k', contentType: 'image/png' });

    expect(result.contentType).toBe('image/png');
    expect(upload.mock.calls[0][1].metadata.contentType).toBe('image/png');
  });
});

/**
 * In-memory Cloud Storage bucket without object versioning, faithful to what the copy
 * relies on: every write mints a new generation; a rewrite reads the source generation
 * its handle is pinned to (404 once that generation is no longer live), checks
 * `ifGenerationMatch` (0 = no live object) against the LIVE destination when it commits
 * (412), and REPLACES the destination's metadata with the resource it was sent. A delete
 * answers 404 for a missing object and 412 when `ifGenerationMatch` names a generation
 * that is no longer live. The hooks let a test hold a copy before it commits, act before a
 * metadata read, or act before a delete commits.
 */
function makeGcsFake() {
  interface StoredObject {
    bytes: string;
    generation: string;
    contentType?: string;
    cacheControl?: string;
    contentDisposition?: string;
    contentEncoding?: string;
    metadata: Record<string, string>;
  }
  const objects = new Map<string, StoredObject>();
  const calls: Array<{ op: string; key: string; generation?: string; options?: Record<string, unknown> }> = [];
  const hooks: {
    beforeCopyCommit?: () => Promise<void>;
    beforeGetMetadata?: (key: string) => void;
    beforeDelete?: (key: string) => void;
  } = {};
  let nextGeneration = 1_700_000_000_000_001;

  const failure = (code: number, message: string) => Object.assign(new Error(message), { code });

  function write(key: string, object: Omit<StoredObject, 'generation'>): StoredObject {
    const stored = { ...object, generation: String(nextGeneration++) };
    objects.set(key, stored);
    return stored;
  }

  const file = (key: string, fileOptions: { generation?: string | number } = {}) => ({
    name: key,
    async getMetadata() {
      hooks.beforeGetMetadata?.(key);
      calls.push({ op: 'getMetadata', key });
      const live = objects.get(key);
      if (!live) throw failure(404, 'No such object');
      const { bytes: _bytes, ...metadata } = live;
      return [structuredClone(metadata)];
    },
    async copy(dest: { name: string }, options: Record<string, any> = {}) {
      const pinned = fileOptions.generation === undefined ? undefined : String(fileOptions.generation);
      calls.push({ op: 'copy', key, generation: pinned, options: structuredClone(options) });
      await hooks.beforeCopyCommit?.();
      const source = objects.get(key);
      if (!source || (pinned !== undefined && source.generation !== pinned)) throw failure(404, 'No such object');
      const wanted = options.preconditionOpts?.ifGenerationMatch;
      if (wanted !== undefined) {
        const live = objects.get(dest.name);
        if (String(wanted) === '0' ? live !== undefined : live?.generation !== String(wanted)) {
          throw failure(412, 'Precondition Failed');
        }
      }
      const { preconditionOpts: _preconditions, metadata = {}, ...resource } = options;
      const written = write(dest.name, { bytes: source.bytes, ...resource, metadata });
      return [dest, { done: true, resource: { name: dest.name, generation: written.generation } }];
    },
    async delete(options: { ifGenerationMatch?: string | number } = {}) {
      calls.push({ op: 'delete', key, options: structuredClone(options) });
      hooks.beforeDelete?.(key);
      const live = objects.get(key);
      if (!live) throw failure(404, 'No such object');
      if (options.ifGenerationMatch !== undefined && live.generation !== String(options.ifGenerationMatch)) {
        throw failure(412, 'Precondition Failed');
      }
      objects.delete(key);
      return [{}];
    },
  });

  return { bucket: { name: 'fake-bucket', file } as unknown as Bucket, objects, calls, hooks, write };
}

function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>((r) => {
    resolve = r;
  });
  return { promise, resolve };
}

/** Holds every copy at its commit until the test releases it, in arrival order. */
function holdCopies(count: number) {
  const gates = Array.from({ length: count }, deferred);
  let arrivals = 0;
  return {
    hook: () => gates[arrivals++].promise,
    arrived: () => arrivals,
    release: (index: number) => gates[index].resolve(),
  };
}

const settle = <T,>(p: Promise<T>) =>
  p.then(
    (value) => ({ ok: true as const, value }),
    (error: unknown) => ({ ok: false as const, error }),
  );

const SOURCE = 'staging/sig 1.png';
const OTHER_SOURCE = 'staging/sig-2.png';
const KEPT = 'signatures/sig 1.png';
const STAGED = {
  bytes: 'signature-png',
  contentType: 'image/png',
  cacheControl: 'private, max-age=0',
  metadata: { firebaseStorageDownloadTokens: 'source-token' },
};

describe('Firebase Storage copy: never overwrites, idempotent, one call', () => {
  it('a copy onto an absent key commits the destination fully formed in one pinned, conditional rewrite', async () => {
    const gcs = makeGcsFake();
    const source = gcs.write(SOURCE, STAGED);

    await expect(createFirebaseStorageObjectStore({ bucket: gcs.bucket }).copy({ fromKey: SOURCE, toKey: KEPT })).resolves.toEqual({
      key: KEPT,
      alreadyPresent: false,
    });

    const provenance = {
      'copy-source': encodeURIComponent(SOURCE),
      'copy-source-version': source.generation,
    };
    expect(gcs.calls).toEqual([
      { op: 'getMetadata', key: SOURCE },
      {
        op: 'copy',
        key: SOURCE,
        generation: source.generation,
        options: {
          contentType: 'image/png',
          cacheControl: 'private, max-age=0',
          metadata: provenance,
          preconditionOpts: { ifGenerationMatch: 0 },
        },
      },
    ]);
    const { generation: _generation, ...destination } = gcs.objects.get(KEPT)!;
    expect(destination).toEqual({
      bytes: 'signature-png',
      contentType: 'image/png',
      cacheControl: 'private, max-age=0',
      metadata: provenance,
    });
  });

  it('an existing object that is not this copy\'s result makes it throw ObjectAlreadyExistsError and stay untouched', async () => {
    const gcs = makeGcsFake();
    gcs.write(SOURCE, STAGED);
    const existing = structuredClone(gcs.write(KEPT, { bytes: 'someone-else', contentType: 'image/png', metadata: {} }));

    const error = await createFirebaseStorageObjectStore({ bucket: gcs.bucket })
      .copy({ fromKey: SOURCE, toKey: KEPT })
      .catch((e: unknown) => e);

    expect(error).toBeInstanceOf(ObjectAlreadyExistsError);
    expect((error as ObjectAlreadyExistsError).key).toBe(KEPT);
    expect((error as Error).message).not.toContain(KEPT);
    expect(gcs.objects.get(KEPT)).toEqual(existing);
  });

  it('a copy of an earlier version of the same source is not this copy\'s result', async () => {
    const gcs = makeGcsFake();
    const store = createFirebaseStorageObjectStore({ bucket: gcs.bucket });
    gcs.write(SOURCE, STAGED);
    await store.copy({ fromKey: SOURCE, toKey: KEPT });
    const copied = structuredClone(gcs.objects.get(KEPT));
    gcs.write(SOURCE, { ...STAGED, bytes: 'replaced-signature' });

    await expect(store.copy({ fromKey: SOURCE, toKey: KEPT })).rejects.toBeInstanceOf(ObjectAlreadyExistsError);
    expect(gcs.objects.get(KEPT)).toEqual(copied);
  });

  it('a retry of a copy whose answer was lost resolves as already present and leaves the object as it is', async () => {
    const gcs = makeGcsFake();
    const store = createFirebaseStorageObjectStore({ bucket: gcs.bucket });
    gcs.write(SOURCE, STAGED);
    await store.copy({ fromKey: SOURCE, toKey: KEPT });
    const copied = structuredClone(gcs.objects.get(KEPT));

    await expect(store.copy({ fromKey: SOURCE, toKey: KEPT })).resolves.toEqual({ key: KEPT, alreadyPresent: true });
    expect(gcs.objects.get(KEPT)).toEqual(copied);
  });

  it('two racing copies of the same source both succeed and leave the first commit intact', async () => {
    const gcs = makeGcsFake();
    gcs.write(SOURCE, STAGED);
    const held = holdCopies(2);
    gcs.hooks.beforeCopyCommit = held.hook;

    const first = settle(createFirebaseStorageObjectStore({ bucket: gcs.bucket }).copy({ fromKey: SOURCE, toKey: KEPT }));
    const second = settle(createFirebaseStorageObjectStore({ bucket: gcs.bucket }).copy({ fromKey: SOURCE, toKey: KEPT }));
    await vi.waitFor(() => expect(held.arrived()).toBe(2));
    held.release(0);
    expect(await first).toEqual({ ok: true, value: { key: KEPT, alreadyPresent: false } });
    const committed = structuredClone(gcs.objects.get(KEPT));
    held.release(1);

    expect(await second).toEqual({ ok: true, value: { key: KEPT, alreadyPresent: true } });
    expect(gcs.objects.get(KEPT)).toEqual(committed);
  });

  it('two racing copies of different sources: exactly one wins and the other throws ObjectAlreadyExistsError', async () => {
    const gcs = makeGcsFake();
    gcs.write(SOURCE, STAGED);
    gcs.write(OTHER_SOURCE, { ...STAGED, bytes: 'other-signature' });
    const held = holdCopies(2);
    gcs.hooks.beforeCopyCommit = held.hook;

    const winner = settle(createFirebaseStorageObjectStore({ bucket: gcs.bucket }).copy({ fromKey: SOURCE, toKey: KEPT }));
    const loser = settle(createFirebaseStorageObjectStore({ bucket: gcs.bucket }).copy({ fromKey: OTHER_SOURCE, toKey: KEPT }));
    await vi.waitFor(() => expect(held.arrived()).toBe(2));
    held.release(0);
    held.release(1);

    expect(await winner).toEqual({ ok: true, value: { key: KEPT, alreadyPresent: false } });
    const lost = await loser;
    expect(lost.ok).toBe(false);
    expect(!lost.ok && lost.error).toBeInstanceOf(ObjectAlreadyExistsError);
    expect(gcs.objects.get(KEPT)?.bytes).toBe('signature-png');
  });

  it('a source replaced between its read and the copy fails the copy as not-found and writes nothing', async () => {
    const gcs = makeGcsFake();
    gcs.write(SOURCE, STAGED);
    gcs.hooks.beforeCopyCommit = async () => {
      gcs.write(SOURCE, { ...STAGED, bytes: 'replaced-signature' });
    };

    const error = await createFirebaseStorageObjectStore({ bucket: gcs.bucket })
      .copy({ fromKey: SOURCE, toKey: KEPT })
      .catch((e: unknown) => e);

    expect(isObjectNotFoundError(error)).toBe(true);
    expect(gcs.objects.has(KEPT)).toBe(false);
  });

  it('a destination removed before it can be inspected rethrows the precondition failure', async () => {
    const gcs = makeGcsFake();
    gcs.write(SOURCE, STAGED);
    gcs.write(KEPT, { bytes: 'someone-else', metadata: {} });
    gcs.hooks.beforeGetMetadata = (key) => {
      if (key === KEPT) gcs.objects.delete(KEPT);
    };

    const error = await createFirebaseStorageObjectStore({ bucket: gcs.bucket })
      .copy({ fromKey: SOURCE, toKey: KEPT })
      .catch((e: unknown) => e);

    expect(error).toMatchObject({ code: 412 });
    expect(gcs.objects.has(KEPT)).toBe(false);
  });

  it('a source whose metadata names no generation fails the copy before anything is written', async () => {
    const gcs = makeGcsFake();
    gcs.write(SOURCE, STAGED);
    const bucket = {
      name: 'fake-bucket',
      file: (key: string, options?: { generation?: string }) =>
        key === SOURCE && options === undefined
          ? { getMetadata: async () => [{ contentType: 'image/png' }] }
          : (gcs.bucket.file as (k: string, o?: unknown) => unknown)(key, options),
    } as unknown as Bucket;

    const error = await createFirebaseStorageObjectStore({ bucket })
      .copy({ fromKey: SOURCE, toKey: KEPT })
      .catch((e: unknown) => e);

    expect(error).toBeInstanceOf(UnreadableStorageObjectMetadataError);
    expect(error).toMatchObject({ bucket: 'fake-bucket', key: SOURCE, field: 'generation' });
    expect(gcs.objects.has(KEPT)).toBe(false);
  });
});

describe('Firebase Storage deleteCopy: deletes only a copy of the named source', () => {
  /** A fake bucket holding SOURCE and its copy at KEPT, with the call log cleared. */
  async function withCopy() {
    const gcs = makeGcsFake();
    gcs.write(SOURCE, STAGED);
    const store = createFirebaseStorageObjectStore({ bucket: gcs.bucket });
    await store.copy({ fromKey: SOURCE, toKey: KEPT });
    const copied = structuredClone(gcs.objects.get(KEPT)!);
    gcs.calls.length = 0;
    return { gcs, store, copied };
  }

  /** The metadata a copy of `fromKey` records, at a made-up source version. */
  const provenanceOf = (fromKey: string) => ({
    'copy-source': encodeURIComponent(fromKey),
    'copy-source-version': '1700000000000001',
  });

  it('deletes its own copy with a delete conditioned on the generation it checked', async () => {
    const { gcs, store, copied } = await withCopy();

    await expect(store.deleteCopy({ fromKey: SOURCE, toKey: KEPT })).resolves.toBe('deleted');

    expect(gcs.objects.has(KEPT)).toBe(false);
    expect(gcs.objects.has(SOURCE)).toBe(true);
    expect(gcs.calls).toEqual([
      { op: 'getMetadata', key: KEPT },
      { op: 'delete', key: KEPT, options: { ifGenerationMatch: copied.generation } },
    ]);
  });

  it('answers absent for a key with no object and deletes nothing', async () => {
    const gcs = makeGcsFake();

    await expect(
      createFirebaseStorageObjectStore({ bucket: gcs.bucket }).deleteCopy({ fromKey: SOURCE, toKey: KEPT }),
    ).resolves.toBe('absent');
    expect(gcs.calls).toEqual([{ op: 'getMetadata', key: KEPT }]);
  });

  it('leaves a copy of a different source untouched', async () => {
    const gcs = makeGcsFake();
    gcs.write(OTHER_SOURCE, { ...STAGED, bytes: 'other-signature' });
    const store = createFirebaseStorageObjectStore({ bucket: gcs.bucket });
    await store.copy({ fromKey: OTHER_SOURCE, toKey: KEPT });
    const other = structuredClone(gcs.objects.get(KEPT));

    await expect(store.deleteCopy({ fromKey: SOURCE, toKey: KEPT })).resolves.toBe('notThisCopy');

    expect(gcs.objects.get(KEPT)).toEqual(other);
    expect(gcs.calls.some((c) => c.op === 'delete')).toBe(false);
  });

  it.each([
    ['a plain upload with no provenance', {}],
    ['a record naming the source with no source version', { 'copy-source': encodeURIComponent(SOURCE) }],
  ])('leaves %s untouched', async (_label, metadata) => {
    const gcs = makeGcsFake();
    const uploaded = structuredClone(gcs.write(KEPT, { bytes: 'uploaded', contentType: 'image/png', metadata }));

    await expect(
      createFirebaseStorageObjectStore({ bucket: gcs.bucket }).deleteCopy({ fromKey: SOURCE, toKey: KEPT }),
    ).resolves.toBe('notThisCopy');

    expect(gcs.objects.get(KEPT)).toEqual(uploaded);
    expect(gcs.calls.some((c) => c.op === 'delete')).toBe(false);
  });

  it('deletes its own copy after the source object is gone, never reading the source', async () => {
    const { gcs, store } = await withCopy();
    gcs.objects.delete(SOURCE);

    await expect(store.deleteCopy({ fromKey: SOURCE, toKey: KEPT })).resolves.toBe('deleted');

    expect(gcs.objects.has(KEPT)).toBe(false);
    expect(gcs.calls.every((c) => c.key === KEPT)).toBe(true);
  });

  it('never deletes an object that replaced the checked copy: it checks again and leaves the replacement', async () => {
    const { gcs, store, copied } = await withCopy();
    let replacement: unknown;
    gcs.hooks.beforeDelete = () => {
      gcs.hooks.beforeDelete = undefined;
      replacement = structuredClone(gcs.write(KEPT, { bytes: 'other-signature', metadata: provenanceOf(OTHER_SOURCE) }));
    };

    await expect(store.deleteCopy({ fromKey: SOURCE, toKey: KEPT })).resolves.toBe('notThisCopy');

    expect(gcs.objects.get(KEPT)).toEqual(replacement);
    expect(gcs.calls).toEqual([
      { op: 'getMetadata', key: KEPT },
      { op: 'delete', key: KEPT, options: { ifGenerationMatch: copied.generation } },
      { op: 'getMetadata', key: KEPT },
    ]);
  });

  it('a copy of the same source that replaced the checked one is checked again and deleted by its own generation', async () => {
    const { gcs, store, copied } = await withCopy();
    let replacementGeneration = '';
    gcs.hooks.beforeDelete = () => {
      gcs.hooks.beforeDelete = undefined;
      replacementGeneration = gcs.write(KEPT, { bytes: copied.bytes, metadata: copied.metadata }).generation;
    };

    await expect(store.deleteCopy({ fromKey: SOURCE, toKey: KEPT })).resolves.toBe('deleted');

    expect(gcs.objects.has(KEPT)).toBe(false);
    expect(gcs.calls.filter((c) => c.op === 'delete').map((c) => c.options)).toEqual([
      { ifGenerationMatch: copied.generation },
      { ifGenerationMatch: replacementGeneration },
    ]);
  });

  it('answers absent when the checked copy is removed before its delete lands', async () => {
    const { gcs, store } = await withCopy();
    gcs.hooks.beforeDelete = (key) => {
      gcs.objects.delete(key);
    };

    await expect(store.deleteCopy({ fromKey: SOURCE, toKey: KEPT })).resolves.toBe('absent');
  });

  it('rethrows the precondition failure when the object is still changing after its second check, deleting nothing', async () => {
    const { gcs, store, copied } = await withCopy();
    gcs.hooks.beforeDelete = () => {
      gcs.write(KEPT, { bytes: copied.bytes, metadata: copied.metadata });
    };

    const error = await store.deleteCopy({ fromKey: SOURCE, toKey: KEPT }).catch((e: unknown) => e);

    expect(error).toMatchObject({ code: 412 });
    expect(gcs.objects.has(KEPT)).toBe(true);
    expect(gcs.calls.map((c) => c.op)).toEqual(['getMetadata', 'delete', 'getMetadata', 'delete']);
  });

  it('a copy whose metadata names no generation fails before anything is deleted', async () => {
    const { copied } = await withCopy();
    const del = vi.fn(async () => [{}]);
    const bucket = {
      name: 'fake-bucket',
      file: () => ({ getMetadata: async () => [{ metadata: copied.metadata }], delete: del }),
    } as unknown as Bucket;

    const error = await createFirebaseStorageObjectStore({ bucket })
      .deleteCopy({ fromKey: SOURCE, toKey: KEPT })
      .catch((e: unknown) => e);

    expect(error).toBeInstanceOf(UnreadableStorageObjectMetadataError);
    expect(error).toMatchObject({ bucket: 'fake-bucket', key: KEPT, field: 'generation' });
    expect(del).not.toHaveBeenCalled();
  });
});

describe('createFirebaseEmulatorObjectStore', () => {
  function makeBucketMock() {
    const del = vi.fn(async () => undefined);
    const upload = vi.fn(async () => undefined);
    const file = vi.fn(() => ({ delete: del }));
    return { bucket: { upload, file } as unknown as Bucket, upload, file, del };
  }

  it('copy writes the FIXED download token beside the provenance in its one rewrite', async () => {
    const gcs = makeGcsFake();
    const source = gcs.write('mediaAssets/a/main', { bytes: 'img', contentType: 'image/webp', metadata: {} });

    await createFirebaseEmulatorObjectStore({ bucket: gcs.bucket, downloadToken: 'ttt-emulator-media-token' }).copy({
      fromKey: 'mediaAssets/a/main',
      toKey: 'mediaAssets/b/main',
    });

    expect(gcs.objects.get('mediaAssets/b/main')?.metadata).toEqual({
      'copy-source': encodeURIComponent('mediaAssets/a/main'),
      'copy-source-version': source.generation,
      firebaseStorageDownloadTokens: 'ttt-emulator-media-token',
    });
    expect(gcs.calls.map((c) => c.op)).toEqual(['getMetadata', 'copy']);
  });

  it('deleteCopy recognizes its own copy beside the fixed download token', async () => {
    const gcs = makeGcsFake();
    gcs.write('mediaAssets/a/main', { bytes: 'img', contentType: 'image/webp', metadata: {} });
    const store = createFirebaseEmulatorObjectStore({ bucket: gcs.bucket, downloadToken: 'ttt-emulator-media-token' });
    await store.copy({ fromKey: 'mediaAssets/a/main', toKey: 'mediaAssets/b/main' });

    await expect(store.deleteCopy({ fromKey: 'mediaAssets/a/main', toKey: 'mediaAssets/b/main' })).resolves.toBe('deleted');
    expect(gcs.objects.has('mediaAssets/b/main')).toBe(false);
  });

  it('putFile uploads with the FIXED download token attached', async () => {
    const localPath = await makeLocalFile('pic.jpg');
    const { bucket, upload } = makeBucketMock();
    const store = createFirebaseEmulatorObjectStore({ bucket, downloadToken: 'ttt-emulator-media-token' });

    const result = await store.putFile({ localPath, key: 'mediaAssets/asset1/full' });
    expect(result.key).toBe('mediaAssets/asset1/full');
    const [, opts] = upload.mock.calls[0] as unknown as [string, any];
    expect(opts.destination).toBe('mediaAssets/asset1/full');
    expect(opts.metadata.metadata.firebaseStorageDownloadTokens).toBe('ttt-emulator-media-token');
  });

  it('delete swallows not-found errors', async () => {
    const { bucket, del } = makeBucketMock();
    del.mockRejectedValueOnce(Object.assign(new Error('No such object'), { code: 404 }));
    const store = createFirebaseEmulatorObjectStore({ bucket, downloadToken: 't' });
    await expect(store.delete('missing')).resolves.toBeUndefined();
  });
});

// The deployed and emulator Firebase stores are one implementation that differs
// only in token policy; read and delete behave identically in both.
describe.each([
  ['createFirebaseStorageObjectStore', (bucket: Bucket) => createFirebaseStorageObjectStore({ bucket })],
  ['createFirebaseEmulatorObjectStore', (bucket: Bucket) => createFirebaseEmulatorObjectStore({ bucket, downloadToken: 't' })],
] as const)('%s — shared Firebase Storage behavior', (_name, makeStore) => {
  it('readToFile downloads to the local path and reports size + stored content type', async () => {
    const { bucket, events } = makeFirebaseBucketMock({ storedContentType: 'image/webp' });
    const localPath = path.join(await mkdtemp(path.join(tmpdir(), 'storage-ops-')), 'out');

    const result = await makeStore(bucket).readToFile({ key: 'processed/a/md', localPath });

    expect(result).toEqual({ sizeBytes: 'stored-bytes'.length, contentType: 'image/webp' });
    expect(await readFile(localPath, 'utf8')).toBe('stored-bytes');
    expect(events).toEqual([{ op: 'download', key: 'processed/a/md', arg: localPath }]);
  });

  it('readToFile falls back to application/octet-stream when the object has no content type', async () => {
    const { bucket } = makeFirebaseBucketMock();
    const localPath = path.join(await mkdtemp(path.join(tmpdir(), 'storage-ops-')), 'out');
    const result = await makeStore(bucket).readToFile({ key: 'k', localPath });
    expect(result.contentType).toBe('application/octet-stream');
  });

  it('delete removes the object', async () => {
    const { bucket, events } = makeFirebaseBucketMock();
    await makeStore(bucket).delete('processed/a/md');
    expect(events).toEqual([{ op: 'delete', key: 'processed/a/md' }]);
  });

  it('delete of a missing object is a no-op, recognized by the numeric 404 code alone', async () => {
    const { bucket } = makeFirebaseBucketMock({ deleteError: Object.assign(new Error(''), { code: 404 }) });
    await expect(makeStore(bucket).delete('processed/a/md')).resolves.toBeUndefined();
  });

  it('delete rethrows a failure that only says "No such object" in its message', async () => {
    const messageOnly = new Error('No such object: bucket/processed/a/md');
    const { bucket } = makeFirebaseBucketMock({ deleteError: messageOnly });
    await expect(makeStore(bucket).delete('processed/a/md')).rejects.toBe(messageOnly);
  });

  it('delete rethrows a real failure', async () => {
    const { bucket } = makeFirebaseBucketMock({
      deleteError: Object.assign(new Error('Permission denied'), { code: 403 }),
    });
    await expect(makeStore(bucket).delete('k')).rejects.toThrow(/Permission denied/);
  });
});

describe('getMimeFromExt', () => {
  it('maps common extensions', () => {
    expect(getMimeFromExt('jpg')).toBe('image/jpeg');
    expect(getMimeFromExt('mp4')).toBe('video/mp4');
    expect(getMimeFromExt('mp3')).toBe('audio/mpeg');
    expect(getMimeFromExt('xyz')).toBe('application/octet-stream');
  });
});

// ---------------------------------------------------------------------------
// R2 bounded transient retry (plan section 7 / test matrix 13.5)
// ---------------------------------------------------------------------------

interface SeamOverrides {
  sleepImpl?: (ms: number) => Promise<void>;
  randomImpl?: () => number;
  nowImpl?: () => number;
}

function makeR2WithSeams(fetchImpl: typeof fetch, seams: SeamOverrides = {}) {
  return createR2ObjectStore({
    accountId: 'acct',
    accessKeyId: 'AKID',
    secretAccessKey: 'SECRET',
    bucket: 'ttt-media-test',
    fetchImpl,
    ...seams,
  });
}

/**
 * Build a fetch mock that yields one factory result per call, repeating the
 * last factory for any further calls. Factories return a FRESH Response each
 * time (bodies are single-use), or throw to simulate a transport failure.
 */
function fetchSequence(steps: Array<() => Response | Promise<Response>>) {
  let i = 0;
  return vi.fn(async () => {
    const step = steps[Math.min(i, steps.length - 1)];
    i += 1;
    return step();
  }) as unknown as typeof fetch & { mock: { calls: unknown[][] } };
}

const noSleep = async () => {};

describe('createR2ObjectStore — bounded transient retry', () => {
  it('immediate 200 uses exactly one request and never sleeps', async () => {
    const localPath = await makeLocalFile('a.jpg');
    const fetchMock = fetchSequence([() => new Response(null, { status: 200 })]);
    const sleep = vi.fn(noSleep);
    const store = makeR2WithSeams(fetchMock, { sleepImpl: sleep });

    await store.putFile({ localPath, key: 'k' });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(sleep).not.toHaveBeenCalled();
  });

  it('retries a 500 then succeeds using two attempts', async () => {
    const localPath = await makeLocalFile('clip.mp4', 'vid');
    const fetchMock = fetchSequence([
      () => new Response('e', { status: 500 }),
      () => new Response(null, { status: 200 }),
    ]);
    const sleep = vi.fn(noSleep);
    const store = makeR2WithSeams(fetchMock, { sleepImpl: sleep, randomImpl: () => 0 });

    const result = await store.putFile({ localPath, key: 'k' });

    expect(result.sizeBytes).toBe(3);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(sleep).toHaveBeenCalledTimes(1);
  });

  it('stops after exactly three total attempts on a repeated retryable status', async () => {
    const localPath = await makeLocalFile('a.jpg');
    const fetchMock = fetchSequence([() => new Response('e', { status: 500 })]);
    const sleep = vi.fn(noSleep);
    const store = makeR2WithSeams(fetchMock, { sleepImpl: sleep, randomImpl: () => 0 });

    await expect(store.putFile({ localPath, key: 'k' })).rejects.toBeInstanceOf(R2StorageError);
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(sleep).toHaveBeenCalledTimes(2);
  });

  it.each([408, 429, 500, 502, 503, 504])('retries a %i then succeeds (two attempts)', async (status) => {
    const localPath = await makeLocalFile('a.jpg');
    const fetchMock = fetchSequence([
      () => new Response('e', { status }),
      () => new Response(null, { status: 200 }),
    ]);
    const sleep = vi.fn(noSleep);
    const store = makeR2WithSeams(fetchMock, { sleepImpl: sleep, randomImpl: () => 0 });

    await expect(store.putFile({ localPath, key: 'k' })).resolves.toMatchObject({ key: 'k' });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(sleep).toHaveBeenCalledTimes(1);
  });

  it.each([400, 401, 403, 404])('does not retry a %i (fails on the first attempt)', async (status) => {
    const localPath = await makeLocalFile('a.jpg');
    const fetchMock = fetchSequence([() => new Response('no', { status })]);
    const sleep = vi.fn(noSleep);
    const store = makeR2WithSeams(fetchMock, { sleepImpl: sleep });

    await expect(store.putFile({ localPath, key: 'k' })).rejects.toBeInstanceOf(R2StorageError);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(sleep).not.toHaveBeenCalled();
  });

  it('retries a transient fetch/network failure then succeeds', async () => {
    const localPath = await makeLocalFile('a.jpg');
    const fetchMock = fetchSequence([
      () => {
        throw Object.assign(new TypeError('fetch failed'), {
          cause: Object.assign(new Error('read ECONNRESET'), { code: 'ECONNRESET' }),
        });
      },
      () => new Response(null, { status: 200 }),
    ]);
    const sleep = vi.fn(noSleep);
    const store = makeR2WithSeams(fetchMock, { sleepImpl: sleep, randomImpl: () => 0 });

    await store.putFile({ localPath, key: 'k' });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(sleep).toHaveBeenCalledTimes(1);
  });

  it('never retries an explicit AbortError', async () => {
    const localPath = await makeLocalFile('a.jpg');
    const fetchMock = fetchSequence([
      () => {
        const e = new Error('The operation was aborted');
        e.name = 'AbortError';
        throw e;
      },
    ]);
    const sleep = vi.fn(noSleep);
    const store = makeR2WithSeams(fetchMock, { sleepImpl: sleep });

    await expect(store.putFile({ localPath, key: 'k' })).rejects.toThrow(/aborted/);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(sleep).not.toHaveBeenCalled();
  });

  it('honors a delta-seconds Retry-After and adds no backoff on top', async () => {
    const localPath = await makeLocalFile('a.jpg');
    const fetchMock = fetchSequence([
      () => new Response('slow', { status: 503, headers: { 'retry-after': '2' } }),
      () => new Response(null, { status: 200 }),
    ]);
    const sleep = vi.fn(noSleep);
    // random 0.999 would dominate if backoff were (wrongly) added on top.
    const store = makeR2WithSeams(fetchMock, { sleepImpl: sleep, randomImpl: () => 0.999 });

    await store.putFile({ localPath, key: 'k' });
    expect(sleep).toHaveBeenCalledTimes(1);
    expect(sleep).toHaveBeenCalledWith(2000);
  });

  it('honors an HTTP-date Retry-After using the injected clock seam', async () => {
    const localPath = await makeLocalFile('a.jpg');
    const now = 1_700_000_000_000; // whole-second epoch so toUTCString round-trips exactly
    const when = new Date(now + 3000).toUTCString();
    const fetchMock = fetchSequence([
      () => new Response('slow', { status: 503, headers: { 'retry-after': when } }),
      () => new Response(null, { status: 200 }),
    ]);
    const sleep = vi.fn(noSleep);
    const store = makeR2WithSeams(fetchMock, { sleepImpl: sleep, nowImpl: () => now });

    await store.putFile({ localPath, key: 'k' });
    expect(sleep).toHaveBeenCalledWith(3000);
  });

  it('caps an excessive Retry-After at 30s', async () => {
    const localPath = await makeLocalFile('a.jpg');
    const fetchMock = fetchSequence([
      () => new Response('slow', { status: 503, headers: { 'retry-after': '120' } }),
      () => new Response(null, { status: 200 }),
    ]);
    const sleep = vi.fn(noSleep);
    const store = makeR2WithSeams(fetchMock, { sleepImpl: sleep });

    await store.putFile({ localPath, key: 'k' });
    expect(sleep).toHaveBeenCalledWith(30000);
  });

  it('uses deterministic full-jitter backoff from the injected random when no Retry-After', async () => {
    const localPath = await makeLocalFile('a.jpg');
    const fetchMock = fetchSequence([
      () => new Response('e', { status: 500 }),
      () => new Response(null, { status: 200 }),
    ]);
    const sleep = vi.fn(noSleep);
    const store = makeR2WithSeams(fetchMock, { sleepImpl: sleep, randomImpl: () => 0.5 });

    await store.putFile({ localPath, key: 'k' });
    // floor(0.5 * min(5000, 250 * 2 ** 0)) = floor(125) = 125
    expect(sleep).toHaveBeenCalledWith(125);
  });

  it('signs a fresh, distinct request on every attempt', async () => {
    const localPath = await makeLocalFile('a.jpg');
    const fetchMock = fetchSequence([
      () => new Response('e', { status: 500 }),
      () => new Response(null, { status: 200 }),
    ]);
    const store = makeR2WithSeams(fetchMock, { sleepImpl: noSleep, randomImpl: () => 0 });

    await store.putFile({ localPath, key: 'k' });

    const req0 = fetchMock.mock.calls[0][0] as Request;
    const req1 = fetchMock.mock.calls[1][0] as Request;
    expect(req0).not.toBe(req1);
    expect(req0.headers.get('authorization')).toMatch(/AWS4-HMAC-SHA256/);
    expect(req1.headers.get('authorization')).toMatch(/AWS4-HMAC-SHA256/);
  });

  it('creates a fresh read stream for every PUT attempt', async () => {
    fsHoisted.readStreamCalls.length = 0;
    const localPath = await makeLocalFile('a.jpg');
    const fetchMock = fetchSequence([
      () => new Response('e', { status: 500 }),
      () => new Response(null, { status: 200 }),
    ]);
    const store = makeR2WithSeams(fetchMock, { sleepImpl: noSleep, randomImpl: () => 0 });

    await store.putFile({ localPath, key: 'k' });

    expect(fsHoisted.readStreamCalls.length).toBe(2);
    expect(fsHoisted.readStreamCalls[0]).not.toBe(fsHoisted.readStreamCalls[1]);
  });

  it('reads/consumes the failed response body before the next attempt', async () => {
    let consumed = false;
    const localPath = await makeLocalFile('a.jpg');
    const fetchMock = fetchSequence([
      () => {
        const body = new ReadableStream<Uint8Array>({
          pull(controller) {
            consumed = true;
            controller.enqueue(new TextEncoder().encode('<Error>transient</Error>'));
            controller.close();
          },
        });
        return new Response(body, { status: 500 });
      },
      () => new Response(null, { status: 200 }),
    ]);
    const store = makeR2WithSeams(fetchMock, { sleepImpl: noSleep, randomImpl: () => 0 });

    await store.putFile({ localPath, key: 'k' });
    expect(consumed).toBe(true);
  });

  it('copy retries a 500 then succeeds, re-sending the exact same conditional CopyObject', async () => {
    const r2 = makeR2Fake();
    r2.write('mediaAssets/a/main', { body: 'img', headers: { 'content-type': 'image/webp' } });
    r2.hooks.failNextCopyWith = 500;

    const result = await makeR2WithSeams(r2.fetchImpl, { sleepImpl: noSleep, randomImpl: () => 0 }).copy({
      fromKey: 'mediaAssets/a/main',
      toKey: 'mediaAssets/b/main',
    });

    expect(result).toEqual({ key: 'mediaAssets/b/main', alreadyPresent: false });
    const puts = r2.requests.filter((r) => r.method === 'PUT');
    expect(puts).toHaveLength(2);
    const conditions = (h: Record<string, string>) => ({
      source: h['x-amz-copy-source'],
      sourceMatch: h['x-amz-copy-source-if-match'],
      destinationNoneMatch: h['cf-copy-destination-if-none-match'],
    });
    expect(conditions(puts[0].headers)).toEqual({
      source: '/ttt-media-test/mediaAssets/a/main',
      sourceMatch: r2.objects.get('mediaAssets/a/main')?.etag,
      destinationNoneMatch: '*',
    });
    expect(conditions(puts[1].headers)).toEqual(conditions(puts[0].headers));
  });

  it('readToFile retries a 500 then streams the successful body to disk', async () => {
    const fetchMock = fetchSequence([
      () => new Response('e', { status: 500 }),
      () => new Response('HELLO', { status: 200, headers: { 'content-type': 'image/png' } }),
    ]);
    const store = makeR2WithSeams(fetchMock, { sleepImpl: noSleep, randomImpl: () => 0 });
    const dir = await mkdtemp(path.join(tmpdir(), 'r2-read-'));
    const dest = path.join(dir, 'out.bin');

    const result = await store.readToFile({ key: 'k', localPath: dest });

    expect(result.contentType).toBe('image/png');
    expect(await readFile(dest, 'utf8')).toBe('HELLO');
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('readToFile retry truncates a partial destination (no prefix from the failed attempt)', async () => {
    const encoder = new TextEncoder();
    const fetchMock = fetchSequence([
      () => {
        // A 200 whose body errors mid-stream after writing a partial chunk.
        const body = new ReadableStream<Uint8Array>({
          start(controller) {
            controller.enqueue(encoder.encode('PARTIAL-GARBAGE'));
            controller.error(Object.assign(new Error('socket hang up'), { code: 'ECONNRESET' }));
          },
        });
        return new Response(body, { status: 200, headers: { 'content-type': 'image/jpeg' } });
      },
      () => new Response('CLEAN-FULL-CONTENT', { status: 200, headers: { 'content-type': 'image/jpeg' } }),
    ]);
    const store = makeR2WithSeams(fetchMock, { sleepImpl: noSleep, randomImpl: () => 0 });
    const dir = await mkdtemp(path.join(tmpdir(), 'r2-read-'));
    const dest = path.join(dir, 'out.bin');

    const result = await store.readToFile({ key: 'k', localPath: dest });

    expect(result.contentType).toBe('image/jpeg');
    expect(await readFile(dest, 'utf8')).toBe('CLEAN-FULL-CONTENT');
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('exhaustion throws an R2StorageError carrying operation/status/attempts, with no credentials or signed URL', async () => {
    const localPath = await makeLocalFile('a.jpg');
    const fetchMock = fetchSequence([() => new Response('<Error>InternalError</Error>', { status: 500 })]);
    const store = makeR2WithSeams(fetchMock, { sleepImpl: noSleep, randomImpl: () => 0 });

    let caught: unknown;
    try {
      await store.putFile({ localPath, key: 'mediaAssets/x/main' });
    } catch (e) {
      caught = e;
    }

    expect(caught).toBeInstanceOf(R2StorageError);
    const err = caught as R2StorageError;
    expect(err.operation).toBe('putFile');
    expect(err.status).toBe(500);
    expect(err.attempts).toBe(3);
    expect(err.key).toBe('mediaAssets/x/main');
    expect(fetchMock).toHaveBeenCalledTimes(3);

    const serialized = `${err.message} ${err.operation} ${err.key} ${err.responseText ?? ''}`;
    expect(serialized).not.toContain('SECRET');
    expect(serialized).not.toContain('AKID');
    expect(serialized.toLowerCase()).not.toContain('authorization');
    expect(serialized).not.toContain('X-Amz-Signature');
  });

  it('an R2StorageError message names the S3 error code but never the bucket, the key, or a body that echoes them', async () => {
    const body =
      '<?xml version="1.0"?><Error><Code>NoSuchKey</Code><Message>The specified key does not exist.</Message>' +
      '<Key>mediaAssets/asset9/main</Key><BucketName>ttt-media-test</BucketName></Error>';
    const fetchMock = fetchSequence([() => new Response(body, { status: 404 })]);
    const dest = path.join(await mkdtemp(path.join(tmpdir(), 'r2-read-')), 'out.bin');

    const error = await makeR2WithSeams(fetchMock, { sleepImpl: noSleep })
      .readToFile({ key: 'mediaAssets/asset9/main', localPath: dest })
      .catch((e: unknown) => e);

    expect(error).toBeInstanceOf(R2StorageError);
    expect(error).toMatchObject({ bucket: 'ttt-media-test', key: 'mediaAssets/asset9/main', status: 404 });
    expect((error as R2StorageError).responseText).toContain('<Key>mediaAssets/asset9/main</Key>');
    expect((error as Error).message).toBe('R2 readToFile failed after 1 attempt(s): status 404 NoSuchKey');
    expect(isObjectNotFoundError(error)).toBe(true);
  });

  it('delete makes exactly one request even on a 500 (never retried)', async () => {
    const fetchMock = fetchSequence([() => new Response('boom', { status: 500 })]);
    const sleep = vi.fn(noSleep);
    const store = makeR2WithSeams(fetchMock, { sleepImpl: sleep });

    await expect(store.delete('k')).rejects.toThrow(/500/);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(sleep).not.toHaveBeenCalled();
  });

  it('delete makes exactly one request even on a transient network failure (never retried)', async () => {
    const fetchMock = fetchSequence([
      () => {
        throw Object.assign(new TypeError('fetch failed'), {
          cause: Object.assign(new Error('reset'), { code: 'ECONNRESET' }),
        });
      },
    ]);
    const sleep = vi.fn(noSleep);
    const store = makeR2WithSeams(fetchMock, { sleepImpl: sleep });

    await expect(store.delete('k')).rejects.toThrow();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(sleep).not.toHaveBeenCalled();
  });
});

/**
 * In-memory R2 behind the store's S3 requests, faithful to what the copy relies on: a GET
 * answers an object's headers (404 `NoSuchKey` with an XML body when absent); a CopyObject
 * checks `x-amz-copy-source-if-match` against the source's ETag and
 * `cf-copy-destination-if-none-match: *` against the destination when it commits (412
 * `PreconditionFailed`), and with the REPLACE directive writes exactly the request's content
 * headers and `x-amz-meta-*`. A copy gets an ETag of its own, never its source's. A DELETE
 * honors no precondition header, as R2's DeleteObject does not, and answers 204 whether or
 * not an object was there.
 */
function makeR2Fake() {
  interface R2Object {
    body: string;
    etag: string;
    lastModified: string;
    headers: Record<string, string>;
  }
  const CONTENT_HEADERS = ['content-type', 'cache-control', 'content-disposition', 'content-encoding'];
  const objects = new Map<string, R2Object>();
  const requests: Array<{ method: string; key: string; headers: Record<string, string> }> = [];
  const hooks: {
    beforeCopyCommit?: () => Promise<void>;
    failNextCopyWith?: number;
    loseNextCopyResponse?: boolean;
    beforeDelete?: () => Promise<void>;
    failNextDeleteWith?: number;
    failGetsWith?: number;
  } = {};
  let clock = Date.UTC(2030, 0, 1);
  let etags = 0;

  const s3Error = (status: number, code: string) =>
    new Response(`<?xml version="1.0" encoding="UTF-8"?><Error><Code>${code}</Code></Error>`, { status });
  const keyOf = (path: string) => path.split('/').slice(2).map(decodeURIComponent).join('/');

  function write(key: string, object: { body: string; etag?: string; headers?: Record<string, string> }): R2Object {
    clock += 1000;
    const stored = {
      body: object.body,
      etag: object.etag ?? `"copy-etag-${++etags}"`,
      lastModified: new Date(clock).toUTCString(),
      headers: object.headers ?? {},
    };
    objects.set(key, stored);
    return stored;
  }

  const fetchImpl = (async (req: Request) => {
    const key = keyOf(new URL(req.url).pathname);
    const headers = Object.fromEntries(req.headers);
    requests.push({ method: req.method, key, headers });
    if (req.method === 'GET') {
      if (hooks.failGetsWith) return s3Error(hooks.failGetsWith, 'InternalError');
      const object = objects.get(key);
      if (!object) return s3Error(404, 'NoSuchKey');
      return new Response(object.body, {
        status: 200,
        headers: {
          ...object.headers,
          etag: object.etag,
          'last-modified': object.lastModified,
          'content-length': String(object.body.length),
        },
      });
    }
    if (req.method === 'PUT' && headers['x-amz-copy-source']) {
      if (hooks.failNextCopyWith) {
        const status = hooks.failNextCopyWith;
        hooks.failNextCopyWith = undefined;
        return s3Error(status, 'InternalError');
      }
      await hooks.beforeCopyCommit?.();
      const source = objects.get(keyOf(headers['x-amz-copy-source']));
      if (!source) return s3Error(404, 'NoSuchKey');
      const sourceMatch = headers['x-amz-copy-source-if-match'];
      if (sourceMatch !== undefined && sourceMatch !== source.etag) return s3Error(412, 'PreconditionFailed');
      if (headers['cf-copy-destination-if-none-match'] === '*' && objects.has(key)) return s3Error(412, 'PreconditionFailed');
      const written =
        headers['x-amz-metadata-directive'] === 'REPLACE'
          ? Object.fromEntries(
              Object.entries(headers).filter(([name]) => name.startsWith('x-amz-meta-') || CONTENT_HEADERS.includes(name)),
            )
          : source.headers;
      write(key, { body: source.body, headers: written });
      if (hooks.loseNextCopyResponse) {
        hooks.loseNextCopyResponse = false;
        throw Object.assign(new TypeError('fetch failed'), {
          cause: Object.assign(new Error('socket hang up'), { code: 'ECONNRESET' }),
        });
      }
      return new Response('<CopyObjectResult/>', { status: 200 });
    }
    if (req.method === 'DELETE') {
      if (hooks.failNextDeleteWith) {
        const status = hooks.failNextDeleteWith;
        hooks.failNextDeleteWith = undefined;
        return s3Error(status, 'InternalError');
      }
      await hooks.beforeDelete?.();
      objects.delete(key);
      return new Response(null, { status: 204 });
    }
    return new Response('unexpected request', { status: 501 });
  }) as unknown as typeof fetch;

  return { fetchImpl, objects, requests, hooks, write };
}

describe('R2 copy: never overwrites, idempotent, one call', () => {
  const R2_SOURCE = 'mediaAssets/src 1/main';
  const R2_OTHER_SOURCE = 'mediaAssets/src-2/main';
  const R2_KEPT = 'mediaAssets/copy-1/main';
  const R2_STAGED = {
    body: 'video-bytes',
    headers: { 'content-type': 'video/mp4', 'cache-control': 'public, max-age=31536000, immutable' },
  };

  const store = (fetchImpl: typeof fetch) => makeR2WithSeams(fetchImpl, { sleepImpl: noSleep, randomImpl: () => 0 });

  it('a copy onto an absent key commits in one conditional CopyObject carrying the content headers and provenance', async () => {
    const r2 = makeR2Fake();
    const source = r2.write(R2_SOURCE, R2_STAGED);

    await expect(store(r2.fetchImpl).copy({ fromKey: R2_SOURCE, toKey: R2_KEPT })).resolves.toEqual({
      key: R2_KEPT,
      alreadyPresent: false,
    });

    expect(r2.requests.map((r) => `${r.method} ${r.key}`)).toEqual([`GET ${R2_SOURCE}`, `PUT ${R2_KEPT}`]);
    const provenance = {
      'x-amz-meta-copy-source': encodeURIComponent(R2_SOURCE),
      'x-amz-meta-copy-source-version': encodeURIComponent(`${source.etag} ${source.lastModified} ${R2_STAGED.body.length}`),
    };
    expect(r2.requests[1].headers).toMatchObject({
      'x-amz-copy-source': `/ttt-media-test/${R2_SOURCE.split('/').map(encodeURIComponent).join('/')}`,
      'x-amz-copy-source-if-match': source.etag,
      'cf-copy-destination-if-none-match': '*',
      'x-amz-metadata-directive': 'REPLACE',
      ...R2_STAGED.headers,
      ...provenance,
    });
    expect(r2.objects.get(R2_KEPT)).toMatchObject({ body: R2_STAGED.body, headers: { ...R2_STAGED.headers, ...provenance } });
  });

  it("an existing object that is not this copy's result makes it throw ObjectAlreadyExistsError and stay untouched", async () => {
    const r2 = makeR2Fake();
    r2.write(R2_SOURCE, R2_STAGED);
    const existing = structuredClone(r2.write(R2_KEPT, { body: 'someone-else', headers: { 'content-type': 'video/mp4' } }));

    const error = await store(r2.fetchImpl)
      .copy({ fromKey: R2_SOURCE, toKey: R2_KEPT })
      .catch((e: unknown) => e);

    expect(error).toBeInstanceOf(ObjectAlreadyExistsError);
    expect((error as ObjectAlreadyExistsError).key).toBe(R2_KEPT);
    expect((error as Error).message).not.toContain(R2_KEPT);
    expect(r2.objects.get(R2_KEPT)).toEqual(existing);
  });

  it('a retry after a lost response resolves as already present', async () => {
    const r2 = makeR2Fake();
    r2.write(R2_SOURCE, R2_STAGED);
    r2.hooks.loseNextCopyResponse = true;

    await expect(store(r2.fetchImpl).copy({ fromKey: R2_SOURCE, toKey: R2_KEPT })).resolves.toEqual({
      key: R2_KEPT,
      alreadyPresent: true,
    });
    expect(r2.requests.map((r) => `${r.method} ${r.key}`)).toEqual([
      `GET ${R2_SOURCE}`,
      `PUT ${R2_KEPT}`,
      `PUT ${R2_KEPT}`,
      `GET ${R2_KEPT}`,
    ]);
  });

  it('a multipart source is recognized by its provenance, never by comparing ETags', async () => {
    const r2 = makeR2Fake();
    const multipartEtag = '"3858f62230ac3c915f300c664312c11f-3"';
    r2.write(R2_SOURCE, { ...R2_STAGED, etag: multipartEtag });
    await store(r2.fetchImpl).copy({ fromKey: R2_SOURCE, toKey: R2_KEPT });
    const copied = structuredClone(r2.objects.get(R2_KEPT));
    expect(copied?.etag).not.toBe(multipartEtag);

    await expect(store(r2.fetchImpl).copy({ fromKey: R2_SOURCE, toKey: R2_KEPT })).resolves.toEqual({
      key: R2_KEPT,
      alreadyPresent: true,
    });
    expect(r2.objects.get(R2_KEPT)).toEqual(copied);
  });

  it("a copy of an earlier version of the same source is not this copy's result", async () => {
    const r2 = makeR2Fake();
    r2.write(R2_SOURCE, R2_STAGED);
    await store(r2.fetchImpl).copy({ fromKey: R2_SOURCE, toKey: R2_KEPT });
    const copied = structuredClone(r2.objects.get(R2_KEPT));
    r2.write(R2_SOURCE, { ...R2_STAGED, body: 'replaced-video' });

    await expect(store(r2.fetchImpl).copy({ fromKey: R2_SOURCE, toKey: R2_KEPT })).rejects.toBeInstanceOf(ObjectAlreadyExistsError);
    expect(r2.objects.get(R2_KEPT)).toEqual(copied);
  });

  it('two racing copies of the same source both succeed and leave the first commit intact', async () => {
    const r2 = makeR2Fake();
    r2.write(R2_SOURCE, R2_STAGED);
    const held = holdCopies(2);
    r2.hooks.beforeCopyCommit = held.hook;

    const first = settle(store(r2.fetchImpl).copy({ fromKey: R2_SOURCE, toKey: R2_KEPT }));
    const second = settle(store(r2.fetchImpl).copy({ fromKey: R2_SOURCE, toKey: R2_KEPT }));
    await vi.waitFor(() => expect(held.arrived()).toBe(2));
    held.release(0);
    expect(await first).toEqual({ ok: true, value: { key: R2_KEPT, alreadyPresent: false } });
    const committed = structuredClone(r2.objects.get(R2_KEPT));
    held.release(1);

    expect(await second).toEqual({ ok: true, value: { key: R2_KEPT, alreadyPresent: true } });
    expect(r2.objects.get(R2_KEPT)).toEqual(committed);
    expect(r2.requests.some((r) => r.method === 'DELETE')).toBe(false);
  });

  it('two racing copies of different sources: exactly one wins and the other throws ObjectAlreadyExistsError', async () => {
    const r2 = makeR2Fake();
    r2.write(R2_SOURCE, R2_STAGED);
    r2.write(R2_OTHER_SOURCE, { ...R2_STAGED, body: 'other-video' });
    const held = holdCopies(2);
    r2.hooks.beforeCopyCommit = held.hook;

    const winner = settle(store(r2.fetchImpl).copy({ fromKey: R2_SOURCE, toKey: R2_KEPT }));
    const loser = settle(store(r2.fetchImpl).copy({ fromKey: R2_OTHER_SOURCE, toKey: R2_KEPT }));
    await vi.waitFor(() => expect(held.arrived()).toBe(2));
    held.release(0);
    held.release(1);

    expect(await winner).toEqual({ ok: true, value: { key: R2_KEPT, alreadyPresent: false } });
    const lost = await loser;
    expect(lost.ok).toBe(false);
    expect(!lost.ok && lost.error).toBeInstanceOf(ObjectAlreadyExistsError);
    expect(r2.objects.get(R2_KEPT)?.body).toBe(R2_STAGED.body);
  });

  it('a source replaced after its read rethrows the precondition failure and writes nothing', async () => {
    const r2 = makeR2Fake();
    r2.write(R2_SOURCE, R2_STAGED);
    r2.hooks.beforeCopyCommit = async () => {
      r2.write(R2_SOURCE, { ...R2_STAGED, body: 'replaced-video' });
    };

    const error = await store(r2.fetchImpl)
      .copy({ fromKey: R2_SOURCE, toKey: R2_KEPT })
      .catch((e: unknown) => e);

    expect(error).toBeInstanceOf(R2StorageError);
    expect(error).toMatchObject({ status: 412, s3ErrorCode: 'PreconditionFailed' });
    expect(r2.objects.has(R2_KEPT)).toBe(false);
  });

  it('a missing source fails the copy with an error recognized as not-found', async () => {
    const r2 = makeR2Fake();

    const error = await store(r2.fetchImpl)
      .copy({ fromKey: R2_SOURCE, toKey: R2_KEPT })
      .catch((e: unknown) => e);

    expect(error).toMatchObject({ status: 404, s3ErrorCode: 'NoSuchKey', key: R2_SOURCE });
    expect(isObjectNotFoundError(error)).toBe(true);
    expect(r2.requests.map((r) => r.method)).toEqual(['GET']);
  });

  it('a source read without an ETag fails the copy before anything is written', async () => {
    const fetchImpl = vi.fn(
      async () => new Response('bytes', { status: 200, headers: { 'last-modified': 'x', 'content-length': '5' } }),
    );

    const error = await store(fetchImpl as unknown as typeof fetch)
      .copy({ fromKey: R2_SOURCE, toKey: R2_KEPT })
      .catch((e: unknown) => e);

    expect(error).toBeInstanceOf(UnreadableStorageObjectMetadataError);
    expect(error).toMatchObject({ bucket: 'ttt-media-test', key: R2_SOURCE, field: 'etag' });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });
});

describe('R2 deleteCopy: deletes only a copy of the named source', () => {
  const R2_SOURCE = 'mediaAssets/src 1/main';
  const R2_OTHER_SOURCE = 'mediaAssets/src-2/main';
  const R2_KEPT = 'mediaAssets/copy-1/main';
  const R2_STAGED = {
    body: 'video-bytes',
    headers: { 'content-type': 'video/mp4', 'cache-control': 'public, max-age=31536000, immutable' },
  };

  const store = (fetchImpl: typeof fetch) => makeR2WithSeams(fetchImpl, { sleepImpl: noSleep, randomImpl: () => 0 });

  /** A fake R2 holding R2_SOURCE and its copy at R2_KEPT, with the request log cleared. */
  async function withCopy() {
    const r2 = makeR2Fake();
    r2.write(R2_SOURCE, R2_STAGED);
    await store(r2.fetchImpl).copy({ fromKey: R2_SOURCE, toKey: R2_KEPT });
    const copied = structuredClone(r2.objects.get(R2_KEPT)!);
    r2.requests.length = 0;
    return { r2, copied };
  }

  it('deletes its own copy: one read of the destination, then one DELETE carrying no precondition R2 would ignore', async () => {
    const { r2 } = await withCopy();

    await expect(store(r2.fetchImpl).deleteCopy({ fromKey: R2_SOURCE, toKey: R2_KEPT })).resolves.toBe('deleted');

    expect(r2.objects.has(R2_KEPT)).toBe(false);
    expect(r2.objects.has(R2_SOURCE)).toBe(true);
    expect(r2.requests.map((r) => `${r.method} ${r.key}`)).toEqual([`GET ${R2_KEPT}`, `DELETE ${R2_KEPT}`]);
    expect(Object.keys(r2.requests[1].headers).filter((name) => name.startsWith('if-'))).toEqual([]);
  });

  it('answers absent for a key with no object and sends no DELETE', async () => {
    const r2 = makeR2Fake();

    await expect(store(r2.fetchImpl).deleteCopy({ fromKey: R2_SOURCE, toKey: R2_KEPT })).resolves.toBe('absent');
    expect(r2.requests.map((r) => r.method)).toEqual(['GET']);
  });

  it('leaves a copy of a different source untouched and sends no DELETE', async () => {
    const r2 = makeR2Fake();
    r2.write(R2_OTHER_SOURCE, { ...R2_STAGED, body: 'other-video' });
    await store(r2.fetchImpl).copy({ fromKey: R2_OTHER_SOURCE, toKey: R2_KEPT });
    const other = structuredClone(r2.objects.get(R2_KEPT));

    await expect(store(r2.fetchImpl).deleteCopy({ fromKey: R2_SOURCE, toKey: R2_KEPT })).resolves.toBe('notThisCopy');

    expect(r2.objects.get(R2_KEPT)).toEqual(other);
    expect(r2.requests.some((r) => r.method === 'DELETE')).toBe(false);
  });

  it.each([
    ['a plain upload with no provenance', { 'content-type': 'video/mp4' }],
    [
      'a record naming the source with no source version',
      { 'content-type': 'video/mp4', 'x-amz-meta-copy-source': encodeURIComponent(R2_SOURCE) },
    ],
  ])('leaves %s untouched', async (_label, headers) => {
    const r2 = makeR2Fake();
    const uploaded = structuredClone(r2.write(R2_KEPT, { body: 'uploaded', headers }));

    await expect(store(r2.fetchImpl).deleteCopy({ fromKey: R2_SOURCE, toKey: R2_KEPT })).resolves.toBe('notThisCopy');

    expect(r2.objects.get(R2_KEPT)).toEqual(uploaded);
    expect(r2.requests.some((r) => r.method === 'DELETE')).toBe(false);
  });

  it('deletes its own copy after the source object is gone, never reading the source', async () => {
    const { r2 } = await withCopy();
    r2.objects.delete(R2_SOURCE);

    await expect(store(r2.fetchImpl).deleteCopy({ fromKey: R2_SOURCE, toKey: R2_KEPT })).resolves.toBe('deleted');

    expect(r2.objects.has(R2_KEPT)).toBe(false);
    expect(r2.requests.every((r) => r.key === R2_KEPT)).toBe(true);
  });

  it('the key stays write-once between the check and the unconditioned delete: a copy of another source cannot land there', async () => {
    const { r2, copied } = await withCopy();
    r2.write(R2_OTHER_SOURCE, { ...R2_STAGED, body: 'other-video' });
    let landing: Awaited<ReturnType<typeof settle>> | undefined;
    let heldAtDelete: unknown;
    r2.hooks.beforeDelete = async () => {
      r2.hooks.beforeDelete = undefined;
      landing = await settle(store(r2.fetchImpl).copy({ fromKey: R2_OTHER_SOURCE, toKey: R2_KEPT }));
      heldAtDelete = structuredClone(r2.objects.get(R2_KEPT));
    };

    await expect(store(r2.fetchImpl).deleteCopy({ fromKey: R2_SOURCE, toKey: R2_KEPT })).resolves.toBe('deleted');

    expect(landing?.ok).toBe(false);
    expect(!landing?.ok && landing?.error).toBeInstanceOf(ObjectAlreadyExistsError);
    expect(heldAtDelete).toEqual(copied);
    expect(r2.objects.has(R2_KEPT)).toBe(false);
  });

  it('a destination read that keeps failing is a retried R2StorageError naming deleteCopy, and nothing is deleted', async () => {
    const { r2 } = await withCopy();
    r2.hooks.failGetsWith = 500;

    const error = await store(r2.fetchImpl)
      .deleteCopy({ fromKey: R2_SOURCE, toKey: R2_KEPT })
      .catch((e: unknown) => e);

    expect(error).toBeInstanceOf(R2StorageError);
    expect(error).toMatchObject({ operation: 'deleteCopy', key: R2_KEPT, attempts: 3, status: 500 });
    expect((error as Error).message).not.toContain(R2_KEPT);
    expect(r2.requests.map((r) => r.method)).toEqual(['GET', 'GET', 'GET']);
    expect(r2.objects.has(R2_KEPT)).toBe(true);
  });

  it('a failed DELETE is a one-shot R2StorageError naming deleteCopy', async () => {
    const { r2 } = await withCopy();
    r2.hooks.failNextDeleteWith = 500;

    const error = await store(r2.fetchImpl)
      .deleteCopy({ fromKey: R2_SOURCE, toKey: R2_KEPT })
      .catch((e: unknown) => e);

    expect(error).toBeInstanceOf(R2StorageError);
    expect(error).toMatchObject({ operation: 'deleteCopy', key: R2_KEPT, attempts: 1, status: 500 });
    expect((error as Error).message).not.toContain(R2_KEPT);
    expect(r2.requests.filter((r) => r.method === 'DELETE')).toHaveLength(1);
  });
});
