/**
 * Hall publication contracts:
 *  - a PUBLISHED hall entry always carries its three covers, and a published sub-item always
 *    carries its picture plus its type's media; the working/draft shapes stay able to represent
 *    incomplete content
 *  - the ONE per-work-type sub-item requirement owner the UI filter, submit, approve, and publish
 *    all read
 *  - a terminally parked publish is visible on the threshold doc, not only in Sentry
 *  - DECLARED-KEY CONFORMANCE: every value in the closed field maps that writers index with a
 *    COMPUTED key is a field the target document's schema actually declares (BACKEND-115)
 */

import { describe, it, expect } from 'vitest';
import {
  FullTaleSchema,
  FullTuneSchema,
  FullTelevisionSchema,
  FullChapterSchema,
  FullTuneTrackSchema,
  FullTelevisionEpisodeSchema,
  PublishedHallItemSchema,
  PublishedChapterSchema,
  PublishedTuneTrackSchema,
  PublishedTelevisionEpisodeSchema,
  ThresholdItemSchema,
} from '../src/doc-schemas/content';
import {
  FullWorkProjectSchema,
  PublicWorkProjectSchema,
  WorkRealmSchema,
} from '../src/doc-schemas/work-project';
import {
  HALL_SUB_ITEM_REQUIRED_FIELDS_BY_WORK_TYPE,
  HALL_SUB_ITEM_REQUIREMENT_LABELS,
  MODERATION_CLEARABLE_TEXT_FIELDS,
  WORK_SHELL_TEXT_FIELD_TO_HALL_ITEM_FIELD,
} from '../src/constants/business-content';
import { MAX_THRESHOLD_PUBLISH_PARKED_REASON_LENGTH } from '../src/constants/business-admin';
import {
  HALL_LIBRARY_TARGET_FIELDS,
  HALL_LIBRARY_COVER_TARGET_FIELDS,
  HALL_LIBRARY_SUB_ITEM_TARGET_FIELDS,
  isHallLibraryCoverFileOrigin,
  isHallLibrarySubItemFileOrigin,
} from '../src/media/hall-library-target-fields';
import { WORK_PROJECT_TYPE_KEYS } from '../src/types/content';
import {
  unmetHallSubItemRequirements,
  isHallSubItemPublishable,
} from '../src/utils/hall-content';

/** Structural view of a document schema — just enough to read its declared keys, so the table
 *  below can hold schemas of different strictness side by side. */
type AnySchema = { shape: Record<string, { isOptional: () => boolean }> };

const declares = (schema: AnySchema, field: string): boolean =>
  Object.prototype.hasOwnProperty.call(schema.shape, field);

const requires = (schema: AnySchema, field: string): boolean =>
  declares(schema, field) && schema.shape[field].isOptional() === false;

const PUBLISHED_SUB_ITEM_SCHEMA = {
  Tales: PublishedChapterSchema,
  Tunes: PublishedTuneTrackSchema,
  Television: PublishedTelevisionEpisodeSchema,
} as const;

const WORKING_SUB_ITEM_SCHEMA = {
  Tales: FullChapterSchema,
  Tunes: FullTuneTrackSchema,
  Television: FullTelevisionEpisodeSchema,
} as const;

const WORKING_SECTION_SCHEMAS = [FullTaleSchema, FullTuneSchema, FullTelevisionSchema];

const COVER_FIELDS = [
  'coverSquareAssetId',
  'coverPosterAssetId',
  'coverCinematicAssetId',
] as const;

describe('published hall covers are required', () => {
  it('PublishedHallItem requires all three covers, non-empty', () => {
    for (const field of COVER_FIELDS) {
      expect(requires(PublishedHallItemSchema as AnySchema, field)).toBe(true);
    }
    const base = {
      hallItemId: 'h1',
      workProjectId: 'wp1',
      workProjectType: 'Tales',
      status: 'published',
      createdOn: 1,
      hallWingType: 'entertainment',
      hidden: false,
      coverSquareAssetId: 'a1',
      coverPosterAssetId: 'a2',
      coverCinematicAssetId: 'a3',
    };
    expect(PublishedHallItemSchema.safeParse(base).success).toBe(true);
    for (const field of COVER_FIELDS) {
      expect(PublishedHallItemSchema.safeParse({ ...base, [field]: undefined }).success).toBe(false);
      expect(PublishedHallItemSchema.safeParse({ ...base, [field]: '' }).success).toBe(false);
    }
  });

  it('the working section shapes keep covers optional (uploaded over time)', () => {
    for (const schema of WORKING_SECTION_SCHEMAS) {
      for (const field of COVER_FIELDS) {
        expect(requires(schema as AnySchema, field)).toBe(false);
      }
    }
  });
});

describe('published sub-item media is required', () => {
  it('every published sub-item requires its picture, non-empty', () => {
    for (const type of WORK_PROJECT_TYPE_KEYS) {
      expect(requires(PUBLISHED_SUB_ITEM_SCHEMA[type] as AnySchema, 'photoAssetId')).toBe(true);
    }
  });

  it('a published track requires its audio and a published episode its video', () => {
    expect(requires(PublishedTuneTrackSchema as AnySchema, 'audioAssetId')).toBe(true);
    expect(requires(PublishedTelevisionEpisodeSchema as AnySchema, 'videoAssetId')).toBe(true);
    expect(PublishedTuneTrackSchema.safeParse({
      uid: 'u1', title: 't', order: 1, audioAssetId: '', photoAssetId: 'p', hidden: false,
    }).success).toBe(false);
    expect(PublishedTelevisionEpisodeSchema.safeParse({
      uid: 'u1', title: 't', order: 1, videoAssetId: 'v', photoAssetId: '', hidden: false,
    }).success).toBe(false);
  });

  it('the working sub-item shapes stay able to represent incomplete content', () => {
    for (const type of WORK_PROJECT_TYPE_KEYS) {
      expect(requires(WORKING_SUB_ITEM_SCHEMA[type] as AnySchema, 'photoAssetId')).toBe(false);
    }
    expect(requires(FullTuneTrackSchema as AnySchema, 'audioAssetId')).toBe(false);
  });
});

describe('HALL_SUB_ITEM_REQUIRED_FIELDS_BY_WORK_TYPE', () => {
  it('routes every canonical work-project type (completeness)', () => {
    expect(Object.keys(HALL_SUB_ITEM_REQUIRED_FIELDS_BY_WORK_TYPE).sort())
      .toEqual([...WORK_PROJECT_TYPE_KEYS].sort());
  });

  it('carries the settled per-type rule', () => {
    expect(HALL_SUB_ITEM_REQUIRED_FIELDS_BY_WORK_TYPE.Tales)
      .toEqual(['title', 'photoAssetId', 'content']);
    expect(HALL_SUB_ITEM_REQUIRED_FIELDS_BY_WORK_TYPE.Tunes)
      .toEqual(['title', 'photoAssetId', 'audioAssetId']);
    expect(HALL_SUB_ITEM_REQUIRED_FIELDS_BY_WORK_TYPE.Television)
      .toEqual(['title', 'photoAssetId', 'videoAssetId']);
  });

  it('every required field is REQUIRED on the matching published sub-item schema', () => {
    for (const type of WORK_PROJECT_TYPE_KEYS) {
      for (const field of HALL_SUB_ITEM_REQUIRED_FIELDS_BY_WORK_TYPE[type]) {
        expect(requires(PUBLISHED_SUB_ITEM_SCHEMA[type] as AnySchema, field)).toBe(true);
      }
    }
  });

  it('every required field is declared on the matching working sub-item schema', () => {
    for (const type of WORK_PROJECT_TYPE_KEYS) {
      for (const field of HALL_SUB_ITEM_REQUIRED_FIELDS_BY_WORK_TYPE[type]) {
        expect(declares(WORKING_SUB_ITEM_SCHEMA[type] as AnySchema, field)).toBe(true);
      }
    }
  });

  it('every required field has wording', () => {
    for (const type of WORK_PROJECT_TYPE_KEYS) {
      for (const field of HALL_SUB_ITEM_REQUIRED_FIELDS_BY_WORK_TYPE[type]) {
        expect(HALL_SUB_ITEM_REQUIREMENT_LABELS[field].length).toBeGreaterThan(0);
      }
    }
  });
});

describe('unmetHallSubItemRequirements', () => {
  it('names every missing requirement for a Tale chapter', () => {
    expect(unmetHallSubItemRequirements('Tales', {})).toEqual([
      HALL_SUB_ITEM_REQUIREMENT_LABELS.title,
      HALL_SUB_ITEM_REQUIREMENT_LABELS.photoAssetId,
      HALL_SUB_ITEM_REQUIREMENT_LABELS.content,
    ]);
  });

  it('treats a blank string as missing', () => {
    expect(unmetHallSubItemRequirements('Tunes', {
      title: '   ', photoAssetId: 'p', audioAssetId: 'a',
    })).toEqual([HALL_SUB_ITEM_REQUIREMENT_LABELS.title]);
  });

  it('a complete sub-item of each type is publishable', () => {
    expect(isHallSubItemPublishable('Tales', { title: 't', photoAssetId: 'p', content: 'c' })).toBe(true);
    expect(isHallSubItemPublishable('Tunes', { title: 't', photoAssetId: 'p', audioAssetId: 'a' })).toBe(true);
    expect(isHallSubItemPublishable('Television', { title: 't', photoAssetId: 'p', videoAssetId: 'v' })).toBe(true);
  });

  it('a picture is required for every type — the rule no surface may restate away', () => {
    expect(isHallSubItemPublishable('Tales', { title: 't', content: 'c' })).toBe(false);
    expect(isHallSubItemPublishable('Tunes', { title: 't', audioAssetId: 'a' })).toBe(false);
    expect(isHallSubItemPublishable('Television', { title: 't', videoAssetId: 'v' })).toBe(false);
  });
});

describe('threshold item parked-publication state', () => {
  const base = {
    thresholdItemId: 'ti1',
    hallItemId: 'h1',
    workProjectId: 'wp1',
    workProjectType: 'Tales',
    itemId: 'i1',
    itemsKey: 'chapters',
    order: 1,
    hallWingType: 'entertainment',
    submittedAt: 1,
    reviewStatus: 'approved',
    hasRealPeople: false,
    attestConsistentFormat: true,
    attestNoCredits: true,
    attestNoBegging: true,
    attestHumanMadeOriginal: true,
    attestedAt: 1,
  };

  it('is optional — only a park stamps it', () => {
    expect(ThresholdItemSchema.safeParse(base).success).toBe(true);
    expect(ThresholdItemSchema.shape.publishParkedReason.isOptional()).toBe(true);
    expect(ThresholdItemSchema.shape.publishParkedAt.isOptional()).toBe(true);
  });

  it('accepts a stamped park and bounds the reason', () => {
    expect(ThresholdItemSchema.safeParse({
      ...base,
      publishParkedReason: 'media field photoAssetId source a1 is ineligible to copy',
      publishParkedAt: 1_700_000_000_000,
    }).success).toBe(true);
    expect(ThresholdItemSchema.safeParse({
      ...base,
      publishParkedReason: 'x'.repeat(MAX_THRESHOLD_PUBLISH_PARKED_REASON_LENGTH + 1),
    }).success).toBe(false);
  });

  it('adds no status value — reviewStatus keeps its three states', () => {
    expect(ThresholdItemSchema.safeParse({ ...base, reviewStatus: 'parked' }).success).toBe(false);
  });
});

// --- Declared-key conformance for the closed maps writers index with a COMPUTED key ---

/** Which document schemas each hall-library upload origin's field is written onto. */
const HALL_LIBRARY_ORIGIN_TARGETS: Record<string, AnySchema[]> = {
  'hallLibrary-cover-square': WORKING_SECTION_SCHEMAS as AnySchema[],
  'hallLibrary-cover-poster': WORKING_SECTION_SCHEMAS as AnySchema[],
  'hallLibrary-cover-cinematic': WORKING_SECTION_SCHEMAS as AnySchema[],
  'chapter-photo': [FullChapterSchema as AnySchema, PublishedChapterSchema as AnySchema],
  'tune-track-photo': [FullTuneTrackSchema as AnySchema, PublishedTuneTrackSchema as AnySchema],
  'tune-track-audio': [FullTuneTrackSchema as AnySchema, PublishedTuneTrackSchema as AnySchema],
  'television-episode-photo': [FullTelevisionEpisodeSchema as AnySchema, PublishedTelevisionEpisodeSchema as AnySchema],
  'television-episode-video': [FullTelevisionEpisodeSchema as AnySchema, PublishedTelevisionEpisodeSchema as AnySchema],
};

describe('HALL_LIBRARY_TARGET_FIELDS values are declared keys on the docs they target', () => {
  it('binds every origin in the map to the schemas it writes', () => {
    expect(Object.keys(HALL_LIBRARY_ORIGIN_TARGETS).sort())
      .toEqual(Object.keys(HALL_LIBRARY_TARGET_FIELDS).sort());
  });

  it('every mapped field is declared on each target schema', () => {
    for (const [origin, field] of Object.entries(HALL_LIBRARY_TARGET_FIELDS)) {
      for (const schema of HALL_LIBRARY_ORIGIN_TARGETS[origin]) {
        expect({ origin, field, declared: declares(schema, field) })
          .toEqual({ origin, field, declared: true });
      }
    }
  });

  it('the published covers are the same three fields the section docs receive', () => {
    for (const field of COVER_FIELDS) {
      expect(declares(PublishedHallItemSchema as AnySchema, field)).toBe(true);
    }
  });
});

describe('the hall-library target-field map splits by write level', () => {
  it('the cover and sub-item subsets partition the parent map exactly', () => {
    const coverOrigins = Object.keys(HALL_LIBRARY_COVER_TARGET_FIELDS);
    const subItemOrigins = Object.keys(HALL_LIBRARY_SUB_ITEM_TARGET_FIELDS);

    expect([...coverOrigins, ...subItemOrigins].sort())
      .toEqual(Object.keys(HALL_LIBRARY_TARGET_FIELDS).sort());
    expect(coverOrigins.filter((origin) => subItemOrigins.includes(origin))).toEqual([]);
  });

  it('each subset carries the parent map field for every origin it keeps', () => {
    for (const [origin, field] of [
      ...Object.entries(HALL_LIBRARY_COVER_TARGET_FIELDS),
      ...Object.entries(HALL_LIBRARY_SUB_ITEM_TARGET_FIELDS),
    ]) {
      expect({ origin, field })
        .toEqual({ origin, field: HALL_LIBRARY_TARGET_FIELDS[origin as keyof typeof HALL_LIBRARY_TARGET_FIELDS] });
    }
  });

  it('the type guards answer for exactly their own subset', () => {
    for (const origin of Object.keys(HALL_LIBRARY_TARGET_FIELDS)) {
      expect(isHallLibraryCoverFileOrigin(origin)).toBe(origin in HALL_LIBRARY_COVER_TARGET_FIELDS);
      expect(isHallLibrarySubItemFileOrigin(origin)).toBe(origin in HALL_LIBRARY_SUB_ITEM_TARGET_FIELDS);
    }
    expect(isHallLibraryCoverFileOrigin('profile-picture')).toBe(false);
    expect(isHallLibrarySubItemFileOrigin('profile-picture')).toBe(false);
  });

  it('every cover field is declared on the hall parent the cover writer targets', () => {
    for (const [origin, field] of Object.entries(HALL_LIBRARY_COVER_TARGET_FIELDS)) {
      for (const schema of HALL_LIBRARY_ORIGIN_TARGETS[origin]) {
        expect({ origin, field, declared: declares(schema, field) })
          .toEqual({ origin, field, declared: true });
      }
      expect(declares(PublishedHallItemSchema as AnySchema, field)).toBe(true);
    }
  });

  it('every sub-item field is declared on the chapter / track / episode doc it targets', () => {
    for (const [origin, field] of Object.entries(HALL_LIBRARY_SUB_ITEM_TARGET_FIELDS)) {
      for (const schema of HALL_LIBRARY_ORIGIN_TARGETS[origin]) {
        expect({ origin, field, declared: declares(schema, field) })
          .toEqual({ origin, field, declared: true });
      }
    }
  });

  it('neither level can write the other level\'s fields', () => {
    const coverFields = Object.values(HALL_LIBRARY_COVER_TARGET_FIELDS) as string[];
    const subItemFields = Object.values(HALL_LIBRARY_SUB_ITEM_TARGET_FIELDS) as string[];

    for (const field of coverFields) {
      expect(subItemFields).not.toContain(field);
      for (const schema of Object.values(WORKING_SUB_ITEM_SCHEMA)) {
        expect(declares(schema as AnySchema, field)).toBe(false);
      }
    }
    for (const field of subItemFields) {
      expect(coverFields).not.toContain(field);
      for (const schema of WORKING_SECTION_SCHEMAS) {
        expect(declares(schema as AnySchema, field)).toBe(false);
      }
    }
  });
});

describe('MODERATION_CLEARABLE_TEXT_FIELDS values are declared keys on the docs they clear', () => {
  const TARGETS: Record<string, AnySchema[]> = {
    workProject: [FullWorkProjectSchema as AnySchema, PublicWorkProjectSchema as AnySchema],
    workRealm: [WorkRealmSchema as AnySchema],
    tale: [FullTaleSchema as AnySchema, PublishedHallItemSchema as AnySchema],
    tune: [FullTuneSchema as AnySchema, PublishedHallItemSchema as AnySchema],
    television: [FullTelevisionSchema as AnySchema, PublishedHallItemSchema as AnySchema],
    chapter: [FullChapterSchema as AnySchema, PublishedChapterSchema as AnySchema],
    tuneTrack: [FullTuneTrackSchema as AnySchema, PublishedTuneTrackSchema as AnySchema],
    televisionEpisode: [FullTelevisionEpisodeSchema as AnySchema, PublishedTelevisionEpisodeSchema as AnySchema],
  };

  it('binds every clearable surface to the schemas its writers touch', () => {
    expect(Object.keys(TARGETS).sort())
      .toEqual(Object.keys(MODERATION_CLEARABLE_TEXT_FIELDS).sort());
  });

  it('every clearable field is declared on each target schema', () => {
    for (const [surface, fields] of Object.entries(MODERATION_CLEARABLE_TEXT_FIELDS)) {
      for (const field of fields) {
        for (const schema of TARGETS[surface]) {
          expect({ surface, field, declared: declares(schema, field) })
            .toEqual({ surface, field, declared: true });
        }
      }
    }
  });

  it('the moderation-flag fields the same writers set are declared too', () => {
    // The `publicWorkProjects` search projection deliberately carries the placeholder TEXT only —
    // the flag pair lives on the steward-authoritative shell, which is where the member's edit
    // surface reads it.
    for (const schemas of Object.values(TARGETS)) {
      for (const schema of schemas) {
        if (schema === (PublicWorkProjectSchema as AnySchema)) continue;
        expect(declares(schema, 'moderationClearedFields')).toBe(true);
        expect(declares(schema, 'moderationClearedReason')).toBe(true);
      }
    }
  });
});

describe('WORK_SHELL_TEXT_FIELD_TO_HALL_ITEM_FIELD', () => {
  it('maps the shell text fields onto their published hall projection fields', () => {
    expect(WORK_SHELL_TEXT_FIELD_TO_HALL_ITEM_FIELD).toEqual({
      workingTitle: 'title',
      workingDescription: 'description',
    });
  });

  it('covers every clearable shell field', () => {
    expect(Object.keys(WORK_SHELL_TEXT_FIELD_TO_HALL_ITEM_FIELD).sort())
      .toEqual([...MODERATION_CLEARABLE_TEXT_FIELDS.workProject].sort());
  });

  it('keys are declared on the work shell and values on the published hall item', () => {
    for (const [shellField, hallField] of Object.entries(WORK_SHELL_TEXT_FIELD_TO_HALL_ITEM_FIELD)) {
      expect(declares(FullWorkProjectSchema as AnySchema, shellField)).toBe(true);
      expect(declares(PublishedHallItemSchema as AnySchema, hallField)).toBe(true);
    }
  });
});
