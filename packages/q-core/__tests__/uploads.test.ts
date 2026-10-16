import { describe, it, expect } from 'vitest';
import type { MediaOriginSpec } from '@ttt-productions/media-schemas';
import {
  COLLECTION_REFS,
  FILE_ORIGIN_KEYS,
  GALLERY_OWNER_KIND_KEYS,
  MEDIA_ORIGIN_SPECS,
  PATH_BUILDERS,
  PICTURE_ASPECT_RATIOS,
  PICTURE_KINDS,
  PICTURE_ORIGIN_KEYS,
  PICTURE_UPLOAD_MAX_BYTES,
  PICTURE_VARIANT_KEYS,
  MAX_UPLOADS_MARKED_SEEN_PER_CALL,
  SIGNATURE_ORIGIN_KEYS,
  STALE_PENDING_MEDIA_AGE_MS,
  UPLOAD_TRAY_WINDOW_MS,
  SPECIAL_DOCS,
  STAGING_UPLOAD_PREFIX,
  buildGalleryRetirementId,
  buildPictureObjectPath,
  buildPictureObjectPrefix,
  buildStagingUploadPath,
  isGalleryOwnerKind,
  isPictureOrigin,
  isSignatureOrigin,
  isStagingId,
  parseStagingUploadPath,
  pictureAspectRatio,
  toPath,
} from '../src';
import {
  COLLECTION_SCHEMAS,
  PendingMediaSchema,
  PendingMediaTargetSchema,
  PictureRetirementSchema,
} from '../src/doc-schemas';
import {
  AdminClearUploadActivityInputSchema,
  AdminClearUploadActivityResultSchema,
  AdminDeletePictureInputSchema,
  AdminMarkUploadsSeenInputSchema,
  AdminMarkUploadsSeenResultSchema,
  AdminMovePictureInputSchema,
  AdminStartUploadInputSchema,
  AdminUpdateFeaturedPictureInputSchema,
  parseTargetInfo,
} from '../src/schemas';
import { DomainEventSchema } from '../src/domain-events';

const STAGING_ID = '3f2b6c1e-9a4d-4e8b-b7c2-5d1a0e9f8c34';
const UID = 'aB3dE5gH7jK9mN1pQ3sT5vW7xY9z';

// Every picture is stored as JPEG except the award badge, a square cropped round and stored as PNG so
// its corners stay transparent.
const storedFormatOf = (origin: string) => (origin === 'award-badge' ? 'png' : 'jpeg');
const cropShapeOf = (origin: string) => (origin === 'award-badge' ? 'round' : 'rect');

describe('the origin registry', () => {
  it('declares the league, team, landing, location, and award badge picture origins', () => {
    expect([...PICTURE_ORIGIN_KEYS]).toEqual(['league-picture', 'team-picture', 'landing-picture', 'location-picture', 'award-badge']);
    expect([...FILE_ORIGIN_KEYS]).toEqual([...PICTURE_ORIGIN_KEYS, ...SIGNATURE_ORIGIN_KEYS]);
    expect(Object.keys(MEDIA_ORIGIN_SPECS).sort()).toEqual([...FILE_ORIGIN_KEYS].sort());
  });

  it('partitions exactly by preserveOriginal: a signature origin is kept byte-exact, a picture origin never', () => {
    const specs = MEDIA_ORIGIN_SPECS as Record<string, MediaOriginSpec>;
    const kept = Object.keys(specs).filter((origin) => specs[origin]?.preserveOriginal === true);
    expect(kept.sort()).toEqual([...SIGNATURE_ORIGIN_KEYS].sort());
    for (const origin of PICTURE_ORIGIN_KEYS) {
      expect(isPictureOrigin(origin)).toBe(true);
      expect(isSignatureOrigin(origin)).toBe(false);
      expect(specs[origin]?.processing?.image, `${origin} has a processing spec`).toBeDefined();
    }
  });

  it('refuses an unknown origin in every guard', () => {
    expect(isPictureOrigin('products')).toBe(false);
    expect(isSignatureOrigin('products')).toBe(false);
  });

  it('caps every picture upload at the picture raw cap and accepts images only', () => {
    for (const origin of PICTURE_ORIGIN_KEYS) {
      const spec = MEDIA_ORIGIN_SPECS[origin];
      expect(spec.maxBytes).toBe(PICTURE_UPLOAD_MAX_BYTES);
      expect(spec.accept?.kinds).toEqual(['image']);
      expect(spec.accept?.formats).toEqual(['jpeg', 'png', 'gif', 'webp', 'bmp', 'tiff']);
    }
  });

  it('declares every stored size at its kind\'s shape, one per variant key', () => {
    for (const origin of PICTURE_ORIGIN_KEYS) {
      const kind = PICTURE_KINDS[origin];
      const { width, height } = PICTURE_ASPECT_RATIOS[kind.aspect];
      expect(Object.keys(kind.sizes)).toEqual([...PICTURE_VARIANT_KEYS]);
      for (const key of PICTURE_VARIANT_KEYS) {
        const size = kind.sizes[key];
        expect(size.width * height, `${origin} ${key}`).toBe(size.height * width);
      }
      expect(kind.sizes.sm.width).toBeLessThan(kind.sizes.md.width);
      expect(kind.sizes.md.width).toBeLessThan(kind.sizes.lg.width);
    }
  });

  it('derives the browser crop and the server crop from the one aspect declaration', () => {
    for (const origin of PICTURE_ORIGIN_KEYS) {
      const kind = PICTURE_KINDS[origin];
      const spec = MEDIA_ORIGIN_SPECS[origin];
      const { width, height } = PICTURE_ASPECT_RATIOS[kind.aspect];
      expect(spec.imageCrop).toMatchObject({
        aspectRatio: pictureAspectRatio(kind.aspect),
        outputWidth: kind.sizes.lg.width,
        outputHeight: kind.sizes.lg.height,
        aspectRatioDisplay: `${width}:${height}`,
        shape: cropShapeOf(origin),
        format: storedFormatOf(origin),
      });
      expect(spec.processing?.image).toMatchObject({
        requiredAspectRatio: pictureAspectRatio(kind.aspect),
        allowAutoFormat: true,
      });
    }
  });

  it('cuts every variant to its exact size, in its stored format, with metadata stripped', () => {
    for (const origin of PICTURE_ORIGIN_KEYS) {
      const image = MEDIA_ORIGIN_SPECS[origin].processing?.image?.image;
      expect(image?.stripMetadata).toBe(true);
      expect(image?.variants.map((variant) => variant.key)).toEqual([...PICTURE_VARIANT_KEYS]);
      for (const variant of image?.variants ?? []) {
        const size = PICTURE_KINDS[origin].sizes[variant.key as (typeof PICTURE_VARIANT_KEYS)[number]];
        expect(variant.crop).toEqual({ width: size.width, height: size.height, gravity: 'center' });
        expect(variant.format).toBe(storedFormatOf(origin));
      }
    }
  });

  it('keeps an award badge square, cropped round, as PNG at 64, 256, and 512 pixels', () => {
    const badge = PICTURE_KINDS['award-badge'];
    expect(badge).toMatchObject({ aspect: 'square', cropShape: 'round', format: 'png' });
    expect(PICTURE_VARIANT_KEYS.map((key) => badge.sizes[key])).toEqual([
      { width: 64, height: 64 },
      { width: 256, height: 256 },
      { width: 512, height: 512 },
    ]);
  });

  it('gives the league and location pictures the landscape shape, the team picture the classic, and the landing picture the banner', () => {
    expect(PICTURE_KINDS['league-picture'].aspect).toBe('landscape');
    expect(PICTURE_KINDS['location-picture'].aspect).toBe('landscape');
    expect(PICTURE_KINDS['team-picture'].aspect).toBe('classic');
    expect(PICTURE_KINDS['landing-picture'].aspect).toBe('banner');
  });

  it('cuts a team picture to 480×360, 960×720, and 1600×1200, the largest also the browser crop', () => {
    expect(PICTURE_KINDS['team-picture'].sizes).toEqual({
      sm: { width: 480, height: 360 },
      md: { width: 960, height: 720 },
      lg: { width: 1600, height: 1200 },
    });
    expect(MEDIA_ORIGIN_SPECS['team-picture'].imageCrop).toMatchObject({ outputWidth: 1600, outputHeight: 1200 });
  });
});

describe('the staging path', () => {
  it('is the origin, the uploader, and the staging id under the one staging prefix', () => {
    const path = buildStagingUploadPath('league-picture', UID, STAGING_ID);
    expect(path.startsWith(STAGING_UPLOAD_PREFIX)).toBe(true);
    expect(path.split('/')).toEqual([STAGING_UPLOAD_PREFIX.slice(0, -1), 'league-picture', UID, STAGING_ID]);
  });

  it('parses back to its parts', () => {
    expect(parseStagingUploadPath(buildStagingUploadPath('landing-picture', UID, STAGING_ID))).toEqual({
      fileOrigin: 'landing-picture',
      userId: UID,
      stagingId: STAGING_ID,
    });
  });

  it('refuses anything that is not exactly a staging path', () => {
    const good = buildStagingUploadPath('league-picture', UID, STAGING_ID);
    expect(parseStagingUploadPath(`${good}/extra`)).toBeNull();
    expect(parseStagingUploadPath(good.replace('league-picture', 'products'))).toBeNull();
    expect(parseStagingUploadPath(good.replace(STAGING_UPLOAD_PREFIX, 'pictures/'))).toBeNull();
    expect(parseStagingUploadPath(good.replace(UID, ''))).toBeNull();
    expect(parseStagingUploadPath(good.replace(STAGING_ID, 'signature.png'))).toBeNull();
    expect(parseStagingUploadPath(good.replace(STAGING_ID, STAGING_ID.toUpperCase()))).toBeNull();
  });

  it('takes only a lowercase UUID as a staging id', () => {
    expect(isStagingId(STAGING_ID)).toBe(true);
    expect(isStagingId(STAGING_ID.toUpperCase())).toBe(false);
    expect(isStagingId('not-a-uuid')).toBe(false);
    expect(isStagingId(`${STAGING_ID}x`)).toBe(false);
  });
});

describe('picture object paths', () => {
  it('put every size of a picture under one extensionless prefix', () => {
    const prefix = buildPictureObjectPrefix(STAGING_ID);
    for (const key of PICTURE_VARIANT_KEYS) {
      expect(buildPictureObjectPath(STAGING_ID, key)).toBe(`${prefix}/${key}`);
    }
  });
});

describe('pendingMedia and pictureRetirements', () => {
  it('are declared, bound to their schemas, and keyed by their own builders', () => {
    expect(COLLECTION_SCHEMAS['pendingMedia/{pendingMediaId}']).toBe(PendingMediaSchema);
    expect(COLLECTION_SCHEMAS['pictureRetirements/{retirementId}']).toBe(PictureRetirementSchema);
    expect(toPath(PATH_BUILDERS.pendingMedia(STAGING_ID)).split('/')).toEqual([
      toPath(COLLECTION_REFS.pendingMedia()),
      STAGING_ID,
    ]);
    expect(toPath(PATH_BUILDERS.pictureRetirement(STAGING_ID)).split('/')).toEqual([
      toPath(COLLECTION_REFS.pictureRetirements()),
      STAGING_ID,
    ]);
  });

  it('parse a server-written pending row with its normalized target', () => {
    const row = {
      id: STAGING_ID,
      userId: UID,
      fileOrigin: 'league-picture',
      originalFileName: STAGING_ID,
      originalContentType: 'image/jpeg',
      originalSize: 120_000,
      pendingStoragePath: buildStagingUploadPath('league-picture', UID, STAGING_ID),
      targetInfo: { owner: { kind: 'sportLeague', id: 'league-1' } },
      clientContext: { surface: 'league-picture' },
      status: 'pending',
      createdAt: 1_700_000_000_000,
      updatedAt: 1_700_000_000_000,
    };
    expect(PendingMediaSchema.safeParse(row).success).toBe(true);
    expect(PendingMediaTargetSchema.safeParse(row.targetInfo).success).toBe(true);
    expect(PendingMediaSchema.safeParse({ ...row, fileOrigin: 'products' }).success).toBe(false);
  });

  it('refuse a target that names an unknown owner kind or carries an extra field', () => {
    expect(PendingMediaTargetSchema.safeParse({ owner: { kind: 'userProfile', id: 'u1' } }).success).toBe(false);
    expect(
      PendingMediaTargetSchema.safeParse({ owner: { kind: 'sportLeague', id: 'l1' }, path: 'x' }).success,
    ).toBe(false);
  });

  it('record a picture retirement and a whole gallery retirement', () => {
    expect(
      PictureRetirementSchema.safeParse({
        target: { kind: 'picture', pictureId: STAGING_ID },
        requestedAt: 1_700_000_000_000,
        reason: 'removed',
      }).success,
    ).toBe(true);
    expect(
      PictureRetirementSchema.safeParse({
        target: { kind: 'gallery', ownerKind: 'leagueTeam', ownerId: 'team-1' },
        requestedAt: 1_700_000_000_000,
        reason: 'ownerDeleted',
      }).success,
    ).toBe(true);
    expect(
      PictureRetirementSchema.safeParse({
        target: { kind: 'gallery', ownerKind: 'gameLocation', ownerId: 'loc-1' },
        requestedAt: 1_700_000_000_000,
        reason: 'ownerDeleted',
      }).success,
    ).toBe(false);
  });

  it('key a gallery retirement apart from every picture retirement', () => {
    const id = buildGalleryRetirementId('leagueTeam', 'team-1');
    expect(id).not.toBe(buildGalleryRetirementId('sportLeague', 'team-1'));
    expect(isStagingId(id)).toBe(false);
  });
});

describe('gallery owner kinds', () => {
  it('tell a gallery owner from a slot owner', () => {
    for (const kind of GALLERY_OWNER_KIND_KEYS) expect(isGalleryOwnerKind(kind)).toBe(true);
    expect(isGalleryOwnerKind('gameLocation')).toBe(false);
    expect(isGalleryOwnerKind('awardDefinition')).toBe(false);
  });
});

describe('adminStartUpload input', () => {
  const storagePath = buildStagingUploadPath('league-picture', UID, STAGING_ID);

  it('accepts each origin with its own target', () => {
    expect(
      AdminStartUploadInputSchema.safeParse({ fileOrigin: 'league-picture', storagePath, targetInfo: { leagueId: 'l1' } })
        .success,
    ).toBe(true);
    expect(
      AdminStartUploadInputSchema.safeParse({ fileOrigin: 'landing-picture', storagePath, targetInfo: {} }).success,
    ).toBe(true);
    expect(
      AdminStartUploadInputSchema.safeParse({
        fileOrigin: 'location-picture',
        storagePath,
        targetInfo: { gameLocationId: 'loc-1' },
      }).success,
    ).toBe(true);
  });

  it('refuses a target that does not fit its origin', () => {
    expect(
      AdminStartUploadInputSchema.safeParse({ fileOrigin: 'league-picture', storagePath, targetInfo: {} }).success,
    ).toBe(false);
    expect(
      AdminStartUploadInputSchema.safeParse({
        fileOrigin: 'landing-picture',
        storagePath,
        targetInfo: { leagueId: 'l1' },
      }).success,
    ).toBe(false);
    expect(AdminStartUploadInputSchema.safeParse({ fileOrigin: 'league-picture', storagePath }).success).toBe(false);
  });

  it('refuses an unknown origin, a missing path, and any extra field — a file name or a subject included', () => {
    expect(
      AdminStartUploadInputSchema.safeParse({ fileOrigin: 'products', storagePath, targetInfo: {} }).success,
    ).toBe(false);
    expect(
      AdminStartUploadInputSchema.safeParse({ fileOrigin: 'landing-picture', storagePath: '', targetInfo: {} }).success,
    ).toBe(false);
    expect(
      AdminStartUploadInputSchema.safeParse({
        fileOrigin: 'landing-picture',
        storagePath,
        targetInfo: {},
        originalFileName: 'x.jpg',
      }).success,
    ).toBe(false);
  });

  it('normalizes each target to the owner it names', () => {
    expect(parseTargetInfo('league-picture', { leagueId: 'l1' })).toEqual({ kind: 'sportLeague', id: 'l1' });
    expect(parseTargetInfo('team-picture', { teamId: 't1' })).toEqual({ kind: 'leagueTeam', id: 't1' });
    expect(() => parseTargetInfo('team-picture', { leagueId: 'l1' })).toThrow();
    expect(parseTargetInfo('landing-picture', {})).toEqual({ kind: 'landingPage', id: SPECIAL_DOCS.LANDING_PAGE });
    expect(parseTargetInfo('location-picture', { gameLocationId: 'loc-1' })).toEqual({
      kind: 'gameLocation',
      id: 'loc-1',
    });
    expect(() => parseTargetInfo('location-picture', { leagueId: 'l1' })).toThrow();
  });
});

describe('the gallery callables', () => {
  const P1 = STAGING_ID;
  const P2 = '8a7d6c5b-4e3f-4a2b-9c1d-0e9f8a7b6c5d';

  it('take a picture id and a neighbour, or null to go first', () => {
    expect(AdminMovePictureInputSchema.safeParse({ pictureId: P1, afterPictureId: null }).success).toBe(true);
    expect(AdminMovePictureInputSchema.safeParse({ pictureId: P1, afterPictureId: P2 }).success).toBe(true);
    expect(AdminMovePictureInputSchema.safeParse({ pictureId: P1 }).success).toBe(false);
    expect(AdminMovePictureInputSchema.safeParse({ pictureId: P1, afterPictureId: null, position: 'a0' }).success).toBe(
      false,
    );
  });

  it('feature by id alone and delete by owner and id', () => {
    expect(AdminUpdateFeaturedPictureInputSchema.safeParse({ pictureId: P1 }).success).toBe(true);
    expect(
      AdminDeletePictureInputSchema.safeParse({ owner: { kind: 'gameLocation', id: 'loc-1' }, pictureId: P1 }).success,
    ).toBe(true);
    expect(AdminDeletePictureInputSchema.safeParse({ owner: { kind: 'x', id: 'loc-1' }, pictureId: P1 }).success).toBe(
      false,
    );
  });

  it('refuse a picture id that is not a staging id, so a malformed id never reaches a document path', () => {
    for (const malformed of ['a/b', 'p1', STAGING_ID.toUpperCase(), '']) {
      expect(AdminMovePictureInputSchema.safeParse({ pictureId: malformed, afterPictureId: null }).success).toBe(false);
      expect(AdminMovePictureInputSchema.safeParse({ pictureId: P1, afterPictureId: malformed }).success).toBe(false);
      expect(AdminUpdateFeaturedPictureInputSchema.safeParse({ pictureId: malformed }).success).toBe(false);
      expect(
        AdminDeletePictureInputSchema.safeParse({ owner: { kind: 'sportLeague', id: 'l1' }, pictureId: malformed }).success,
      ).toBe(false);
    }
  });
});

describe('picture domain events', () => {
  it('carry a new gallery entry whole, and name the landing page and a team as owners', () => {
    expect(
      DomainEventSchema.safeParse({
        type: 'galleryPicture.added',
        ids: { ownerKind: 'sportLeague', ownerId: 'l1', pictureId: STAGING_ID },
        position: 'a0',
        createdAt: 1_700_000_000_000,
      }).success,
    ).toBe(true);
    expect(DomainEventSchema.safeParse({ type: 'landingPage.updated', ids: {} }).success).toBe(true);
    expect(
      DomainEventSchema.safeParse({ type: 'leagueTeam.updated', ids: { leagueId: 'l1', teamId: 't1' } }).success,
    ).toBe(true);
  });
});

describe('the upload tray callables', () => {
  it('follow every unfinished upload: the tray window outlasts the age at which the sweep fails one', () => {
    expect(UPLOAD_TRAY_WINDOW_MS).toBeGreaterThan(STALE_PENDING_MEDIA_AGE_MS);
  });

  it('mark between one and the per-call bound of uploads seen, each by its staging id', () => {
    expect(AdminMarkUploadsSeenInputSchema.safeParse({ pendingMediaIds: [STAGING_ID] }).success).toBe(true);
    expect(AdminMarkUploadsSeenInputSchema.safeParse({ pendingMediaIds: [] }).success).toBe(false);
    expect(
      AdminMarkUploadsSeenInputSchema.safeParse({
        pendingMediaIds: Array.from({ length: MAX_UPLOADS_MARKED_SEEN_PER_CALL + 1 }, () => STAGING_ID),
      }).success,
    ).toBe(false);
    expect(AdminMarkUploadsSeenResultSchema.safeParse({ marked: 0 }).success).toBe(true);
  });

  it('clear one upload by its staging id', () => {
    expect(AdminClearUploadActivityInputSchema.safeParse({ pendingMediaId: STAGING_ID }).success).toBe(true);
    expect(AdminClearUploadActivityResultSchema.safeParse({ cleared: true }).success).toBe(true);
  });

  it('refuse a malformed id and any field beyond the ids, so the caller names nothing else', () => {
    for (const malformed of ['a/b', STAGING_ID.toUpperCase(), '']) {
      expect(AdminMarkUploadsSeenInputSchema.safeParse({ pendingMediaIds: [malformed] }).success).toBe(false);
      expect(AdminClearUploadActivityInputSchema.safeParse({ pendingMediaId: malformed }).success).toBe(false);
    }
    expect(AdminMarkUploadsSeenInputSchema.safeParse({ pendingMediaIds: [STAGING_ID], userId: UID }).success).toBe(false);
    expect(AdminClearUploadActivityInputSchema.safeParse({ pendingMediaId: STAGING_ID, userId: UID }).success).toBe(false);
  });
});
