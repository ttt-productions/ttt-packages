import { describe, it, expect } from 'vitest';
import { MediaAssetSchema } from '../src/doc-schemas/media-assets.js';
import { mediaAuthorityCoWrite } from '../src/media/media-authority-co-write.js';

describe('mediaAuthorityCoWrite', () => {
  it('sets the serving status and queues a pending sync that is due now, with no attempts yet', () => {
    expect(mediaAuthorityCoWrite('hidden', 1234).plainFields).toEqual({
      servingStatus: 'hidden',
      authoritySyncState: 'pending',
      authoritySyncAttemptCount: 0,
      authoritySyncNextAttemptAt: 1234,
      updatedAt: 1234,
    });
  });

  it('bumps the authority version by exactly one', () => {
    expect(mediaAuthorityCoWrite('servable', 1).increment).toEqual({
      fieldPath: 'authorityVersion',
      by: 1,
    });
  });

  it('names only fields the media asset document declares', () => {
    const { plainFields, increment } = mediaAuthorityCoWrite('deleted', 1);
    const declared = Object.keys(MediaAssetSchema.shape);
    for (const field of [...Object.keys(plainFields), increment.fieldPath])
      expect(declared, field).toContain(field);
  });
});
