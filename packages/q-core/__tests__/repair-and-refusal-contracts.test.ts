// The contracts a game repair's answer and two designed refusals carry to the client: what a repair
// changed on the game, value by value, and the details a team-delete and a ghost-removal refusal name.

import { describe, it, expect } from 'vitest';
import { buildGameRosterPlayerId } from '../src/ids';
import {
  GameRepairChangesSchema,
  GameStatsRepairResultSchema,
  GhostRemovalRefusalDetailsSchema,
  LEAGUE_TEAM_DELETE_REFUSAL_KEYS,
  LeagueTeamDeleteRefusalDetailsSchema,
} from '../src/schemas';

const NO_CHANGES = { lines: [], scores: [] };

const RESULT = {
  gameId: 'g1',
  leagueId: 'L1',
  operationId: 'op-1',
  dryRun: false,
  outcome: 'reconciled',
  corrections: [],
  gameChanged: true,
  destinationChanges: [],
};

describe('a game repair names what it changed on the game', () => {
  it('carries each changed line field, score, list, the event counter, and the record rewrite, stored beside rebuilt', () => {
    const shooter = buildGameRosterPlayerId('T1', 'u1');
    const changes = {
      lines: [{ lineKey: shooter, field: 'points', stored: 9, rebuilt: 5 }],
      scores: [{ teamId: 'T1', stored: 13, rebuilt: 9 }],
      absentRosterPlayerIds: { stored: [], rebuilt: [shooter] },
      nonScoringRosterPlayerIds: { stored: [shooter], rebuilt: [] },
      statEventSequence: { stored: 5, rebuilt: 6 },
      recordRewritten: { pagesBefore: 1, pagesAfter: 1 },
    };
    expect(GameStatsRepairResultSchema.parse({ ...RESULT, gameChanges: changes }).gameChanges).toEqual(changes);
  });

  it('carries a derived line field such as fantasy points, which is not a counter', () => {
    expect(
      GameRepairChangesSchema.safeParse({ ...NO_CHANGES, lines: [{ lineKey: 'T1_u1', field: 'fantasyPoints', stored: 4.5, rebuilt: 3 }] })
        .success,
    ).toBe(true);
  });

  it('is required on every answer, empty when nothing changed', () => {
    expect(GameStatsRepairResultSchema.safeParse(RESULT).success).toBe(false);
    expect(GameStatsRepairResultSchema.safeParse({ ...RESULT, outcome: 'unchanged', gameChanged: false, gameChanges: NO_CHANGES }).success).toBe(true);
  });

  it('refuses a counter that is not a whole count, an entry that is not a roster entry id, and an unknown key', () => {
    expect(GameRepairChangesSchema.safeParse({ ...NO_CHANGES, statEventSequence: { stored: 5, rebuilt: 5.5 } }).success).toBe(false);
    expect(GameRepairChangesSchema.safeParse({ ...NO_CHANGES, absentRosterPlayerIds: { stored: ['nobody'], rebuilt: [] } }).success).toBe(false);
    expect(GameRepairChangesSchema.safeParse({ ...NO_CHANGES, wholeGame: {} }).success).toBe(false);
  });
});

describe('the designed refusals’ details', () => {
  it('a team delete refused for play names how many games the request had already deleted', () => {
    expect(LEAGUE_TEAM_DELETE_REFUSAL_KEYS).toEqual(['teamHasPlayed']);
    expect(LeagueTeamDeleteRefusalDetailsSchema.parse({ reason: 'teamHasPlayed', deletedGameCount: 1 })).toEqual({
      reason: 'teamHasPlayed',
      deletedGameCount: 1,
    });
    expect(LeagueTeamDeleteRefusalDetailsSchema.safeParse({ reason: 'teamHasPlayed' }).success).toBe(false);
    expect(LeagueTeamDeleteRefusalDetailsSchema.safeParse({ reason: 'other', deletedGameCount: 0 }).success).toBe(false);
  });

  it('a ghost removal refusal names its reason, and the entries already removed when it stops one under way', () => {
    expect(GhostRemovalRefusalDetailsSchema.safeParse({ reason: 'gameHeld' }).success).toBe(true);
    expect(
      GhostRemovalRefusalDetailsSchema.parse({ reason: 'captainNotRemovable', finishedGameEntriesRemoved: 2 }).finishedGameEntriesRemoved,
    ).toBe(2);
    expect(GhostRemovalRefusalDetailsSchema.safeParse({ reason: 'notAReason' }).success).toBe(false);
    expect(GhostRemovalRefusalDetailsSchema.safeParse({ reason: 'gameHeld', finishedGameEntriesRemoved: -1 }).success).toBe(false);
  });
});
