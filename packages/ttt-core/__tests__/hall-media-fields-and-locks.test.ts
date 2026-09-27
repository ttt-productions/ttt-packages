// The Hall media asset-reference field lists derive from the target-field maps, and the one locked
// sub-item status set decides the sub-item lock for every reader.

import { describe, it, expect } from 'vitest';
import {
  HALL_LIBRARY_COVER_ASSET_FIELDS,
  HALL_LIBRARY_COVER_TARGET_FIELDS,
  HALL_LIBRARY_SUB_ITEM_ASSET_FIELDS,
  HALL_LIBRARY_SUB_ITEM_TARGET_FIELDS,
  HALL_LIBRARY_TARGET_FIELDS,
} from '../src/media/hall-library-target-fields';
import { HALL_SUB_ITEM_LOCKED_STATUSES, isHallSubItemLocked } from '../src/utils/hall-content';
import {
  FullChapterSchema,
  FullTelevisionEpisodeSchema,
  FullTuneTrackSchema,
  PublishedHallItemSchema,
} from '../src/doc-schemas/content';

describe('Hall media asset-reference fields', () => {
  it('lists every cover field the cover map writes, once each', () => {
    expect(new Set(HALL_LIBRARY_COVER_ASSET_FIELDS)).toEqual(new Set(Object.values(HALL_LIBRARY_COVER_TARGET_FIELDS)));
    expect(new Set(HALL_LIBRARY_COVER_ASSET_FIELDS).size).toBe(HALL_LIBRARY_COVER_ASSET_FIELDS.length);
  });

  it('lists every sub-item field the sub-item map writes, once each', () => {
    expect(new Set(HALL_LIBRARY_SUB_ITEM_ASSET_FIELDS)).toEqual(
      new Set(Object.values(HALL_LIBRARY_SUB_ITEM_TARGET_FIELDS)),
    );
    expect(new Set(HALL_LIBRARY_SUB_ITEM_ASSET_FIELDS).size).toBe(HALL_LIBRARY_SUB_ITEM_ASSET_FIELDS.length);
  });

  it('together cover every field any Hall upload origin writes', () => {
    expect(new Set([...HALL_LIBRARY_COVER_ASSET_FIELDS, ...HALL_LIBRARY_SUB_ITEM_ASSET_FIELDS])).toEqual(
      new Set(Object.values(HALL_LIBRARY_TARGET_FIELDS)),
    );
  });

  it('names only fields the published Hall item declares', () => {
    const declared = PublishedHallItemSchema.shape as Record<string, unknown>;
    for (const field of HALL_LIBRARY_COVER_ASSET_FIELDS) expect(declared[field], field).toBeDefined();
  });
});

describe('the locked sub-item statuses', () => {
  it('lock a sub-item submitted for review or published, and nothing else', () => {
    expect(isHallSubItemLocked('pending_approval')).toBe(true);
    expect(isHallSubItemLocked('published')).toBe(true);
    expect(isHallSubItemLocked('unpublished')).toBe(false);
    expect(isHallSubItemLocked(undefined)).toBe(false);
    expect(isHallSubItemLocked('publishing')).toBe(false);
  });

  it('are statuses every chapter, track, and episode can hold', () => {
    for (const schema of [FullChapterSchema, FullTuneTrackSchema, FullTelevisionEpisodeSchema]) {
      const statusSchema = schema.shape.status;
      for (const status of HALL_SUB_ITEM_LOCKED_STATUSES) {
        expect(statusSchema.safeParse(status).success, status).toBe(true);
      }
      expect(statusSchema.safeParse('unpublished').success).toBe(true);
    }
  });
});
