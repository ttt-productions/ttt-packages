import { describe, it, expect } from 'vitest';
import { buildRootOriginLineage } from '../src/media/origin-lineage.js';
import { MediaOriginLineageV1Schema } from '../src/doc-schemas/media-assets.js';

const INPUT = {
  mediaAssetId: 'asset-1',
  rootIngestId: 'pending-1',
  originatingUploaderUid: 'uploader-1',
  originatingUploadEventId: 'event-1',
  originalUploadCreatedAt: 1000,
  rootSha256: '',
  currentOwnerType: 'workProject' as const,
  currentOwnerId: 'work-1',
};

describe('buildRootOriginLineage', () => {
  it('builds a stored-shape lineage', () => {
    expect(MediaOriginLineageV1Schema.safeParse(buildRootOriginLineage(INPUT)).success).toBe(true);
  });

  it('an original upload is its own root and names no copy source', () => {
    const lineage = buildRootOriginLineage(INPUT);
    expect(lineage).toMatchObject({
      copyReason: 'original',
      rootAssetId: 'asset-1',
      rootIngestId: 'pending-1',
      originatingUploaderUid: 'uploader-1',
      currentOwnerType: 'workProject',
      currentOwnerId: 'work-1',
      variantSha256s: {},
    });
    expect(lineage).not.toHaveProperty('sourceAssetId');
    expect(lineage).not.toHaveProperty('createdFromOwnerId');
    expect(lineage).not.toHaveProperty('copyActorUid');
  });
});
