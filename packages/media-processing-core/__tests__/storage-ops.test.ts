import { describe, it, expect, vi } from 'vitest';
import { mkdtemp, writeFile, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import {
  createR2ObjectStore,
  createFirebaseEmulatorObjectStore,
  getMimeFromExt,
  R2StorageError,
  type Bucket,
} from '../src/server/storage-ops.js';

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

  it('copy issues a server-side x-amz-copy-source PUT', async () => {
    const fetchMock = vi.fn(async (_input: Request) => new Response(null, { status: 200 }));
    const store = makeR2(fetchMock as unknown as typeof fetch);
    const result = await store.copy({ fromKey: 'mediaAssets/a/main', toKey: 'mediaAssets/b/main' });
    expect(result.key).toBe('mediaAssets/b/main');
    const req = fetchMock.mock.calls[0][0];
    expect(req.method).toBe('PUT');
    expect(req.url).toContain('/ttt-media-test/mediaAssets/b/main');
    expect(req.headers.get('x-amz-copy-source')).toBe('/ttt-media-test/mediaAssets/a/main');
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
});

describe('createFirebaseEmulatorObjectStore', () => {
  function makeBucketMock() {
    const setMetadata = vi.fn(async () => undefined);
    const copy = vi.fn(async () => undefined);
    const del = vi.fn(async () => undefined);
    const upload = vi.fn(async () => undefined);
    const file = vi.fn(() => ({ copy, setMetadata, delete: del }));
    return { bucket: { upload, file } as unknown as Bucket, upload, file, copy, setMetadata, del };
  }

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

  it('copy retries a 500 then succeeds, preserving the exact x-amz-copy-source', async () => {
    const fetchMock = fetchSequence([
      () => new Response('e', { status: 500 }),
      () => new Response(null, { status: 200 }),
    ]);
    const store = makeR2WithSeams(fetchMock, { sleepImpl: noSleep, randomImpl: () => 0 });

    const result = await store.copy({ fromKey: 'mediaAssets/a/main', toKey: 'mediaAssets/b/main' });

    expect(result.key).toBe('mediaAssets/b/main');
    expect(fetchMock).toHaveBeenCalledTimes(2);
    const req0 = fetchMock.mock.calls[0][0] as Request;
    const req1 = fetchMock.mock.calls[1][0] as Request;
    expect(req0.headers.get('x-amz-copy-source')).toBe('/ttt-media-test/mediaAssets/a/main');
    expect(req1.headers.get('x-amz-copy-source')).toBe('/ttt-media-test/mediaAssets/a/main');
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
