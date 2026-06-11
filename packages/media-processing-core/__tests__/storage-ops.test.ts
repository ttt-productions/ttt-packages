import { describe, it, expect, vi } from 'vitest';
import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import {
  createR2ObjectStore,
  createFirebaseEmulatorObjectStore,
  getMimeFromExt,
  type Bucket,
} from '../src/server/storage-ops.js';

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
