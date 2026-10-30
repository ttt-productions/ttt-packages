import { describe, expect, it } from 'vitest';
import {
  documentIdSegmentSchema,
  gameIdSchema,
  gameRosterPlayerIdSchema,
  leagueIdSchema,
  scheduleWeekIdSchema,
  statEventIdSchema,
  statsOperationIdSchema,
  teamIdSchema,
  userIdSchema,
} from '../src/doc-schemas/atoms.js';
import { gameLocationIdSchema } from '../src/doc-schemas/game-location.js';
import { waiverTemplateIdSchema } from '../src/doc-schemas/waiver-template.js';
import { buildGameRosterPlayerId } from '../src/ids/compound-ids.js';
import { MAX_DOCUMENT_ID_BYTES, isDocumentIdSegment } from '../src/paths/utils.js';
import {
  AdminDeleteSportGameInputSchema,
  AdminUpdateScheduleWeekInputSchema,
} from '../src/schemas/schedules.js';
import { teamInvitationIdSchema, teamJoinRequestIdSchema } from '../src/schemas/atoms.js';
import { GalleryPictureSchema } from '../src/doc-schemas/gallery.js';
import { PictureOwnerRefSchema } from '../src/doc-schemas/pending-media.js';
import { PictureRetirementTargetSchema } from '../src/doc-schemas/picture-retirement.js';
import { PICTURE_OWNER_PATHS, isPictureOwnerId } from '../src/paths/picture-owner-paths.js';
import { SPECIAL_DOCS } from '../src/paths/collections.js';
import { PICTURE_OWNER_KIND_KEYS } from '../src/types/picture-owners.js';
import type { PictureOwnerKind } from '../src/types/picture-owners.js';

const ID_ATOMS = {
  documentIdSegmentSchema,
  userIdSchema,
  leagueIdSchema,
  teamIdSchema,
  gameIdSchema,
  scheduleWeekIdSchema,
  statEventIdSchema,
  statsOperationIdSchema,
  gameLocationIdSchema,
  waiverTemplateIdSchema,
  teamInvitationIdSchema,
  teamJoinRequestIdSchema,
} as const;

const NOT_ONE_SEGMENT: readonly string[] = [
  '',
  'a/b',
  '/a',
  'a/',
  '.',
  '..',
  '__a__',
  '____',
  'x'.repeat(MAX_DOCUMENT_ID_BYTES + 1),
  // Two UTF-8 bytes each: within the limit in characters, past it in bytes.
  'é'.repeat(MAX_DOCUMENT_ID_BYTES / 2 + 1),
];

describe('isDocumentIdSegment', () => {
  it('accepts a minted id, a ghost id, a bye slot, and an id at the byte limit', () => {
    expect(isDocumentIdSegment('1767225600000_ab12')).toBe(true);
    expect(isDocumentIdSegment('ghost_1767225600000_ab12')).toBe(true);
    expect(isDocumentIdSegment('bye')).toBe(true);
    expect(isDocumentIdSegment('x'.repeat(MAX_DOCUMENT_ID_BYTES))).toBe(true);
    expect(isDocumentIdSegment('__a')).toBe(true);
    expect(isDocumentIdSegment('a..b')).toBe(true);
  });

  it.each(
    NOT_ONE_SEGMENT.map((id) => [
      id.length > 20 ? `${id.slice(0, 8)}… (${id.length} chars)` : JSON.stringify(id),
      id,
    ]),
  )('refuses %s', (_label, id) => {
    expect(isDocumentIdSegment(id)).toBe(false);
  });
});

describe('the id atoms a path is built from', () => {
  for (const [name, schema] of Object.entries(ID_ATOMS)) {
    it(`${name} accepts one segment and refuses every id that is not one`, () => {
      expect(schema.safeParse('1767225600000_ab12').success).toBe(true);
      for (const id of NOT_ONE_SEGMENT) {
        expect(schema.safeParse(id).success).toBe(false);
      }
    });
  }

  it('refuses an empty id with its one length issue, which a form states as a choice left unmade', () => {
    const result = documentIdSegmentSchema.safeParse('');
    expect(result.success).toBe(false);
    expect(result.error?.issues.map((issue) => issue.code)).toEqual(['too_small']);
  });

  it('gameRosterPlayerIdSchema refuses a slash even when the parts parse', () => {
    expect(
      gameRosterPlayerIdSchema.safeParse(buildGameRosterPlayerId('team1', 'user1')).success,
    ).toBe(true);
    expect(
      gameRosterPlayerIdSchema.safeParse(buildGameRosterPlayerId('team1', 'users/user1')).success,
    ).toBe(false);
  });

  it('a callable input naming a game or a week by a multi-segment id is refused at the wire', () => {
    expect(
      AdminDeleteSportGameInputSchema.safeParse({ gameId: 'g1/gameStatEvents/e1' }).success,
    ).toBe(false);
    expect(
      AdminUpdateScheduleWeekInputSchema.safeParse({
        leagueId: 'leagues/l1',
        weekId: 'week_1767225600000_ab12',
        weekTitle: 'Week 1',
      }).success,
    ).toBe(false);
  });
});

describe('a picture owner id', () => {
  const ownerIdOf = (kind: PictureOwnerKind) =>
    kind === 'landingPage' ? SPECIAL_DOCS.LANDING_PAGE : '1767225600000_ab12';

  for (const kind of PICTURE_OWNER_KIND_KEYS) {
    it(`names one ${kind} document, refused at the parse before any path is built from it`, () => {
      expect(PictureOwnerRefSchema.safeParse({ kind, id: ownerIdOf(kind) }).success).toBe(true);
      expect(isPictureOwnerId(kind, ownerIdOf(kind))).toBe(true);
      for (const id of NOT_ONE_SEGMENT) {
        expect(PictureOwnerRefSchema.safeParse({ kind, id }).success).toBe(false);
        expect(isPictureOwnerId(kind, id)).toBe(false);
      }
    });
  }

  it('builds the owner path of a valid id as one document', () => {
    for (const kind of PICTURE_OWNER_KIND_KEYS) {
      expect(PICTURE_OWNER_PATHS[kind].ownerDoc(ownerIdOf(kind))).toHaveLength(2);
    }
  });

  it('keys the landing page by its fixed id only', () => {
    expect(PictureOwnerRefSchema.safeParse({ kind: 'landingPage', id: 'league-1' }).success).toBe(
      false,
    );
    expect(isPictureOwnerId('landingPage', 'league-1')).toBe(false);
  });

  it('holds a gallery picture and a gallery retirement to the same owner check', () => {
    const picture = { ownerKind: 'sportLeague', position: 'a0', createdAt: 1_700_000_000_000 };
    const retirement = { kind: 'gallery', ownerKind: 'sportLeague' };
    expect(GalleryPictureSchema.safeParse({ ...picture, ownerId: 'league-1' }).success).toBe(true);
    expect(
      PictureRetirementTargetSchema.safeParse({ ...retirement, ownerId: 'league-1' }).success,
    ).toBe(true);
    for (const ownerId of ['venue/private/x', '__a__', '']) {
      expect(GalleryPictureSchema.safeParse({ ...picture, ownerId }).success).toBe(false);
      expect(PictureRetirementTargetSchema.safeParse({ ...retirement, ownerId }).success).toBe(
        false,
      );
    }
    expect(
      PictureRetirementTargetSchema.safeParse({
        kind: 'gallery',
        ownerKind: 'landingPage',
        ownerId: 'league-1',
      }).success,
    ).toBe(false);
  });
});
