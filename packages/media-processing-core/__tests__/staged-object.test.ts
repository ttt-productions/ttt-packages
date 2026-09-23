import { describe, it, expect, vi } from 'vitest';
import {
  pinnedGcsUri,
  readStagedObjectGeneration,
  readStagedUploadMetadata,
  stagedObjectGenerationFromMetadata,
  type Bucket,
} from '../src/server/index.js';

/** The metadata an Admin SDK `File` carries — what a processor holds as `sourceFile.metadata` after `file.get()`. */
type AdminFileMetadata = ReturnType<Bucket['file']>['metadata'];

function bucketWith(getMetadata: () => Promise<unknown>) {
  const file = vi.fn(() => ({ getMetadata }));
  return { bucket: { file } as unknown as Bucket, file };
}

describe('readStagedUploadMetadata', () => {
  it('returns the stored metadata of an existing object', async () => {
    const metadata = { contentType: 'image/jpeg', size: '1024', generation: '17' };
    const { bucket, file } = bucketWith(async () => [metadata]);
    expect(await readStagedUploadMetadata(bucket, 'uploads/a/u/1')).toEqual({ found: true, metadata });
    expect(file).toHaveBeenCalledWith('uploads/a/u/1');
  });

  it.each([
    ['a numeric 404', Object.assign(new Error('Not Found'), { code: 404 })],
    ['a string 404', Object.assign(new Error('Not Found'), { code: '404' })],
    ['a "No such object" message', new Error('No such object: bucket/uploads/a/u/1')],
  ])('reports a missing object as not found (%s)', async (_label, err) => {
    const { bucket } = bucketWith(async () => {
      throw err;
    });
    expect(await readStagedUploadMetadata(bucket, 'p')).toEqual({ found: false });
  });

  it('rethrows any other read failure', async () => {
    const failure = Object.assign(new Error('Permission denied'), { code: 403 });
    const { bucket } = bucketWith(async () => {
      throw failure;
    });
    await expect(readStagedUploadMetadata(bucket, 'p')).rejects.toBe(failure);
  });
});

describe('readStagedObjectGeneration', () => {
  it('returns the generation as a string (generations exceed 2^53)', async () => {
    const { bucket } = bucketWith(async () => [{ generation: '1712345678901234567' }]);
    expect(await readStagedObjectGeneration(bucket, 'p')).toBe('1712345678901234567');
  });

  it('stringifies a numeric generation', async () => {
    const { bucket } = bucketWith(async () => [{ generation: 42 }]);
    expect(await readStagedObjectGeneration(bucket, 'p')).toBe('42');
  });

  it('is undefined without a path, without a read', async () => {
    const { bucket, file } = bucketWith(async () => [{ generation: '1' }]);
    expect(await readStagedObjectGeneration(bucket, undefined)).toBeUndefined();
    expect(file).not.toHaveBeenCalled();
  });

  it('is undefined when the object reports no generation (the emulator may not)', async () => {
    const { bucket } = bucketWith(async () => [{}]);
    expect(await readStagedObjectGeneration(bucket, 'p')).toBeUndefined();
  });

  it('is undefined on a read failure, reported to the caller', async () => {
    const failure = new Error('boom');
    const onReadFailure = vi.fn();
    const { bucket } = bucketWith(async () => {
      throw failure;
    });
    expect(await readStagedObjectGeneration(bucket, 'p', { onReadFailure })).toBeUndefined();
    expect(onReadFailure).toHaveBeenCalledWith(failure);
  });
});

describe('stagedObjectGenerationFromMetadata', () => {
  it('keeps a string generation as-is (generations exceed 2^53)', () => {
    expect(stagedObjectGenerationFromMetadata({ generation: '1712345678901234567' })).toBe('1712345678901234567');
  });

  it('stringifies a numeric generation', () => {
    expect(stagedObjectGenerationFromMetadata({ generation: 42 })).toBe('42');
  });

  it('stringifies a numeric zero — only an absent generation is undefined', () => {
    expect(stagedObjectGenerationFromMetadata({ generation: 0 })).toBe('0');
  });

  it('is undefined when the metadata has no generation field', () => {
    expect(stagedObjectGenerationFromMetadata({})).toBeUndefined();
  });

  it('is undefined for an explicit undefined generation', () => {
    expect(stagedObjectGenerationFromMetadata({ generation: undefined })).toBeUndefined();
  });

  it('is undefined for a null generation', () => {
    expect(stagedObjectGenerationFromMetadata({ generation: null })).toBeUndefined();
  });

  it('takes the Admin SDK metadata a processor already holds, unchanged', () => {
    const metadata: AdminFileMetadata = { name: 'uploads/a/u/1', contentType: 'video/mp4', size: '9', generation: '17' };
    expect(stagedObjectGenerationFromMetadata(metadata)).toBe('17');
  });

  it.each([['1712345678901234567'], [42], [0], [undefined], [null]])(
    'is the normalization readStagedObjectGeneration applies (generation %s)',
    async (generation) => {
      const { bucket } = bucketWith(async () => [{ generation }]);
      expect(await readStagedObjectGeneration(bucket, 'p')).toBe(stagedObjectGenerationFromMetadata({ generation }));
    },
  );
});

describe('pinnedGcsUri', () => {
  it('pins the URI to the captured generation', () => {
    expect(pinnedGcsUri('gs://bucket/uploads/a', '17')).toBe('gs://bucket/uploads/a#17');
  });
  it('is the bare URI without a generation', () => {
    expect(pinnedGcsUri('gs://bucket/uploads/a', undefined)).toBe('gs://bucket/uploads/a');
  });
});
