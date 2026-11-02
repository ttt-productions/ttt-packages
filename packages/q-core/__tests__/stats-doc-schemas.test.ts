import { describe, it, expect } from 'vitest';
import { CURLING_ROUND_COUNT, MAX_CURLING_ROUND_POINTS } from '../src/constants/sports.js';
import { MAX_STAT_EVENTS_PER_GAME } from '../src/constants/business.js';
import {
  BasketballPlayerStatsSchema,
  GameStatEventSchema,
  StatCorrectionEventSchema,
  type GameStatEventType,
} from '../src/doc-schemas/game-stats.js';
import {
  BasketballPlayerTotalsSchema,
  SPORT_LINE_SCHEMAS,
  SportHallOfFameSchema,
  UserLifetimeStatsSchema,
} from '../src/doc-schemas/aggregate-stats.js';
import { COLLECTION_SCHEMAS } from '../src/doc-schemas/registry.js';
import { GameStatHistoryRecordSchema } from '../src/doc-schemas/game-stat-history.js';
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

  it('reads no player on a team-attributed event, with no sentinel standing in for one', () => {
    for (const event of [
      VALID_EVENTS.TIMEOUT,
      VALID_EVENTS.CURLING_ROUND_SCORE,
      VALID_EVENTS.FOOTBALL_6PT,
    ]) {
      expect(GameStatEventSchema.parse({ ...event, playerUserId: 'team_timeout' })).toEqual(event);
    }
  });

  it('reads no assister anywhere but a two- or three-point shot, and refuses a snapshot with no assister', () => {
    expect(GameStatEventSchema.parse({ ...VALID_EVENTS['1PT'], assistedByUserId: 'u2' })).toEqual(
      VALID_EVENTS['1PT'],
    );
    expect(GameStatEventSchema.parse({ ...VALID_EVENTS.REBOUND, assistedByUserId: 'u2' })).toEqual(
      VALID_EVENTS.REBOUND,
    );
    expect(parses({ ...VALID_EVENTS['3PT'], assistedByDisplayNameSnapshot: 'Sam' })).toBe(false);
  });

  it('requires a player on every player-attributed event, and a team on every team event', () => {
    expect(parses({ ...recorded, teamId: 'T1', type: 'REBOUND' })).toBe(false);
    expect(parses({ ...recorded, playerUserId: 'u1', type: '2PT' })).toBe(false);
    expect(parses({ ...recorded, type: 'FOOTBALL_1PT' })).toBe(false);
    expect(
      GameStatEventSchema.parse({ ...VALID_EVENTS.CURLING_ROUND_BLANK, teamId: 'T1' }),
    ).toEqual(VALID_EVENTS.CURLING_ROUND_BLANK);
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
    expect(GameStatEventSchema.parse({ ...voidOf('e0'), teamId: 'T1' })).toEqual(voidOf('e0'));
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
    expect(SportGameSchema.parse(withStats({ statHistory: [] })).stats).toEqual(basketball.stats);
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

  it('counts its events, and reads no operation hold', () => {
    const { statEventSequence: _sequence, ...uncounted } = basketball;
    expect(valid(uncounted)).toBe(false);
    expect(SportGameSchema.parse({ ...basketball, statsOperationId: 'op1' })).not.toHaveProperty(
      'statsOperationId',
    );
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
      SportGameSchema.parse({
        ...football,
        stats: {
          ...football.stats,
          teamStats: { T1: { score: 6, timeouts: 0 }, T2: { score: 0 } },
        },
      }).stats,
    ).toEqual(football.stats);
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
  const record = {
    events: [event(1), event(2)],
    leagueType: BASKETBALL,
    teamIds: ['T1', 'T2'],
    rosterPlayerIds: [T1_U1, T2_U1],
    absentRosterPlayerIds: [T2_U1],
    nonScoringRosterPlayerIds: [T2_U1],
  };
  const accepts = (doc: object) => GameStatHistoryRecordSchema.safeParse(doc).success;

  it('carries the sport, the teams, and the participation snapshot with its events', () => {
    expect(accepts(record)).toBe(true);
    const { teamIds: _teams, ...withoutTeams } = record;
    expect(accepts(withoutTeams)).toBe(false);
    const { leagueType: _sport, ...withoutSport } = record;
    expect(accepts(withoutSport)).toBe(false);
    expect(accepts({ ...record, rosterPlayerIds: ['u1'] })).toBe(false);
  });

  it('drops a field it does not declare, a page count included', () => {
    expect(GameStatHistoryRecordSchema.parse({ ...record, pageCount: 1 })).toEqual(record);
  });

  it('records a game with no events', () => {
    expect(accepts({ ...record, events: [] })).toBe(true);
  });

  it('holds its events in sequence order, at most the live event cap of them', () => {
    expect(accepts({ ...record, events: [event(2), event(1)] })).toBe(false);
    expect(accepts({ ...record, events: [event(1), event(1)] })).toBe(false);
    const full = Array.from({ length: MAX_STAT_EVENTS_PER_GAME }, (_, index) => event(index + 1));
    expect(accepts({ ...record, events: full })).toBe(true);
    expect(accepts({ ...record, events: [...full, event(MAX_STAT_EVENTS_PER_GAME + 1)] })).toBe(
      false,
    );
  });

  it('holds only valid stored events', () => {
    expect(accepts({ ...record, events: [{ ...event(1), type: 'FOUL' }] })).toBe(false);
  });

  it('is bound in the registry to its one document', () => {
    expect(COLLECTION_SCHEMAS['sportGames/{gameId}/gameStatHistory/record']).toBe(
      GameStatHistoryRecordSchema,
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

  const VALID_OPERATIONS = {
    leagueStatsRebuild: {
      ...run,
      kind: 'leagueStatsRebuild',
      scope: { leagueId: 'L' },
      reason,
    },
    lifetimeStatsRebuild: {
      ...run,
      kind: 'lifetimeStatsRebuild',
      scope: {},
      reason,
    },
    hallOfFameRebuild: {
      ...run,
      kind: 'hallOfFameRebuild',
      scope: { sportKey: 'basketball', userId: 'u1' },
      reason,
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
  } satisfies Record<StatsOperationKind, object>;

  const operation = (doc: object) => StatsOperationSchema.safeParse(doc).success;

  it.each(Object.entries(VALID_OPERATIONS))('accepts a %s operation', (_kind, doc) => {
    expect(operation(doc)).toBe(true);
  });

  it('takes a reason on every action that writes a stat, and none on a validation', () => {
    const { reason: _reason, ...unexplained } = VALID_OPERATIONS.leagueStatsRebuild;
    expect(operation(unexplained)).toBe(false);
    expect(
      StatsOperationSchema.parse({ ...VALID_OPERATIONS.statsValidation, reason }),
    ).not.toHaveProperty('reason');
    expect(operation({ ...VALID_OPERATIONS.gameStatsCorrection, reason: 'no' })).toBe(false);
    expect(operation({ ...VALID_OPERATIONS.gameStatsCorrection, reason: '   no   ' })).toBe(false);
  });

  it("a repair callable's reason field takes the one reason atom the repair is stored with", () => {
    expect(ReopenGameInputSchema.shape.reason).toBe(repairReasonSchema);
    expect(StatCorrectionEventSchema.shape.reason).toBe(repairReasonSchema);
    for (const option of StatsOperationSchema.options) {
      if (!('reason' in option.shape)) continue;
      expect(option.shape.reason).toBe(repairReasonSchema);
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
    const rebuild = VALID_OPERATIONS.leagueStatsRebuild;
    expect(operation({ ...rebuild, kind: 'gameArchive' })).toBe(false);
    expect(operation({ ...rebuild, kind: 'ghostPlayerStats' })).toBe(false);
    expect(operation({ ...rebuild, kind: 'gameDeletion' })).toBe(false);
    expect(operation({ ...rebuild, status: 'paused' })).toBe(false);
    expect(operation({ ...rebuild, counts: { read: -1, changed: 0, skipped: 0 } })).toBe(false);
    expect(StatsOperationSchema.parse({ ...rebuild, stoppedOnGameIds: [] })).not.toHaveProperty(
      'stoppedOnGameIds',
    );
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

  const teamOf = (leagueType: string, lines: object) => ({
    name: 'Hoopers',
    icon: 'Shield',
    leagueType,
    leagueId: 'league-1',
    createdByUserId: 'u1',
    createdAt: NOW,
    updatedAt: NOW,
    ...lines,
  });
  const hallOf = (leagueType: string, playerStats: object) => ({
    leagueType,
    playerStats,
    updatedAt: NOW,
  });
  const team = (leagueType: string, lines: object) =>
    LeagueTeamSchema.safeParse(teamOf(leagueType, lines)).success;
  const hall = (leagueType: string, playerStats: object) =>
    SportHallOfFameSchema.safeParse(hallOf(leagueType, playerStats)).success;
  const { fantasyPoints: _fp, ...withoutFantasyPoints } = basketballRow;

  it("stores a team season line with the standings base, and basketball's rebounds and assists", () => {
    expect(team(BASKETBALL, { seasonStats: { ...baseSeason, rebounds: 180, assists: 70 } })).toBe(
      true,
    );
    expect(team(CURLING, { seasonStats: baseSeason })).toBe(true);
    expect(team(BASKETBALL, { seasonStats: baseSeason })).toBe(false);
  });

  it("reads a team's lines by the sport it stores, so a damaged line is refused, never read as another sport's", () => {
    expect(team(BASKETBALL, { seasonStats: { ...baseSeason, rebounds: 180 } })).toBe(false);
    expect(team(BASKETBALL, { playerSeasonStats: { u1: withoutFantasyPoints } })).toBe(false);
    const { leagueType: _sport, ...withoutSport } = teamOf(BASKETBALL, { seasonStats: baseSeason });
    expect(LeagueTeamSchema.safeParse(withoutSport).success).toBe(false);
    expect(team('Hockey', {})).toBe(false);
  });

  it('stores no derived or unread field on a season line', () => {
    for (const extra of [
      { pointDifferential: 30 },
      { lastGameId: 'recalculated' },
      { lastUpdatedAt: NOW },
    ]) {
      expect(SPORT_LINE_SCHEMAS.Curling.teamSeason.parse({ ...baseSeason, ...extra })).toEqual(
        baseSeason,
      );
    }
    expect(
      SPORT_LINE_SCHEMAS.Basketball.teamSeason.parse({
        ...baseSeason,
        rebounds: 180,
        assists: 70,
        fantasyPoints: 1,
      }),
    ).toEqual({ ...baseSeason, rebounds: 180, assists: 70 });
    expect(
      LeagueTeamSchema.parse(teamOf(CURLING, { seasonStats: { ...baseSeason, rebounds: 1 } })),
    ).toMatchObject({ seasonStats: baseSeason });
  });

  it('stores a membership row as a basketball line with fantasy points, or games played alone', () => {
    const row = (leagueType: string, line: object) =>
      team(leagueType, { playerSeasonStats: { u1: line } });
    expect(row(BASKETBALL, basketballRow)).toBe(true);
    expect(row(FOOTBALL, { gamesPlayed: 5 })).toBe(true);
    expect(row(BASKETBALL, { gamesPlayed: 5 })).toBe(false);
    expect(row(FOOTBALL, { gamesPlayed: -1 })).toBe(false);
    expect(
      SPORT_LINE_SCHEMAS.Football.membershipRow.parse({
        gamesPlayed: 5,
        displayName: 'Pat',
        fouls: 2,
      }),
    ).toEqual({ gamesPlayed: 5 });
  });

  it('stores a basketball totals line as the game line plus games played, and nothing else', () => {
    const { gamesPlayed: _gamesPlayed, ...gameLine } = basketballRow;
    expect(BasketballPlayerStatsSchema.safeParse(gameLine).success).toBe(true);
    expect(BasketballPlayerTotalsSchema.safeParse(basketballRow).success).toBe(true);
    expect(BasketballPlayerTotalsSchema.safeParse(gameLine).success).toBe(false);
    expect(BasketballPlayerTotalsSchema.parse({ ...basketballRow, fouls: 2 })).toEqual(
      basketballRow,
    );
    expect(Object.keys(BasketballPlayerTotalsSchema.shape).sort()).toEqual(
      [...Object.keys(BasketballPlayerStatsSchema.shape), 'gamesPlayed'].sort(),
    );
  });

  it('carries both on the team document, the rows keyed by person', () => {
    expect(team(BASKETBALL, {})).toBe(true);
    expect(
      team(BASKETBALL, {
        playerSeasonStats: { u1: basketballRow, ghost_1_abc: { ...basketballRow, gamesPlayed: 2 } },
      }),
    ).toBe(true);
    expect(
      LeagueTeamSchema.parse(
        teamOf(CURLING, { playerSeasonStats: { u1: { gamesPlayed: 1, points: 3 } } }),
      ),
    ).toMatchObject({ playerSeasonStats: { u1: { gamesPlayed: 1 } } });
  });

  it('keeps a lifetime line per sport a real player played, and no career summary beside it', () => {
    const { lifetimeStats } = UserProfileSchema.shape;
    expect(
      lifetimeStats.safeParse({ basketball: basketballRow, football: { gamesPlayed: 3 } }).success,
    ).toBe(true);
    expect(lifetimeStats.safeParse({ curling: { gamesPlayed: 0 } }).success).toBe(true);
    expect(UserProfileSchema.shape).not.toHaveProperty('stats');
    expect(lifetimeStats.parse({ hockey: { gamesPlayed: 1 } })).toEqual({});
    expect(lifetimeStats.parse({ curling: { gamesPlayed: 2, points: 4 } })).toEqual({
      curling: { gamesPlayed: 2 },
    });
    expect(lifetimeStats.safeParse({ basketball: withoutFantasyPoints }).success).toBe(false);
  });

  it('keeps hall-of-fame entries as basketball lines with fantasy points, under the sport the document stores', () => {
    expect(hall(BASKETBALL, { u1: basketballRow })).toBe(true);
    expect(hall(BASKETBALL, { u1: withoutFantasyPoints })).toBe(false);
    const { leagueType: _sport, ...withoutSport } = hallOf(BASKETBALL, { u1: basketballRow });
    expect(SportHallOfFameSchema.safeParse(withoutSport).success).toBe(false);
  });

  it('holds no entry for a sport with no hall-of-fame line', () => {
    for (const leagueType of [CURLING, FOOTBALL]) {
      expect(hall(leagueType, {})).toBe(true);
      expect(hall(leagueType, { u1: { gamesPlayed: 3 } })).toBe(false);
    }
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

  it("gives every sport one team option, its season line and membership rows from that sport's own line schemas", () => {
    expect(LeagueTeamSchema.options.map((option) => option.shape.leagueType.value)).toEqual([
      ...LEAGUE_TYPE_KEYS,
    ]);
    for (const option of LeagueTeamSchema.options) {
      const lines = SPORT_LINE_SCHEMAS[option.shape.leagueType.value];
      expect(option.shape.seasonStats.unwrap()).toBe(lines.teamSeason);
      expect(option.shape.playerSeasonStats.unwrap().valueType).toBe(lines.membershipRow);
    }
  });

  it("gives every sport one hall-of-fame option, its entries from that sport's own hall-of-fame schema", () => {
    expect(SportHallOfFameSchema.options.map((option) => option.shape.leagueType.value)).toEqual([
      ...LEAGUE_TYPE_KEYS,
    ]);
    for (const option of SportHallOfFameSchema.options) {
      expect(option.shape.playerStats.valueType).toBe(
        SPORT_LINE_SCHEMAS[option.shape.leagueType.value].hallOfFame,
      );
    }
  });
});
