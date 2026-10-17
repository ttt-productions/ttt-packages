import { describe, it, expect, vi } from 'vitest';
import { hasDownloadToken, removeDownloadToken } from '../src/server/index.js';

describe('hasDownloadToken', () => {
  it('is true while the object metadata carries a Firebase download token', () => {
    expect(hasDownloadToken({ metadata: { firebaseStorageDownloadTokens: 'abc', owner: 'u1' } })).toBe(true);
  });

  it('is false once the token is gone, with other custom metadata kept', () => {
    expect(hasDownloadToken({ metadata: { owner: 'u1' } })).toBe(false);
  });

  it('is false for an object with no custom metadata, or no metadata at all', () => {
    expect(hasDownloadToken({ contentType: 'image/png' })).toBe(false);
    expect(hasDownloadToken({ metadata: null })).toBe(false);
    expect(hasDownloadToken(undefined)).toBe(false);
  });

  it('reads only custom metadata, never a top-level field of the same name', () => {
    expect(hasDownloadToken({ firebaseStorageDownloadTokens: 'abc' })).toBe(false);
  });
});

describe('removeDownloadToken', () => {
  it('deletes only the download-token key, leaving every other custom entry untouched', async () => {
    const setMetadata = vi.fn().mockResolvedValue(undefined);
    await removeDownloadToken({ setMetadata });
    expect(setMetadata).toHaveBeenCalledTimes(1);
    expect(setMetadata).toHaveBeenCalledWith({ metadata: { firebaseStorageDownloadTokens: null } });
  });

  it('surfaces a failed write to its caller', async () => {
    const refused = new Error('storage refused');
    await expect(removeDownloadToken({ setMetadata: vi.fn().mockRejectedValue(refused) })).rejects.toBe(refused);
  });
});
