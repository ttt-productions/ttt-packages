import { describe, it, expect, vi } from 'vitest';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createR2ObjectStore, isObjectNotFoundError, R2StorageError } from '../src/server/index.js';

const R2_NO_SUCH_KEY_BODY =
  '<?xml version="1.0" encoding="UTF-8"?><Error><Code>NoSuchKey</Code><Message>The specified key does not exist.</Message></Error>';
const R2_NO_SUCH_BUCKET_BODY =
  '<?xml version="1.0" encoding="UTF-8"?><Error><Code>NoSuchBucket</Code><Message>The specified bucket does not exist.</Message></Error>';

/** What the real R2 store throws when `readToFile` gets `status` with `body`. */
async function r2ReadFailure(status: number, body: string): Promise<unknown> {
  const store = createR2ObjectStore({
    accountId: 'acct',
    accessKeyId: 'AKID',
    secretAccessKey: 'SECRET',
    bucket: 'media-test',
    fetchImpl: vi.fn(async () => new Response(body, { status })),
    sleepImpl: async () => {},
  });
  const localPath = path.join(await mkdtemp(path.join(tmpdir(), 'not-found-')), 'out');
  return store.readToFile({ key: 'mediaAssets/a/main', localPath }).then(
    () => {
      throw new Error('expected readToFile to fail');
    },
    (err: unknown) => err,
  );
}

describe('isObjectNotFoundError', () => {
  it.each([
    ['a Cloud Storage ApiError with a numeric 404 code', Object.assign(new Error('gcs api error'), { code: 404 })],
    ['a numeric 404 carrying the "No such object" message', Object.assign(new Error('No such object'), { code: 404 })],
    ['a string 404 code', Object.assign(new Error('Not Found'), { code: '404' })],
    ['a "No such object" message alone', new Error('No such object: bucket/uploads/a/u/1')],
    ['a "No such object" message in another case', new Error('no such object: bucket/key')],
    [
      'an R2 NoSuchKey message',
      new Error('R2 readToFile failed for k: 404 <?xml version="1.0"?><Error><Code>NoSuchKey</Code></Error>'),
    ],
    ['a non-Error value with a 404 code', { code: 404 }],
  ])('recognizes %s', (_label, err) => {
    expect(isObjectNotFoundError(err)).toBe(true);
  });

  it('recognizes the error the R2 store throws for a missing key', async () => {
    const err = await r2ReadFailure(404, R2_NO_SUCH_KEY_BODY);
    expect(err).toBeInstanceOf(R2StorageError);
    expect(isObjectNotFoundError(err)).toBe(true);
  });

  it('does not treat an R2 missing bucket as a missing object', async () => {
    const err = await r2ReadFailure(404, R2_NO_SUCH_BUCKET_BODY);
    expect(err).toBeInstanceOf(R2StorageError);
    expect(isObjectNotFoundError(err)).toBe(false);
  });

  it('does not treat an R2 access failure as a missing object', async () => {
    expect(isObjectNotFoundError(await r2ReadFailure(403, 'AccessDenied'))).toBe(false);
  });

  it.each([
    ['a permission failure', Object.assign(new Error('Permission denied'), { code: 403 })],
    ['a transient network failure', Object.assign(new Error('socket hang up'), { code: 'ECONNRESET' })],
    ['an error with no code', new Error('boom')],
    ['a string', 'not-an-error'],
    ['null', null],
    ['undefined', undefined],
  ])('rejects %s', (_label, err) => {
    expect(isObjectNotFoundError(err)).toBe(false);
  });
});
