import { describe, it, expect } from 'vitest';
import {
  MediaAssetReapCandidateSchema,
  MediaAssetCopySourceHoldFieldsSchema,
} from '../src/doc-schemas/media-assets.js';

const retirement = {
  requestedAt: 1,
  pendingVariantKeys: ['main'],
  attemptCount: 0,
  nextAttemptAt: 1,
};

const lineage = {
  lineageVersion: 1,
  rootIngestId: 'ingest-1',
  rootAssetId: 'asset-root',
  originatingUploaderUid: 'uploader-1',
  originatingUploadEventId: 'event-1',
  originalUploadCreatedAt: 1,
  rootSha256: '',
  variantSha256s: {},
  copyReason: 'hall_publish',
  currentOwnerType: 'hallItem',
  currentOwnerId: 'hall-1',
};

describe('the reaper candidate read of an asset doc', () => {
  const candidate = { mediaAssetId: 'asset-1', ownerId: 'hall-1', createdAt: 10 };

  it('yields the candidate fields and drops every other stored field', () => {
    const stored = { ...candidate, publicationState: 'published', retirement, ownerType: 'hallItem', legalHold: false };
    expect(MediaAssetReapCandidateSchema.parse(stored)).toEqual({ ...candidate, publicationState: 'published', retirement });
  });

  it('reads an asset with no publication state and no retirement owed', () => {
    expect(MediaAssetReapCandidateSchema.parse(candidate)).toEqual(candidate);
  });

  it('refuses a doc missing an id, an owner, or a creation time', () => {
    for (const field of ['mediaAssetId', 'ownerId', 'createdAt'] as const) {
      const { [field]: _omitted, ...rest } = candidate;
      expect(MediaAssetReapCandidateSchema.safeParse(rest).success).toBe(false);
    }
  });

  it('refuses a publication state or retirement the asset schema refuses', () => {
    expect(MediaAssetReapCandidateSchema.safeParse({ ...candidate, publicationState: 'gone' }).success).toBe(false);
    expect(
      MediaAssetReapCandidateSchema.safeParse({ ...candidate, retirement: { ...retirement, pendingVariantKeys: ['main', 'main'] } })
        .success,
    ).toBe(false);
  });
});

describe('the copy-source hold read of an asset doc', () => {
  const source = { mediaAssetId: 'asset-root', legalHold: false };

  it('yields the hold fields and drops every other stored field', () => {
    expect(
      MediaAssetCopySourceHoldFieldsSchema.parse({ ...source, originLineage: lineage, ownerId: 'hall-1', createdAt: 1 }),
    ).toEqual({ ...source, originLineage: lineage });
  });

  it('reads a source with no lineage', () => {
    expect(MediaAssetCopySourceHoldFieldsSchema.parse(source)).toEqual(source);
  });

  it('refuses a source whose legal hold is not recorded, so the copy is kept rather than judged unheld', () => {
    expect(MediaAssetCopySourceHoldFieldsSchema.safeParse({ mediaAssetId: 'asset-root' }).success).toBe(false);
    expect(MediaAssetCopySourceHoldFieldsSchema.safeParse(undefined).success).toBe(false);
  });

  it('refuses a lineage the asset schema refuses', () => {
    expect(
      MediaAssetCopySourceHoldFieldsSchema.safeParse({ ...source, originLineage: { ...lineage, lineageVersion: 2 } }).success,
    ).toBe(false);
  });
});
