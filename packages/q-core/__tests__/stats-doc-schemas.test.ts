import { describe, it, expect } from 'vitest';
import { z } from 'zod';
import {
  CURLING_ROUND_COUNT,
  MAX_CURLING_ROUND_POINTS,
  STAT_HISTORY_PAGE_SIZE,
} from '../src/constants/sports.js';
import {
  BasketballPlayerStatsSchema,
  GameStatEventSchema,
  StatCorrectionEventSchema,
  type GameStatEventType,
} from '../src/doc-schemas/game-stats.js';
import {
  BasketballPlayerTotalsSchema,
  PlayerSeasonStatsSchema,
  SPORT_LINE_SCHEMAS,
  SportHallOfFameSchema,
  TeamSeasonStatsSchema,
  UserLifetimeStatsSchema,
} from '../src/doc-schemas/aggregate-stats.js';
import { COLLECTION_SCHEMAS } from '../src/doc-schemas/registry.js';
import {
  GameStatHistoryFirstPageSchema,
  GameStatHistoryPageSchema,
} from '../src/doc-schemas/game-stat-history.js';
import { LeagueTeamSchema } from '../src/doc-schemas/league-team.js';
import { SportGameSchema } from '../src/doc-schemas/sport-game.js';
import { StatsOperationSchema } from '../src/doc-schemas/stats-operation.js';
import { UserProfileSchema } from '../src/doc-schemas/user-profile.js';
import { repairReasonSchema } from '../src/doc-schemas/atoms.js';
import { BYE_TEAM_ID } from '../src/ids/minted-ids.js';
import { buildGameRosterPlayerId } from '../src/ids/compound-ids.js';
import { buildStatCorrectionId, buildStatVoidId } from '../src/ids/stat-event-ids.js';
import { ReopenGameInputSchema } from '../src/schemas/stats.js';
import { LEAGUE_TYPE_KEYS, SPORT_KEYS, SPORT_KEY_BY_LEAGUE_TYPE } from '../src/types/sports.js';
import type { StatsOperationKind } from '../src/types/stats.js';

const NOW = 1712345678901;
const [BASKETBALL, CURLING, FOOTBALL] = LEAGUE_TYPE_KEYS;
const T1_U1 = buildGameRosterPlayerId('T1', 'u1');
const T2_U1 = buildGameRosterPlayerId('T2', 'u1');

const recorded = { eventId: 'e1', sequence: 1, recordedAt: NOW };
const byCaptain = {
  acceptedAt: NOW + 40,
  recordedByUserId: 'captain1',
  recordedByAuthority: 'captain',
  recordedByTeamId: 'T1',
};
const player = { teamId: 'T1', playerUserId: 'u1' };

const voidOf = (targetEventId: string) => ({
  ...recorded,
  eventId: buildStatVoidId(targetEventId),
  type: 'STAT_VOID',
  targetEventId,
});

const correction = {
  ...recorded,
  eventId: buildStatCorrectionId('op1', T1_U1, 'points'),
  type: 'STAT_CORRECTION',
  teamId: 'T1',
  playerUserId: 'u1',
  stat: 'points',
  value: -2,
  correctionSource: 'admin',
  operationId: 'op1',
  reason: 'Scorer credited the wrong player.',
};

// One valid stored event of every declared type.
const VALID_EVENTS = {
  '1PT': { ...recorded, ...player, type: '1PT' },
  '2PT': { ...recorded, ...player, type: '2PT', assistedByUserId: 'u2' },
  '3PT': { ...recorded, ...player, type: '3PT' },
  REBOUND: { ...recorded, ...player, type: 'REBOUND' },
  ASSIST: { ...recorded, ...player, type: 'ASSIST' },
  TIMEOUT: { ...recorded, teamId: 'T1', type: 'TIMEOUT' },
  BULK_EDIT: {
    ...recorded,
    ...player,
    type: 'BULK_EDIT',
    stat: 'rebounds',
    value: 2,
    previousValue: 5,
  },
  CURLING_ROUND_SCORE: {
    ...recorded,
    type: 'CURLING_ROUND_SCORE',
    teamId: 'T1',
    roundNumber: 1,
    points: 3,
  },
  CURLING_ROUND_BLANK: { ...recorded, type: 'CURLING_ROUND_BLANK', roundNumber: 2 },
  FOOTBALL_6PT: { ...recorded, type: 'FOOTBALL_6PT', teamId: 'T1' },
  FOOTBALL_2PT: { ...recorded, type: 'FOOTBALL_2PT', teamId: 'T1' },
  FOOTBALL_1PT: { ...recorded, type: 'FOOTBALL_1PT', teamId: 'T1' },
  FOOTBALL_BULK_EDIT: {
    ...recorded,
    type: 'FOOTBALL_BULK_EDIT',
    teamId: 'T1',
    value: 7,
    previousValue: 21,
  },
  STAT_VOID: voidOf('e0'),
  STAT_CORRECTION: correction,
} satisfies Record<GameStatEventType, object>;

const parses = (event: object) => GameStatEventSchema.safeParse(event).success;

describe('stat event documents', () => {
  it.each(Object.entries(VALID_EVENTS))('accepts a %s event', (_type, event) => {
    expect(parses(event)).toBe(true);
  });

  it('accepts the recorder facts the writing core derives, and a copied event with none', () => {
    expect(parses({ ...VALID_EVENTS['3PT'], ...byCaptain })).toBe(true);
    expect(
      parses({
        ...VALID_EVENTS['3PT'],
        acceptedAt: NOW,
        recordedByUserId: 'a1',
        recordedByAuthority: 'admin',
      }),
    ).toBe(true);
    expect(
      parses({
        ...VALID_EVENTS['3PT'],
        displayNameSnapshot: 'Pat',
        assistedByDisplayNameSnapshot: 'Sam',
        assistedByUserId: 'u2',
      }),
    ).toBe(true);
  });

  it('refuses a name snapshot on an event the writing core recorded, which carries ids only', () => {
    expect(parses({ ...VALID_EVENTS['3PT'], ...byCaptain, displayNameSnapshot: 'Pat' })).toBe(
      false,
    );
    expect(
      parses({
        ...VALID_EVENTS['2PT'],
        acceptedAt: NOW,
        recordedByUserId: 'a1',
        recordedByAuthority: 'admin',
        assistedByDisplayNameSnapshot: 'Sam',
      }),
    ).toBe(false);
    expect(parses({ ...VALID_EVENTS.BULK_EDIT, ...byCaptain, displayNameSnapshot: 'Pat' })).toBe(
      false,
    );
  });

  it('refuses recorder facts that disagree', () => {
    expect(parses({ ...VALID_EVENTS['3PT'], acceptedAt: NOW })).toBe(false);
    expect(parses({ ...VALID_EVENTS['3PT'], ...byCaptain, recordedByTeamId: undefined })).toBe(
      false,
    );
    expect(parses({ ...VALID_EVENTS['3PT'], ...byCaptain, recordedByAuthority: 'referee' })).toBe(
      false,
    );
    expect(parses({ ...VALID_EVENTS['3PT'], ...byCaptain, recordedByAuthority: 'player' })).toBe(
      false,
    );
  });

  it('refuses an event type no sport declares', () => {
    expect(parses({ ...recorded, ...player, type: 'FOUL' })).toBe(false);
    expect(parses({ ...recorded, ...player, type: 'STEAL' })).toBe(false);
  });

  it('refuses a player on a team-attributed event, with no sentinel standing in for one', () => {
    expect(parses({ ...VALID_EVENTS.TIMEOUT, playerUserId: 'team_timeout' })).toBe(false);
    expect(parses({ ...VALID_EVENTS.CURLING_ROUND_SCORE, playerUserId: 'team_score' })).toBe(false);
    expect(parses({ ...VALID_EVENTS.FOOTBALL_6PT, playerUserId: 'u1' })).toBe(false);
  });

  it('refuses an assister anywhere but a two- or three-point shot, and a snapshot with no assister', () => {
    expect(parses({ ...VALID_EVENTS['1PT'], assistedByUserId: 'u2' })).toBe(false);
    expect(parses({ ...VALID_EVENTS.REBOUND, assistedByUserId: 'u2' })).toBe(false);
    expect(parses({ ...VALID_EVENTS['3PT'], assistedByDisplayNameSnapshot: 'Sam' })).toBe(false);
  });

  it('requires a player on every player-attributed event, and a team on every team event', () => {
    expect(parses({ ...recorded, teamId: 'T1', type: 'REBOUND' })).toBe(false);
    expect(parses({ ...recorded, playerUserId: 'u1', type: '2PT' })).toBe(false);
    expect(parses({ ...recorded, type: 'FOOTBALL_1PT' })).toBe(false);
    expect(parses({ ...VALID_EVENTS.CURLING_ROUND_BLANK, teamId: 'T1' })).toBe(false);
  });

  it('orders by a positive sequence and stamps an epoch-millisecond time', () => {
    expect(parses({ ...VALID_EVENTS.REBOUND, sequence: 0 })).toBe(false);
    expect(parses({ ...VALID_EVENTS.REBOUND, sequence: 1.5 })).toBe(false);
    const { sequence: _sequence, ...unsequenced } = VALID_EVENTS.REBOUND;
    expect(parses(unsequenced)).toBe(false);
    expect(parses({ ...VALID_EVENTS.REBOUND, recordedAt: '2024-04-05T19:30:00.000Z' })).toBe(false);
  });

  it('holds a bulk edit to a whole-number change of a player counter, entered against the value shown', () => {
    const { previousValue: _shown, ...copied } = VALID_EVENTS.BULK_EDIT;
    expect(parses(copied)).toBe(true);
    expect(parses({ ...VALID_EVENTS.BULK_EDIT, stat: 'score' })).toBe(false);
    expect(parses({ ...VALID_EVENTS.BULK_EDIT, value: 1.5 })).toBe(false);
    const { previousValue: _footballShown, ...footballWithoutShown } =
      VALID_EVENTS.FOOTBALL_BULK_EDIT;
    expect(parses(footballWithoutShown)).toBe(false);
  });

  it('holds a curling end to a real round and a real score', () => {
    expect(parses({ ...VALID_EVENTS.CURLING_ROUND_SCORE, roundNumber: CURLING_ROUND_COUNT })).toBe(
      true,
    );
    expect(
      parses({ ...VALID_EVENTS.CURLING_ROUND_SCORE, roundNumber: CURLING_ROUND_COUNT + 1 }),
    ).toBe(false);
    expect(parses({ ...VALID_EVENTS.CURLING_ROUND_SCORE, roundNumber: 0 })).toBe(false);
    expect(parses({ ...VALID_EVENTS.CURLING_ROUND_SCORE, points: 0 })).toBe(false);
    expect(
      parses({ ...VALID_EVENTS.CURLING_ROUND_SCORE, points: MAX_CURLING_ROUND_POINTS + 1 }),
    ).toBe(false);
  });

  it('stores a void at the id its target derives, so a target has at most one void', () => {
    expect(parses({ ...voidOf('e0'), eventId: 'e9' })).toBe(false);
    expect(parses({ ...voidOf('e0'), teamId: 'T1' })).toBe(false);
  });

  it('stores a correction at the id its operation, line, and field derive', () => {
    const teamCorrection = {
      ...correction,
      eventId: buildStatCorrectionId('migration', 'T1', 'score'),
      playerUserId: undefined,
      stat: 'score',
      correctionSource: 'migration',
      operationId: 'migration',
    };
    expect(parses(teamCorrection)).toBe(true);
    expect(
      parses({ ...correction, eventId: buildStatCorrectionId('op1', T1_U1, 'rebounds') }),
    ).toBe(false);
    expect(parses({ ...correction, teamId: 'T2' })).toBe(false);
  });

  it('holds a correction to a counter, a known source, and a recorded reason', () => {
    expect(parses({ ...correction, stat: 'fantasyPoints' })).toBe(false);
    expect(parses({ ...correction, correctionSource: 'client' })).toBe(false);
    expect(parses({ ...correction, reason: '' })).toBe(false);
    expect(parses({ ...correction, reason: '      ' })).toBe(false);
    const { reason: _reason, ...unexplained } = correction;
    expect(parses(unexplained)).toBe(false);
  });

  it('is bound in the registry to its path', () => {
    expect(COLLECTION_SCHEMAS['sportGames/{gameId}/gameStatEvents/{eventId}']).toBe(
      GameStatEventSchema,
    );
  });
});

describe('the game rollup', () => {
  const game = {
    leagueId: 'L',
    weekId: 'week-1',
    weekTitle: 'Week 1',
    weekLocation: 'Main Gym',
    weekStartDate: NOW,
    startTime: NOW,
    dayKey: '2024-04-05',
    locationLabel: 'Main Gym - Court 2',
    status: 'inprogress',
    teams: [{ teamId: 'T1' }, { teamId: 'T2' }],
    teamIds: ['T1', 'T2'],
    score: { T1: 5, T2: 0 },
    statEventSequence: 3,
    absentRosterPlayerIds: [T2_U1],
    createdAt: NOW,
    updatedAt: NOW,
  };
  const basketball = {
    ...game,
    leagueType: BASKETBALL,
    stats: {
      teamStats: { T1: { score: 5, timeouts: 1 }, T2: { score: 0, timeouts: 0 } },
      playerStats: { [T1_U1]: { points: 5, rebounds: 2, assists: 0, fantasyPoints: 8 } },
    },
  };
  const valid = (doc: object) => SportGameSchema.safeParse(doc).success;
  const withStats = (stats: object) => ({
    ...basketball,
    stats: { ...basketball.stats, ...stats },
  });

  it('keys a player line by roster entry, so one person can hold a line on each side', () => {
    expect(valid(basketball)).toBe(true);
    expect(
      valid(
        withStats({
          playerStats: {
            [T1_U1]: { points: 5, rebounds: 0, assists: 0, fantasyPoints: 5 },
            [T2_U1]: { points: 0, rebounds: 3, assists: 0, fantasyPoints: 4.5 },
          },
        }),
      ),
    ).toBe(true);
    expect(
      valid(
        withStats({
          playerStats: { u1: { points: 5, rebounds: 2, assists: 0, fantasyPoints: 8 } },
        }),
      ),
    ).toBe(false);
    expect(
      valid(
        withStats({
          playerStats: {
            [buildGameRosterPlayerId('T3', 'u1')]: {
              points: 1,
              rebounds: 0,
              assists: 0,
              fantasyPoints: 1,
            },
          },
        }),
      ),
    ).toBe(false);
  });

  it("holds exactly teamStats and playerStats, and a line for each of the game's teams only", () => {
    expect(valid(withStats({ statHistory: [] }))).toBe(false);
    expect(valid(withStats({ teamStats: { T1: { score: 5, timeouts: 1 } } }))).toBe(false);
    expect(
      valid(
        withStats({ teamStats: { ...basketball.stats.teamStats, T3: { score: 0, timeouts: 0 } } }),
      ),
    ).toBe(false);
    expect(valid({ ...basketball, score: { T1: 5 } })).toBe(false);
  });

  it('stores fantasy points on every basketball player line, and counters as whole numbers from zero', () => {
    expect(
      valid(withStats({ playerStats: { [T1_U1]: { points: 5, rebounds: 2, assists: 0 } } })),
    ).toBe(false);
    expect(
      valid(
        withStats({
          playerStats: { [T1_U1]: { points: -1, rebounds: 0, assists: 0, fantasyPoints: 0 } },
        }),
      ),
    ).toBe(false);
    expect(valid(withStats({ teamStats: { T1: { score: 5 }, T2: { score: 0 } } }))).toBe(false);
  });

  it('records absence and the stored games-played decision by roster entry', () => {
    expect(valid({ ...basketball, absentRosterPlayerIds: ['u1'] })).toBe(false);
    expect(
      valid({
        ...basketball,
        status: 'completed',
        finalizedAt: NOW,
        nonScoringRosterPlayerIds: [T2_U1],
      }),
    ).toBe(true);
    expect(valid({ ...basketball, nonScoringRosterPlayerIds: ['u1'] })).toBe(false);
    const { absentRosterPlayerIds: _absent, ...noAbsence } = basketball;
    expect(valid(noAbsence)).toBe(false);
  });

  it('names its teams in teamIds, never only in a teams list a reader would have to fall back to', () => {
    const { teamIds: _teamIds, ...teamsListOnly } = basketball;
    expect(valid(teamsListOnly)).toBe(false);
  });

  it('counts its events and names the operation holding it', () => {
    const { statEventSequence: _sequence, ...uncounted } = basketball;
    expect(valid(uncounted)).toBe(false);
    expect(valid({ ...basketball, statsOperationId: 'op1' })).toBe(true);
  });

  it('keeps a curling end unrecorded as null and a blank end as 0, in exactly one slot per end', () => {
    const ends = (recordedEnds: (number | null)[]) => [
      ...recordedEnds,
      ...new Array<number | null>(CURLING_ROUND_COUNT - recordedEnds.length).fill(null),
    ];
    const curling = (t1: (number | null)[], t2: (number | null)[]) => ({
      ...game,
      leagueType: CURLING,
      score: { T1: 0, T2: 0 },
      absentRosterPlayerIds: [],
      stats: {
        teamStats: { T1: { score: 0, roundScores: t1 }, T2: { score: 0, roundScores: t2 } },
        playerStats: {},
      },
    });
    expect(valid(curling(ends([2, 0]), ends([0, 0])))).toBe(true);
    expect(valid(curling(ends([]).slice(1), ends([])))).toBe(false);
    expect(valid(curling(ends([MAX_CURLING_ROUND_POINTS + 1]), ends([0])))).toBe(false);
    const withPlayerLine = curling(ends([]), ends([]));
    expect(
      valid({
        ...withPlayerLine,
        stats: { ...withPlayerLine.stats, playerStats: { [T1_U1]: {} } },
      }),
    ).toBe(false);
  });

  it('gives a football team line its score only, and no player lines', () => {
    const football = {
      ...game,
      leagueType: FOOTBALL,
      score: { T1: 6, T2: 0 },
      absentRosterPlayerIds: [],
      stats: { teamStats: { T1: { score: 6 }, T2: { score: 0 } }, playerStats: {} },
    };
    expect(valid(football)).toBe(true);
    expect(
      valid({
        ...football,
        stats: {
          ...football.stats,
          teamStats: { T1: { score: 6, timeouts: 0 }, T2: { score: 0 } },
        },
      }),
    ).toBe(false);
    expect(
      valid({ ...football, stats: { ...football.stats, playerStats: { [T1_U1]: { points: 6 } } } }),
    ).toBe(false);
  });

  it('seeds a bye week with its one real team', () => {
    expect(
      valid({
        ...basketball,
        teams: [{ teamId: 'T1' }, { teamId: BYE_TEAM_ID }],
        teamIds: ['T1'],
        score: { T1: 0 },
        absentRosterPlayerIds: [],
        stats: { teamStats: { T1: { score: 0, timeouts: 0 } }, playerStats: {} },
      }),
    ).toBe(true);
  });
});

describe('the finalized record', () => {
  const event = (sequence: number) => ({
    eventId: `e${sequence}`,
    sequence,
    recordedAt: NOW,
    teamId: 'T1',
    playerUserId: 'u1',
    type: 'REBOUND',
  });
  const firstPage = {
    events: [event(1), event(2)],
    pageCount: 1,
    leagueType: BASKETBALL,
    teamIds: ['T1', 'T2'],
    rosterPlayerIds: [T1_U1, T2_U1],
    absentRosterPlayerIds: [T2_U1],
    nonScoringRosterPlayerIds: [T2_U1],
  };
  const page = (doc: object) => GameStatHistoryPageSchema.safeParse(doc).success;

  it('carries the sport, the teams, and the participation snapshot on its first page', () => {
    expect(page(firstPage)).toBe(true);
    expect(GameStatHistoryFirstPageSchema.safeParse(firstPage).success).toBe(true);
    const { teamIds: _teams, ...withoutTeams } = firstPage;
    expect(page(withoutTeams)).toBe(false);
    expect(page({ ...firstPage, rosterPlayerIds: ['u1'] })).toBe(false);
  });

  it('records a game with no events as a first page with none', () => {
    expect(page({ ...firstPage, events: [] })).toBe(true);
  });

  it('continues on later pages that hold events only', () => {
    expect(page({ events: [event(1001)] })).toBe(true);
    expect(page({ events: [] })).toBe(false);
    expect(page({ events: [event(1001)], pageCount: 2 })).toBe(false);
  });

  it('holds its events in sequence order, at most one page size of them', () => {
    expect(page({ ...firstPage, events: [event(2), event(1)] })).toBe(false);
    expect(page({ ...firstPage, events: [event(1), event(1)] })).toBe(false);
    const full = Array.from({ length: STAT_HISTORY_PAGE_SIZE }, (_, index) => event(index + 1));
    expect(page({ ...firstPage, events: full, pageCount: 2 })).toBe(true);
    expect(
      page({ ...firstPage, events: [...full, event(STAT_HISTORY_PAGE_SIZE + 1)], pageCount: 2 }),
    ).toBe(false);
  });

  it('holds only valid stored events', () => {
    expect(page({ ...firstPage, events: [{ ...event(1), type: 'FOUL' }] })).toBe(false);
  });

  it('is bound in the registry to its path', () => {
    expect(COLLECTION_SCHEMAS['sportGames/{gameId}/gameStatHistory/{pageId}']).toBe(
      GameStatHistoryPageSchema,
    );
  });
});

describe('stats operations', () => {
  const run = {
    startedByUserId: 'admin1',
    startedAt: NOW,
    updatedAt: NOW,
    status: 'running',
    counts: { read: 0, changed: 0, skipped: 0 },
  };
  const reason = 'Rebuild after the standings dispute.';

  // One valid operation of every kind.
  const VALID_OPERATIONS = {
    leagueStatsRebuild: {
      ...run,
      kind: 'leagueStatsRebuild',
      scope: { leagueId: 'L' },
      reason,
      stoppedOnGameIds: [],
    },
    lifetimeStatsRebuild: {
      ...run,
      kind: 'lifetimeStatsRebuild',
      scope: {},
      reason,
      stoppedOnGameIds: ['g7'],
    },
    hallOfFameRebuild: {
      ...run,
      kind: 'hallOfFameRebuild',
      scope: { sportKey: 'basketball', userId: 'u1' },
      reason,
      stoppedOnGameIds: [],
    },
    statsValidation: {
      ...run,
      kind: 'statsValidation',
      scope: { leagueId: 'L' },
      phase: 'games',
      resumeAfter: 'g3',
    },
    gameStatsCorrection: {
      ...run,
      kind: 'gameStatsCorrection',
      scope: { gameId: 'g1' },
      reason,
      status: 'complete',
    },
    gameStatsRecalculation: {
      ...run,
      kind: 'gameStatsRecalculation',
      scope: { gameId: 'g1' },
      reason,
    },
    historicalStatsUpdate: {
      ...run,
      kind: 'historicalStatsUpdate',
      scope: { userId: 'u1', sportKey: 'basketball' },
      reason,
    },
    ghostPlayerStats: {
      ...run,
      kind: 'ghostPlayerStats',
      scope: { action: 'link', teamId: 'T1', ghostUserId: 'ghost_1_abc', userId: 'u1' },
      reason,
    },
    gameDeletion: { ...run, kind: 'gameDeletion', scope: { gameId: 'g1' }, status: 'stopped' },
  } satisfies Record<StatsOperationKind, object>;

  const operation = (doc: object) => StatsOperationSchema.safeParse(doc).success;

  it.each(Object.entries(VALID_OPERATIONS))('accepts a %s operation', (_kind, doc) => {
    expect(operation(doc)).toBe(true);
  });

  it("records a ghost's removal on the same operation shape as its link, with no reason", () => {
    const { reason: _linkReason, ...unexplainedLink } = VALID_OPERATIONS.ghostPlayerStats;
    expect(
      operation({
        ...unexplainedLink,
        scope: { action: 'removal', teamId: 'T1', ghostUserId: 'ghost_1_abc' },
      }),
    ).toBe(true);
    // A removal stored while removals still took a reason is read with the reason dropped.
    const stored = StatsOperationSchema.safeParse({
      ...VALID_OPERATIONS.ghostPlayerStats,
      scope: { action: 'removal', teamId: 'T1', ghostUserId: 'ghost_1_abc' },
    });
    expect(stored.success).toBe(true);
    expect(stored.data).not.toHaveProperty('reason');
    expect(
      operation({
        ...unexplainedLink,
        scope: { action: 'removal', teamId: 'T1', ghostUserId: 'ghost_1_abc', userId: 'u1' },
      }),
    ).toBe(false);
    expect(
      operation({
        ...VALID_OPERATIONS.ghostPlayerStats,
        scope: { action: 'link', teamId: 'T1', ghostUserId: 'ghost_1_abc' },
      }),
    ).toBe(false);
  });

  it('takes a reason on every action that writes a stat, and none on a validation', () => {
    const { reason: _reason, ...unexplained } = VALID_OPERATIONS.leagueStatsRebuild;
    expect(operation(unexplained)).toBe(false);
    expect(operation({ ...VALID_OPERATIONS.statsValidation, reason })).toBe(false);
    expect(operation({ ...VALID_OPERATIONS.gameStatsCorrection, reason: 'no' })).toBe(false);
    expect(operation({ ...VALID_OPERATIONS.gameStatsCorrection, reason: '   no   ' })).toBe(false);
  });

  it("a repair callable's reason field takes the one reason atom the repair is stored with", () => {
    expect(ReopenGameInputSchema.shape.reason).toBe(repairReasonSchema);
    expect(StatCorrectionEventSchema.shape.reason).toBe(repairReasonSchema);
    // A ghost removal is not a repair and takes no reason (BACKEND-212), so its operation's reason is
    // optional — and still the one atom when present.
    for (const option of StatsOperationSchema.options) {
      if (!('reason' in option.shape)) continue;
      const reason = option.shape.reason;
      expect(reason instanceof z.ZodOptional ? reason.unwrap() : reason).toBe(repairReasonSchema);
    }
  });

  it('scopes a validation to one game, one league, or everything', () => {
    expect(operation({ ...VALID_OPERATIONS.statsValidation, scope: {} })).toBe(true);
    expect(operation({ ...VALID_OPERATIONS.statsValidation, scope: { gameId: 'g1' } })).toBe(true);
    expect(
      operation({ ...VALID_OPERATIONS.statsValidation, scope: { gameId: 'g1', leagueId: 'L' } }),
    ).toBe(false);
    expect(operation({ ...VALID_OPERATIONS.statsValidation, phase: 'aggregates' })).toBe(false);
  });

  it('refuses an unknown kind or status, and a count below zero', () => {
    expect(operation({ ...VALID_OPERATIONS.gameDeletion, kind: 'gameArchive' })).toBe(false);
    expect(operation({ ...VALID_OPERATIONS.gameDeletion, status: 'paused' })).toBe(false);
    expect(
      operation({ ...VALID_OPERATIONS.gameDeletion, counts: { read: -1, changed: 0, skipped: 0 } }),
    ).toBe(false);
  });

  it('is bound in the registry to its path', () => {
    expect(COLLECTION_SCHEMAS['statsOperations/{operationId}']).toBe(StatsOperationSchema);
  });
});

describe('aggregate lines', () => {
  const baseSeason = {
    gamesPlayed: 6,
    wins: 4,
    losses: 1,
    ties: 1,
    pointsFor: 320,
    pointsAgainst: 290,
  };
  const basketballRow = {
    gamesPlayed: 6,
    points: 84,
    rebounds: 30,
    assists: 12,
    fantasyPoints: 153,
  };

  it("stores a team season line with the standings base, and basketball's rebounds and assists", () => {
    expect(TeamSeasonStatsSchema.safeParse(baseSeason).success).toBe(true);
    expect(
      TeamSeasonStatsSchema.safeParse({ ...baseSeason, rebounds: 180, assists: 70 }).success,
    ).toBe(true);
    expect(TeamSeasonStatsSchema.safeParse({ ...baseSeason, rebounds: 180 }).success).toBe(false);
  });

  it('stores no derived or unread field on a season line', () => {
    expect(TeamSeasonStatsSchema.safeParse({ ...baseSeason, pointDifferential: 30 }).success).toBe(
      false,
    );
    expect(
      TeamSeasonStatsSchema.safeParse({ ...baseSeason, lastGameId: 'recalculated' }).success,
    ).toBe(false);
    expect(TeamSeasonStatsSchema.safeParse({ ...baseSeason, lastUpdatedAt: NOW }).success).toBe(
      false,
    );
    expect(
      TeamSeasonStatsSchema.safeParse({
        ...baseSeason,
        rebounds: 180,
        assists: 70,
        fantasyPoints: 1,
      }).success,
    ).toBe(false);
  });

  it('stores a membership row as a basketball line with fantasy points, or games played alone', () => {
    expect(PlayerSeasonStatsSchema.safeParse(basketballRow).success).toBe(true);
    expect(PlayerSeasonStatsSchema.safeParse({ gamesPlayed: 5 }).success).toBe(true);
    const { fantasyPoints: _fp, ...withoutFantasyPoints } = basketballRow;
    expect(PlayerSeasonStatsSchema.safeParse(withoutFantasyPoints).success).toBe(false);
    expect(
      PlayerSeasonStatsSchema.safeParse({ gamesPlayed: 5, displayName: 'Pat', fouls: 2 }).success,
    ).toBe(false);
    expect(PlayerSeasonStatsSchema.safeParse({ gamesPlayed: -1 }).success).toBe(false);
  });

  it('stores a basketball totals line as the game line plus games played, and nothing else', () => {
    const { gamesPlayed: _gamesPlayed, ...gameLine } = basketballRow;
    expect(BasketballPlayerStatsSchema.safeParse(gameLine).success).toBe(true);
    expect(BasketballPlayerTotalsSchema.safeParse(basketballRow).success).toBe(true);
    expect(BasketballPlayerTotalsSchema.safeParse(gameLine).success).toBe(false);
    expect(BasketballPlayerTotalsSchema.safeParse({ ...basketballRow, fouls: 2 }).success).toBe(
      false,
    );
    expect(Object.keys(BasketballPlayerTotalsSchema.shape).sort()).toEqual(
      [...Object.keys(BasketballPlayerStatsSchema.shape), 'gamesPlayed'].sort(),
    );
  });

  it('carries both on the team document, the rows keyed by person', () => {
    const { seasonStats, playerSeasonStats } = LeagueTeamSchema.shape;
    expect(seasonStats.safeParse({ ...baseSeason, rebounds: 180, assists: 70 }).success).toBe(true);
    expect(seasonStats.safeParse(undefined).success).toBe(true);
    expect(
      playerSeasonStats.safeParse({
        u1: basketballRow,
        ghost_1_abc: { ...basketballRow, gamesPlayed: 2 },
      }).success,
    ).toBe(true);
    expect(playerSeasonStats.safeParse({ u1: { gamesPlayed: 1, points: 3 } }).success).toBe(false);
  });

  it('keeps a lifetime line per sport a real player played, and no career summary beside it', () => {
    const { lifetimeStats } = UserProfileSchema.shape;
    expect(
      lifetimeStats.safeParse({ basketball: basketballRow, football: { gamesPlayed: 3 } }).success,
    ).toBe(true);
    expect(lifetimeStats.safeParse({ curling: { gamesPlayed: 0 } }).success).toBe(true);
    expect(UserProfileSchema.shape).not.toHaveProperty('stats');
    expect(lifetimeStats.safeParse({ hockey: { gamesPlayed: 1 } }).success).toBe(false);
    expect(lifetimeStats.safeParse({ curling: { gamesPlayed: 2, points: 4 } }).success).toBe(false);
    const { fantasyPoints: _fp, ...withoutFantasyPoints } = basketballRow;
    expect(lifetimeStats.safeParse({ basketball: withoutFantasyPoints }).success).toBe(false);
  });

  it('keeps hall-of-fame entries as basketball lines with fantasy points', () => {
    expect(
      SportHallOfFameSchema.safeParse({ playerStats: { u1: basketballRow }, updatedAt: NOW })
        .success,
    ).toBe(true);
    const { fantasyPoints: _fp, ...withoutFantasyPoints } = basketballRow;
    expect(
      SportHallOfFameSchema.safeParse({ playerStats: { u1: withoutFantasyPoints }, updatedAt: NOW })
        .success,
    ).toBe(false);
  });
});

describe("each sport's line schemas, declared once", () => {
  it("builds a lifetime field for every sport key from that sport's lifetime line schema", () => {
    expect(Object.keys(UserLifetimeStatsSchema.shape).sort()).toEqual([...SPORT_KEYS].sort());
    for (const leagueType of LEAGUE_TYPE_KEYS) {
      const field = UserLifetimeStatsSchema.shape[SPORT_KEY_BY_LEAGUE_TYPE[leagueType]];
      expect(field.unwrap()).toBe(SPORT_LINE_SCHEMAS[leagueType].lifetime);
    }
  });

  it("builds the membership row and the season line from each sport's own line schemas", () => {
    for (const leagueType of LEAGUE_TYPE_KEYS) {
      expect(PlayerSeasonStatsSchema.options).toContain(
        SPORT_LINE_SCHEMAS[leagueType].membershipRow,
      );
      expect(TeamSeasonStatsSchema.options).toContain(SPORT_LINE_SCHEMAS[leagueType].teamSeason);
    }
  });

  it("builds the hall-of-fame entry from each sport's own hall-of-fame schema, which is never for a sport with no hall of fame", () => {
    const entry = SportHallOfFameSchema.shape.playerStats.valueType;
    for (const leagueType of LEAGUE_TYPE_KEYS) {
      expect(entry.options).toContain(SPORT_LINE_SCHEMAS[leagueType].hallOfFame);
    }
    expect(entry.safeParse({ gamesPlayed: 3 }).success).toBe(false);
  });
});
