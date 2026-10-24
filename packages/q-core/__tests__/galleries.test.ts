import { describe, it, expect } from 'vitest';
import { COLLECTION_REFS } from '../src/paths/collection-refs.js';
import { COLLECTIONS, SPECIAL_DOCS } from '../src/paths/collections.js';
import { PATH_BUILDERS } from '../src/paths/path-builders.js';
import { toPath } from '../src/paths/utils.js';
import { GALLERY_OWNER_KIND_KEYS, PICTURE_OWNER_KIND_KEYS } from '../src/types/picture-owners.js';
import { COLLECTION_SCHEMAS } from '../src/doc-schemas/registry.js';
import { GalleryPictureSchema, GallerySummarySchema } from '../src/doc-schemas/gallery.js';
import { LandingPageConfigSchema } from '../src/doc-schemas/system.js';
import { LeagueTeamSchema } from '../src/doc-schemas/league-team.js';
import { PendingMediaTargetSchema } from '../src/doc-schemas/pending-media.js';
import { SportLeagueSchema } from '../src/doc-schemas/sport-league.js';

const PICTURE = {
  ownerKind: 'sportLeague',
  ownerId: 'league-1',
  position: 'a0',
  createdAt: 1_700_000_000_000,
};
// A picture id is its upload's staging id, a lowercase UUID.
const PICTURE_ID_1 = '6a1c0f3e-2b4d-4c5e-9f7a-8b0c1d2e3f40';
const PICTURE_ID_2 = '7b2d1e4f-3c5e-4d6f-a08b-9c1d2e3f4051';

describe('picture owner kinds', () => {
  it('name every document that can own a picture', () => {
    expect([...PICTURE_OWNER_KIND_KEYS]).toEqual([
      'sportLeague',
      'leagueTeam',
      'landingPage',
      'gameLocation',
      'awardDefinition',
    ]);
  });

  it('give galleries to leagues, teams, and the landing page only — a subset of the owners', () => {
    expect([...GALLERY_OWNER_KIND_KEYS]).toEqual(['sportLeague', 'leagueTeam', 'landingPage']);
    for (const kind of GALLERY_OWNER_KIND_KEYS) expect(PICTURE_OWNER_KIND_KEYS).toContain(kind);
  });
});

describe('galleryPictures documents', () => {
  it('live one per picture, keyed by the picture id, and bind to their schema', () => {
    expect(toPath(PATH_BUILDERS.galleryPicture(PICTURE_ID_1))).toBe(
      `${COLLECTIONS.GALLERY_PICTURES}/${PICTURE_ID_1}`,
    );
    expect(toPath(COLLECTION_REFS.galleryPictures())).toBe(COLLECTIONS.GALLERY_PICTURES);
    expect(COLLECTION_SCHEMAS['galleryPictures/{pictureId}']).toBe(GalleryPictureSchema);
  });

  it('accept a picture in each gallery owner kind, the landing page keyed by its fixed id', () => {
    for (const ownerKind of GALLERY_OWNER_KIND_KEYS) {
      expect(GalleryPictureSchema.safeParse({ ...PICTURE, ownerKind }).success).toBe(true);
    }
    expect(
      GalleryPictureSchema.safeParse({
        ...PICTURE,
        ownerKind: 'landingPage',
        ownerId: SPECIAL_DOCS.LANDING_PAGE,
      }).success,
    ).toBe(true);
  });

  it('refuse an owner that holds a single picture slot rather than a gallery', () => {
    expect(GalleryPictureSchema.safeParse({ ...PICTURE, ownerKind: 'gameLocation' }).success).toBe(
      false,
    );
    expect(
      GalleryPictureSchema.safeParse({ ...PICTURE, ownerKind: 'awardDefinition' }).success,
    ).toBe(false);
  });

  it('refuse a missing owner, an empty position, and a non-millisecond timestamp', () => {
    expect(GalleryPictureSchema.safeParse({ ...PICTURE, ownerId: '' }).success).toBe(false);
    expect(GalleryPictureSchema.safeParse({ ...PICTURE, position: '' }).success).toBe(false);
    expect(GalleryPictureSchema.safeParse({ ...PICTURE, createdAt: '2026-01-01' }).success).toBe(
      false,
    );
  });

  it('a carried picture keeps its V1 source position, and a picture stored without one still reads', () => {
    expect(GalleryPictureSchema.parse({ ...PICTURE, sourceIndex: 0 }).sourceIndex).toBe(0);
    expect(GalleryPictureSchema.parse(PICTURE).sourceIndex).toBeUndefined();
    expect(GalleryPictureSchema.safeParse({ ...PICTURE, sourceIndex: -1 }).success).toBe(false);
    expect(GalleryPictureSchema.safeParse({ ...PICTURE, sourceIndex: 1.5 }).success).toBe(false);
  });

  it('store no URL', () => {
    expect(Object.keys(GalleryPictureSchema.shape).sort()).toEqual([
      'createdAt',
      'ownerId',
      'ownerKind',
      'position',
      'sourceIndex',
    ]);
  });
});

describe('the gallery summary on its owner', () => {
  it('names a featured picture exactly when the gallery holds one', () => {
    expect(GallerySummarySchema.safeParse({ count: 0, updatedAt: 1 }).success).toBe(true);
    expect(
      GallerySummarySchema.safeParse({ count: 3, featuredPictureId: PICTURE_ID_2, updatedAt: 1 })
        .success,
    ).toBe(true);
    expect(GallerySummarySchema.safeParse({ count: 2, updatedAt: 1 }).success).toBe(false);
    expect(
      GallerySummarySchema.safeParse({ count: 0, featuredPictureId: PICTURE_ID_1, updatedAt: 1 })
        .success,
    ).toBe(false);
  });

  it('names its featured picture only by a picture id', () => {
    expect(
      GallerySummarySchema.safeParse({ count: 1, featuredPictureId: 'p1', updatedAt: 1 }).success,
    ).toBe(false);
    expect(
      GallerySummarySchema.safeParse({
        count: 1,
        featuredPictureId: PICTURE_ID_1.toUpperCase(),
        updatedAt: 1,
      }).success,
    ).toBe(false);
  });

  it('keeps an exact whole count', () => {
    expect(GallerySummarySchema.safeParse({ count: -1, updatedAt: 1 }).success).toBe(false);
    expect(
      GallerySummarySchema.safeParse({ count: 1.5, featuredPictureId: PICTURE_ID_1, updatedAt: 1 })
        .success,
    ).toBe(false);
  });

  it('is the optional `pictures` field on leagues, teams, and the landing page — absent is an empty gallery', () => {
    for (const schema of [SportLeagueSchema, LeagueTeamSchema, LandingPageConfigSchema]) {
      const field = schema.shape.pictures;
      expect(field).toBeDefined();
      expect(field.safeParse(undefined).success).toBe(true);
      expect(
        field.safeParse({ count: 1, featuredPictureId: PICTURE_ID_1, updatedAt: 1 }).success,
      ).toBe(true);
      expect(field.safeParse({ count: 1, updatedAt: 1 }).success).toBe(false);
    }
  });
});

describe('the carry provenance of a pending picture', () => {
  const owner = { kind: 'sportLeague', id: 'league-1' };
  const carriedFrom = { bucket: 'v1-bucket', path: 'leagues/league-1/a.jpg' };

  it('records the source position beside the object it was carried from', () => {
    expect(PendingMediaTargetSchema.safeParse({ owner, carriedFrom, sourceIndex: 2 }).success).toBe(
      true,
    );
    expect(PendingMediaTargetSchema.safeParse({ owner, carriedFrom }).success).toBe(true);
    expect(
      PendingMediaTargetSchema.safeParse({ owner, carriedFrom, sourceIndex: -1 }).success,
    ).toBe(false);
  });

  it('gives a source position only to a carried picture', () => {
    expect(PendingMediaTargetSchema.safeParse({ owner, sourceIndex: 0 }).success).toBe(false);
  });
});
