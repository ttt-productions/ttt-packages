// Every id atom a document path is built from accepts exactly one path segment (ARCH-106). A client
// string holding a `/` would address a different document or a subcollection, an empty one the
// collection itself, and `.`, `..`, `__…__`, or an id past Firestore's byte limit is refused by
// Firestore at write time — so the wire schema refuses each before any path exists.

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
