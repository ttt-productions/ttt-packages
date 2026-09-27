// The retirement obligation on MediaAssetSchema: co-written with the delete that leaves an asset
// unowned, drained until every variant's object delete has succeeded, and only then retired.

import { describe, it, expect } from 'vitest';
import {
  MediaAssetRetirementDeferralSchema,
  MediaAssetRetirementSchema,
  MediaAssetSchema,
  mediaAssetRetirementStanding,
  servingStatusOnRetirementComplete,
  servingStatusOnRetirementRequest,
} from '../src/doc-schemas/media-assets';
import { COLLECTION_SCHEMAS } from '../src/doc-schemas/registry';

const liveAsset = {
  mediaAssetId: 'asset-1',
  mediaKind: 'video' as const,
  fileOrigin: 'work-asset' as const,
  ownerType: 'workProject' as const,
  ownerId: 'work-1',
  workProjectId: 'work-1',
  createdByUid: 'uploader-1',
  accessTier: 'scoped' as const,
  servingStatus: 'servable' as const,
  variants: {
    main: { contentType: 'video/mp4', sizeBytes: 10 },
    poster: { contentType: 'image/jpeg', sizeBytes: 2 },
  },
  moderationStatus: 'approved' as const,
  retentionPolicy: 'standard' as const,
  legalHold: false,
  realmFileCanonStatus: 'none' as const,
  publicationState: 'published' as const,
  createdAt: 1,
  updatedAt: 2,
};

const owed = {
  requestedAt: 1_700_000_000_000,
  pendingVariantKeys: ['main', 'poster'],
  attemptCount: 0,
  nextAttemptAt: 1_700_000_000_000,
};

/** The asset as the delete transaction leaves it: the authority deny and the obligation, together. */
const retiring = { ...liveAsset, servingStatus: 'hidden' as const, retirement: owed };

describe('MediaAssetSchema — the retirement obligation', () => {
  it('parses an asset whose delete co-wrote the deny and the obligation', () => {
    expect(MediaAssetSchema.parse(retiring)).toEqual(retiring);
  });

  it('is registered on the mediaAssets doc schema', () => {
    expect(COLLECTION_SCHEMAS['mediaAssets/{mediaAssetId}']).toBe(MediaAssetSchema);
  });

  it('never leaves an asset owing retirement servable', () => {
    expect(MediaAssetSchema.safeParse({ ...retiring, servingStatus: 'servable' }).success).toBe(false);
  });

  it('never marks an asset retired while a variant delete is still owed', () => {
    expect(
      MediaAssetSchema.safeParse({ ...retiring, servingStatus: 'deleted', publicationState: 'retired' }).success,
    ).toBe(false);
    const done = { ...liveAsset, servingStatus: 'deleted' as const, publicationState: 'retired' as const };
    expect(MediaAssetSchema.safeParse(done).success).toBe(true);
  });

  it("owes only the asset's own variants, each at most once", () => {
    expect(
      MediaAssetSchema.safeParse({ ...retiring, retirement: { ...owed, pendingVariantKeys: ['full'] } }).success,
    ).toBe(false);
    expect(
      MediaAssetSchema.safeParse({ ...retiring, retirement: { ...owed, pendingVariantKeys: ['main', 'main'] } })
        .success,
    ).toBe(false);
  });

  it('keeps an obligation whose remaining deletes are all done until the drain retires the asset', () => {
    expect(
      MediaAssetSchema.safeParse({ ...retiring, retirement: { ...owed, pendingVariantKeys: [] } }).success,
    ).toBe(true);
  });

  it('records why the drain deferred it, with the error only for a failure', () => {
    const held = { ...owed, attemptCount: 1, nextAttemptAt: owed.nextAttemptAt + 1, lastDeferral: 'held' as const };
    expect(MediaAssetRetirementSchema.safeParse(held).success).toBe(true);
    const failed = {
      ...owed,
      pendingVariantKeys: ['poster'],
      attemptCount: 2,
      lastDeferral: 'failed' as const,
      lastError: { code: 'r2_delete_failed', message: 'object delete failed' },
    };
    expect(MediaAssetRetirementSchema.safeParse(failed).success).toBe(true);
    expect(MediaAssetRetirementSchema.safeParse({ ...held, lastError: failed.lastError }).success).toBe(false);
    expect(MediaAssetRetirementDeferralSchema.options).toEqual(['held', 'failed']);
  });

  it('stays strict and keeps its times as epoch milliseconds', () => {
    expect(MediaAssetRetirementSchema.safeParse({ ...owed, bytesDeleted: true }).success).toBe(false);
    expect(MediaAssetRetirementSchema.safeParse({ ...owed, nextAttemptAt: '1700000000000' }).success).toBe(false);
    expect(MediaAssetRetirementSchema.safeParse({ ...owed, attemptCount: -1 }).success).toBe(false);
  });
});

describe('mediaAssetRetirementStanding', () => {
  it('reads a missing asset doc as absent', () => {
    expect(mediaAssetRetirementStanding(undefined)).toBe('absent');
  });

  it('reads an asset whose bytes are all removed as retired', () => {
    expect(mediaAssetRetirementStanding({ publicationState: 'retired' })).toBe('retired');
  });

  it('reads an asset still draining as owed — never as done', () => {
    expect(mediaAssetRetirementStanding({ publicationState: 'published', retirement: owed })).toBe('owed');
  });

  it('reads an asset nothing is retiring as none', () => {
    expect(mediaAssetRetirementStanding({ publicationState: 'published' })).toBe('none');
    expect(mediaAssetRetirementStanding({})).toBe('none');
  });
});

describe('the serving status a retirement writes', () => {
  it('denies a servable asset at once and never downgrades a stronger status', () => {
    expect(servingStatusOnRetirementRequest('servable')).toBe('hidden');
    expect(servingStatusOnRetirementRequest('hidden')).toBe('hidden');
    expect(servingStatusOnRetirementRequest('quarantined')).toBe('quarantined');
    expect(servingStatusOnRetirementRequest('deleted')).toBe('deleted');
  });

  it('keeps a quarantined asset quarantined when the drain retires it, and marks every other asset deleted', () => {
    expect(servingStatusOnRetirementComplete('quarantined')).toBe('quarantined');
    for (const status of ['servable', 'hidden', 'deleted'] as const) {
      expect(servingStatusOnRetirementComplete(status)).toBe('deleted');
    }
  });

  it('keeps a quarantined asset valid while its retirement is owed', () => {
    expect(
      MediaAssetSchema.safeParse({ ...retiring, servingStatus: servingStatusOnRetirementRequest('quarantined') }).success,
    ).toBe(true);
  });
});
