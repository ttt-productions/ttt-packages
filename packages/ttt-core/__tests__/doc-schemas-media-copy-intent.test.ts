// mediaCopyIntents/{newAssetId} — the intent of one cross-owner media copy, recorded before
// the first variant object is copied and read back by the sweep that removes the objects of
// a copy that never finished.

import { describe, it, expect } from 'vitest';
import {
  MediaCopyIntentSchema,
  MediaCopyIntentStateSchema,
} from '../src/doc-schemas/media-copy-intents';
import { MEDIA_VARIANT_KEYS, MediaAssetOwnerTypeSchema } from '../src/doc-schemas/media-assets';
import { COLLECTION_SCHEMAS } from '../src/doc-schemas/registry';
import { PATH_BUILDERS } from '../src/paths/path-builders';
import { COLLECTION_REFS } from '../src/paths/collection-refs';
import { toPath } from '../src/paths/utils';

/** A structural Firestore Timestamp (ttt-core validates the shape, never firebase-admin). */
function ts(ms: number) {
  return {
    seconds: Math.floor(ms / 1000),
    nanoseconds: (ms % 1000) * 1e6,
    toMillis: () => ms,
    toDate: () => new Date(ms),
  };
}

const GRACE_MS = 14 * 24 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

const copying = {
  newAssetId: 'copy-asset-1',
  sourceAssetId: 'source-asset-1',
  ownerType: 'hallItem' as const,
  ownerId: 'hall-1',
  variantKeys: ['full', 'medium', 'small'] as ('full' | 'medium' | 'small')[],
  state: 'copying' as const,
  createdAt: 1_700_000_000_000,
  updatedAt: 1_700_000_000_000,
  reapAfter: 1_700_000_000_000 + GRACE_MS,
  reapAttemptCount: 0,
};

const reaping = { ...copying, state: 'reaping' as const, reapClaimedAt: 1_701_300_000_000 };

describe('MediaCopyIntentSchema', () => {
  it('parses an intent recorded before the copy', () => {
    expect(MediaCopyIntentSchema.parse(copying)).toEqual(copying);
  });

  it('parses an intent the sweep has claimed', () => {
    expect(MediaCopyIntentSchema.parse(reaping)).toEqual(reaping);
  });

  it('rejects a claimed intent that does not record when it was claimed', () => {
    const { reapClaimedAt: _claimedAt, ...unstamped } = reaping;
    expect(MediaCopyIntentSchema.safeParse(unstamped).success).toBe(false);
  });

  it('rejects an unclaimed intent carrying a claim time', () => {
    expect(MediaCopyIntentSchema.safeParse({ ...copying, reapClaimedAt: 1_701_000_000_000 }).success).toBe(false);
  });

  it('takes its owner type from the canonical media-asset owner types', () => {
    for (const ownerType of MediaAssetOwnerTypeSchema.options) {
      expect(MediaCopyIntentSchema.safeParse({ ...copying, ownerType }).success).toBe(true);
    }
    expect(MediaCopyIntentSchema.safeParse({ ...copying, ownerType: 'hallItems' }).success).toBe(false);
  });

  it('names variants from the canonical variant keys, each at most once, and at least one', () => {
    expect(MediaCopyIntentSchema.safeParse({ ...copying, variantKeys: [...MEDIA_VARIANT_KEYS] }).success).toBe(true);
    expect(MediaCopyIntentSchema.safeParse({ ...copying, variantKeys: ['thumbnail'] }).success).toBe(false);
    expect(MediaCopyIntentSchema.safeParse({ ...copying, variantKeys: ['main', 'main'] }).success).toBe(false);
    expect(MediaCopyIntentSchema.safeParse({ ...copying, variantKeys: [] }).success).toBe(false);
  });

  it('never stores an object key in place of a variant name', () => {
    expect(
      MediaCopyIntentSchema.safeParse({ ...copying, variantKeys: ['mediaAssets/copy-asset-1/main'] }).success,
    ).toBe(false);
  });

  it('rejects empty ids', () => {
    for (const field of ['newAssetId', 'sourceAssetId', 'ownerId'] as const) {
      expect(MediaCopyIntentSchema.safeParse({ ...copying, [field]: '' }).success).toBe(false);
    }
  });

  it('stores its times as epoch milliseconds, never a Firestore Timestamp (ARCH-105)', () => {
    expect(MediaCopyIntentSchema.safeParse({ ...copying, createdAt: ts(1_700_000_000_000) }).success).toBe(false);
    expect(MediaCopyIntentSchema.safeParse({ ...reaping, reapClaimedAt: ts(1_701_000_000_000) }).success).toBe(false);
    expect(MediaCopyIntentSchema.safeParse({ ...copying, reapAfter: ts(copying.reapAfter) }).success).toBe(false);
  });

  it('requires the time the sweep may take it up and its deferral count', () => {
    const { reapAfter: _reapAfter, ...noReapAfter } = copying;
    expect(MediaCopyIntentSchema.safeParse(noReapAfter).success).toBe(false);
    const { reapAttemptCount: _reapAttemptCount, ...noAttemptCount } = copying;
    expect(MediaCopyIntentSchema.safeParse(noAttemptCount).success).toBe(false);
  });

  it('parses an intent the sweep deferred, in either state, with its due time pushed out', () => {
    const deferredClaim = { ...reaping, reapAfter: reaping.reapClaimedAt + DAY_MS, reapAttemptCount: 1 };
    expect(MediaCopyIntentSchema.parse(deferredClaim)).toEqual(deferredClaim);
    const deferredUnclaimed = { ...copying, reapAfter: copying.reapAfter + 2 * DAY_MS, reapAttemptCount: 2 };
    expect(MediaCopyIntentSchema.parse(deferredUnclaimed)).toEqual(deferredUnclaimed);
  });

  it('rejects an intent due before the copy last recorded it, and accepts one due at that instant', () => {
    expect(MediaCopyIntentSchema.safeParse({ ...copying, reapAfter: copying.updatedAt - 1 }).success).toBe(false);
    expect(MediaCopyIntentSchema.safeParse({ ...copying, reapAfter: copying.updatedAt }).success).toBe(true);
  });

  it('rejects a re-recorded intent whose due time was left behind at its first recording', () => {
    const reRecorded = { ...copying, updatedAt: copying.reapAfter + DAY_MS };
    expect(MediaCopyIntentSchema.safeParse(reRecorded).success).toBe(false);
  });

  it('counts deferrals as a whole, non-negative number', () => {
    expect(MediaCopyIntentSchema.safeParse({ ...copying, reapAttemptCount: -1 }).success).toBe(false);
    expect(MediaCopyIntentSchema.safeParse({ ...copying, reapAttemptCount: 1.5 }).success).toBe(false);
  });

  it('stays strict — an undeclared field is rejected, not silently kept', () => {
    expect(MediaCopyIntentSchema.safeParse({ ...copying, toKeys: ['mediaAssets/copy-asset-1/full'] }).success).toBe(false);
  });

  it('has exactly the two states', () => {
    expect(MediaCopyIntentStateSchema.options).toEqual(['copying', 'reaping']);
  });
});

describe('mediaCopyIntents collection', () => {
  it('is registered under its path template, keyed by the new asset id', () => {
    expect(COLLECTION_SCHEMAS['mediaCopyIntents/{newAssetId}']).toBe(MediaCopyIntentSchema);
    expect(toPath(PATH_BUILDERS.mediaCopyIntent('copy-asset-1'))).toBe('mediaCopyIntents/copy-asset-1');
  });

  it('the collection ref is the parent of the per-document builder', () => {
    expect(toPath(PATH_BUILDERS.mediaCopyIntent('copy-asset-1'))).toBe(
      `${toPath(COLLECTION_REFS.mediaCopyIntents())}/copy-asset-1`,
    );
  });
});
