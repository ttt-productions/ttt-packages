import { describe, it, expect } from 'vitest';
import {
  BASKETBALL_FANTASY_POINT_WEIGHTS,
  CURLING_ROUND_COUNT,
  FINALIZATION_NOT_READY_COPY,
  MAX_CURLING_ROUND_POINTS,
  STAT_EVENT_REFUSAL_COPY,
} from '../src/constants/sports.js';
import type { GameStatEvent } from '../src/doc-schemas/game-stats.js';
import type { GameStats } from '../src/doc-schemas/sport-game.js';
import { buildGameRosterPlayerId } from '../src/ids/compound-ids.js';
import {
  buildStatCorrectionId,
  buildStatEventId,
  buildStatVoidId,
} from '../src/ids/stat-event-ids.js';
import { SPORT_ADAPTER_LIST, getSportAdapter } from '../src/sports/registry.js';
import { basketballFantasyPoints } from '../src/sports/basketball-scoring.js';
import { gameScoreMirror } from '../src/sports/score-mirror.js';
import { replayGameStats } from '../src/sports/replay.js';
import { VOID_PLAY_DESCRIPTION } from '../src/sports/scoring-display.js';
import { type AnySportAdapter } from '../src/sports/sport-adapter.js';
import { type StatEventBody, type StatEventRoster } from '../src/sports/scoring.js';
import {
  BASKETBALL_ASSISTABLE_SHOT_EVENT_TYPE_KEYS,
  BASKETBALL_ASSIST_EVENT_TYPE,
  BASKETBALL_BULK_EDIT_EVENT_TYPE,
  BASKETBALL_ONE_POINT_EVENT_TYPE,
  BASKETBALL_PLAYER_STAT_KEYS,
  BASKETBALL_REBOUND_EVENT_TYPE,
  BASKETBALL_STAT_EVENT_TYPE_KEYS,
  BASKETBALL_TIMEOUT_EVENT_TYPE,
  CURLING_ROUND_BLANK_EVENT_TYPE,
  CURLING_ROUND_SCORE_EVENT_TYPE,
  CURLING_STAT_EVENT_TYPE_KEYS,
  FOOTBALL_BULK_EDIT_EVENT_TYPE,
  FOOTBALL_SCORE_EVENT_TYPE_KEYS,
  FOOTBALL_STAT_EVENT_TYPE_KEYS,
  LEAGUE_TYPE_KEYS,
} from '../src/types/sports.js';
import {
  FINALIZATION_NOT_READY_KEYS,
  PLAYER_STAT_LINE_KIND_KEYS,
  STAT_CORRECTION_EVENT_TYPE,
  STAT_EVENT_REFUSAL_KEYS,
  STAT_LINE_KIND_KEYS,
  STAT_VOID_EVENT_TYPE,
  TEAM_STAT_LINE_KIND_KEYS,
} from '../src/types/stats.js';
import { anyInstanceOf } from '../../../test/matchers.js';

const NOW = 1712345678901;
const [BASKETBALL, CURLING, FOOTBALL] = LEAGUE_TYPE_KEYS;
const [TWO_POINTER, THREE_POINTER] = BASKETBALL_ASSISTABLE_SHOT_EVENT_TYPE_KEYS;
const [SIX, TWO, ONE] = FOOTBALL_SCORE_EVENT_TYPE_KEYS;
const [POINTS, REBOUNDS, ASSISTS] = BASKETBALL_PLAYER_STAT_KEYS;

const HOME = 'team-home';
const AWAY = 'team-away';
const SHOOTER = 'shooter';
const PASSER = 'passer';
const TWO_SIDED = 'two-sided';
const GAME = { teamIds: [HOME, AWAY] };

const basketball = getSportAdapter(BASKETBALL);
const curling = getSportAdapter(CURLING);
const football = getSportAdapter(FOOTBALL);

const entry = (teamId: string, userId: string) => buildGameRosterPlayerId(teamId, userId);
const ROSTER: StatEventRoster = {
  teamIds: GAME.teamIds,
  rosterPlayerIds: new Set([
    entry(HOME, SHOOTER),
    entry(HOME, PASSER),
    entry(HOME, TWO_SIDED),
    entry(AWAY, TWO_SIDED),
  ]),
};

const event = (body: Record<string, unknown>): StatEventBody =>
  ({ recordedAt: NOW, ...body }) as unknown as StatEventBody;
const player = (type: string, userId: string, extra: Record<string, unknown> = {}) =>
  event({ type, teamId: HOME, playerUserId: userId, ...extra });
const round = (roundNumber: number, teamId?: string, points?: number) =>
  teamId === undefined
    ? event({ type: CURLING_ROUND_BLANK_EVENT_TYPE, roundNumber })
    : event({ type: CURLING_ROUND_SCORE_EVENT_TYPE, teamId, roundNumber, points });

/** A stored event: the body with its id and its place in the replay, in the order stored. */
let sequence = 0;
function stored(body: StatEventBody, eventId?: string): GameStatEvent {
  sequence += 1;
  return {
    ...body,
    eventId: eventId ?? buildStatEventId(NOW, `e${sequence}`),
    sequence,
  } as unknown as GameStatEvent;
}

function applyAll(
  adapter: AnySportAdapter,
  state: GameStats,
  events: readonly StatEventBody[],
): GameStats {
  return events.reduce((next, body) => adapter.apply(next, body), state);
}

describe('every sport — apply and undo are exact inverses (SPORT-103)', () => {
  const cases: [string, AnySportAdapter, GameStats, StatEventBody[]][] = [
    [
      BASKETBALL,
      basketball,
      applyAll(basketball, basketball.emptyStats(GAME), [
        player(BASKETBALL_REBOUND_EVENT_TYPE, PASSER),
      ]),
      [
        player(BASKETBALL_ONE_POINT_EVENT_TYPE, SHOOTER),
        player(TWO_POINTER, SHOOTER, { assistedByUserId: PASSER }),
        player(THREE_POINTER, SHOOTER),
        player(BASKETBALL_REBOUND_EVENT_TYPE, SHOOTER),
        player(BASKETBALL_ASSIST_EVENT_TYPE, SHOOTER),
        event({ type: BASKETBALL_TIMEOUT_EVENT_TYPE, teamId: AWAY }),
        player(BASKETBALL_BULK_EDIT_EVENT_TYPE, PASSER, {
          stat: REBOUNDS,
          value: 3,
          previousValue: 1,
        }),
      ],
    ],
    [
      CURLING,
      curling,
      applyAll(curling, curling.emptyStats(GAME), [round(1, HOME, 2)]),
      [round(2, AWAY, MAX_CURLING_ROUND_POINTS), round(2)],
    ],
    [
      FOOTBALL,
      football,
      football.emptyStats(GAME),
      [
        event({ type: SIX, teamId: HOME }),
        event({ type: TWO, teamId: AWAY }),
        event({ type: ONE, teamId: HOME }),
        event({ type: FOOTBALL_BULK_EDIT_EVENT_TYPE, teamId: AWAY, value: 5, previousValue: 0 }),
      ],
    ],
  ];

  for (const [sport, adapter, before, events] of cases) {
    it(`undoes each ${sport} event back to the state before it`, () => {
      for (const body of events) {
        expect(adapter.undo(adapter.apply(before, body), body)).toEqual(before);
      }
    });
  }

  it('declares an apply for every event type each sport lists', () => {
    const covered = new Set(cases.flatMap(([, , , events]) => events.map((body) => body.type)));
    for (const type of [
      ...BASKETBALL_STAT_EVENT_TYPE_KEYS,
      ...FOOTBALL_STAT_EVENT_TYPE_KEYS,
      ...CURLING_STAT_EVENT_TYPE_KEYS,
    ]) {
      expect(covered).toContain(type);
    }
  });
});

describe('basketball — player-scored, with FP on every player line', () => {
  it('credits an assisted shot to the scorer, the assister, and the team on one event', () => {
    const state = basketball.apply(
      basketball.emptyStats(GAME),
      player(THREE_POINTER, SHOOTER, { assistedByUserId: PASSER }),
    );

    expect(state.teamStats[HOME]).toEqual({ score: 3, timeouts: 0 });
    expect(state.playerStats[entry(HOME, SHOOTER)]).toEqual({
      points: 3,
      rebounds: 0,
      assists: 0,
      fantasyPoints: 3,
    });
    expect(state.playerStats[entry(HOME, PASSER)]).toEqual({
      points: 0,
      rebounds: 0,
      assists: 1,
      fantasyPoints: BASKETBALL_FANTASY_POINT_WEIGHTS.assists,
    });
  });

  it("creates a team's first line from its empty line, and drops a player line whose counters return to zero — never a team line", () => {
    const noLines: GameStats = { teamStats: {}, playerStats: {} } as unknown as GameStats;
    const scored = basketball.apply(noLines, player(BASKETBALL_ONE_POINT_EVENT_TYPE, SHOOTER));
    expect(scored.teamStats[HOME]).toEqual({ score: 1, timeouts: 0 });

    const undone = basketball.undo(scored, player(BASKETBALL_ONE_POINT_EVENT_TYPE, SHOOTER));
    expect(undone.playerStats).toEqual({});
    expect(undone.teamStats[HOME]).toEqual({ score: 0, timeouts: 0 });

    const edited = basketball.apply(
      basketball.apply(basketball.emptyStats(GAME), player(BASKETBALL_REBOUND_EVENT_TYPE, PASSER)),
      player(BASKETBALL_BULK_EDIT_EVENT_TYPE, PASSER, {
        stat: REBOUNDS,
        value: -1,
        previousValue: 1,
      }),
    );
    expect(edited.playerStats).toEqual({});
  });

  it('moves the team score with a points bulk edit, and keeps it the sum of its players', () => {
    const state = basketball.apply(
      basketball.emptyStats(GAME),
      player(BASKETBALL_BULK_EDIT_EVENT_TYPE, SHOOTER, {
        stat: POINTS,
        value: 12,
        previousValue: 0,
      }),
    );
    expect(state.teamStats[HOME]?.score).toBe(12);
  });

  it('puts FP on the four player line kinds only, equal to the weighted formula', () => {
    const line = { points: 10, rebounds: 3, assists: 4 };
    for (const kind of PLAYER_STAT_LINE_KIND_KEYS) {
      expect(basketball.deriveLine(kind, line)).toEqual({
        ...line,
        fantasyPoints: basketballFantasyPoints(line),
      });
    }
    expect(basketballFantasyPoints(line)).toBe(10 * 1 + 3 * 1.5 + 4 * 2);
    for (const kind of TEAM_STAT_LINE_KIND_KEYS) {
      expect(basketball.deriveLine(kind, { score: 10, timeouts: 1, fantasyPoints: 9 })).toEqual({
        score: 10,
        timeouts: 1,
      });
    }
  });

  it('applies a correction to exactly its own field, and throws on a field no correction may change', () => {
    const base = basketball.apply(basketball.emptyStats(GAME), player(TWO_POINTER, SHOOTER));
    const correction = (fields: Record<string, unknown>) =>
      event({
        type: STAT_CORRECTION_EVENT_TYPE,
        teamId: HOME,
        value: 2,
        correctionSource: 'admin',
        operationId: 'operation-1',
        reason: 'A basket went unrecorded',
        ...fields,
      });

    const playerCorrected = basketball.apply(
      base,
      correction({ playerUserId: SHOOTER, stat: POINTS }),
    );
    expect(playerCorrected.playerStats[entry(HOME, SHOOTER)]).toMatchObject({
      points: 4,
      fantasyPoints: 4,
    });
    expect(playerCorrected.teamStats[HOME]?.score).toBe(2);

    const teamCorrected = basketball.apply(base, correction({ stat: 'score' }));
    expect(teamCorrected.teamStats[HOME]?.score).toBe(4);

    for (const field of basketball.correctableFields.team) {
      expect(() => basketball.apply(base, correction({ stat: field }))).not.toThrow();
    }
    expect(() =>
      basketball.apply(base, correction({ playerUserId: SHOOTER, stat: 'fantasyPoints' })),
    ).toThrow();
    expect(() => basketball.apply(base, correction({ stat: POINTS }))).toThrow();
  });

  it('refuses each event no real game produces, naming why', () => {
    const state = basketball.apply(
      basketball.emptyStats(GAME),
      player(BASKETBALL_REBOUND_EVENT_TYPE, PASSER),
    );
    const refusals: [StatEventBody, string][] = [
      [event({ type: SIX, teamId: HOME }), 'eventTypeNotInSport'],
      [
        event({
          type: BASKETBALL_ONE_POINT_EVENT_TYPE,
          teamId: 'team-elsewhere',
          playerUserId: SHOOTER,
        }),
        'teamNotInGame',
      ],
      [player(BASKETBALL_ONE_POINT_EVENT_TYPE, 'nobody'), 'playerNotRostered'],
      [player(TWO_POINTER, SHOOTER, { assistedByUserId: 'nobody' }), 'assisterNotRostered'],
      [
        player(BASKETBALL_ONE_POINT_EVENT_TYPE, SHOOTER, { assistedByUserId: PASSER }),
        'assistNotAllowed',
      ],
      [player(TWO_POINTER, SHOOTER, { assistedByUserId: SHOOTER }), 'assistNotAllowed'],
      [
        event({ type: BASKETBALL_TIMEOUT_EVENT_TYPE, teamId: HOME, playerUserId: SHOOTER }),
        'playerNotAllowed',
      ],
      [
        player(BASKETBALL_BULK_EDIT_EVENT_TYPE, PASSER, {
          stat: REBOUNDS,
          value: 0,
          previousValue: 1,
        }),
        'bulkValueInvalid',
      ],
      [
        player(BASKETBALL_BULK_EDIT_EVENT_TYPE, PASSER, {
          stat: REBOUNDS,
          value: 1.5,
          previousValue: 1,
        }),
        'bulkValueInvalid',
      ],
      [
        player(BASKETBALL_BULK_EDIT_EVENT_TYPE, PASSER, {
          stat: REBOUNDS,
          value: -2,
          previousValue: 1,
        }),
        'bulkValueInvalid',
      ],
      [
        player(BASKETBALL_BULK_EDIT_EVENT_TYPE, SHOOTER, {
          stat: POINTS,
          value: -1,
          previousValue: 0,
        }),
        'bulkValueInvalid',
      ],
      [
        player(BASKETBALL_BULK_EDIT_EVENT_TYPE, PASSER, {
          stat: REBOUNDS,
          value: 2,
          previousValue: 0,
        }),
        'bulkStale',
      ],
    ];
    for (const [body, code] of refusals) {
      expect(basketball.validate(state, body, ROSTER), `${body.type} → ${code}`).toEqual({
        ok: false,
        code,
      });
    }
  });

  it("accepts a person rostered on both teams scoring for each side, each on its own side's line", () => {
    const forHome = player(BASKETBALL_ONE_POINT_EVENT_TYPE, TWO_SIDED);
    const forAway = event({ type: TWO_POINTER, teamId: AWAY, playerUserId: TWO_SIDED });
    const state = basketball.emptyStats(GAME);

    expect(basketball.validate(state, forHome, ROSTER)).toEqual({ ok: true });
    expect(basketball.validate(state, forAway, ROSTER)).toEqual({ ok: true });
    const after = applyAll(basketball, state, [forHome, forAway]);
    expect(after.playerStats[entry(HOME, TWO_SIDED)]).toMatchObject({ points: 1 });
    expect(after.playerStats[entry(AWAY, TWO_SIDED)]).toMatchObject({ points: 2 });
    expect(gameScoreMirror(after)).toEqual({ [HOME]: 1, [AWAY]: 2 });
  });

  it('is finalized by hand, played in no rounds', () => {
    expect(basketball.nextRound(basketball.emptyStats(GAME))).toBeNull();
    expect(basketball.finalizationReadiness(basketball.emptyStats(GAME), GAME)).toEqual({
      ready: true,
    });
  });
});

describe('curling — rounds recorded once, in order', () => {
  const recorded = (count: number) =>
    applyAll(
      curling,
      curling.emptyStats(GAME),
      Array.from({ length: count }, (_, index) => round(index + 1)),
    );

  it("records a scored round as the scorer's points and 0 for the other, a blank round as 0 for both, and the score as their sum", () => {
    const state = applyAll(curling, curling.emptyStats(GAME), [
      round(1, HOME, 3),
      round(2),
      round(3, AWAY, 1),
    ]);

    const home = state.teamStats[HOME] as { score: number; roundScores: (number | null)[] };
    const away = state.teamStats[AWAY] as { score: number; roundScores: (number | null)[] };
    expect(home.roundScores.slice(0, 4)).toEqual([3, 0, 0, null]);
    expect(away.roundScores.slice(0, 4)).toEqual([0, 0, 1, null]);
    expect(gameScoreMirror(state)).toEqual({ [HOME]: 3, [AWAY]: 1 });
    expect(state.playerStats).toEqual({});
  });

  it('accepts a round event only for the next unrecorded round, and none once every round is recorded', () => {
    const state = recorded(2);
    expect(curling.validate(state, round(3, HOME, 1), ROSTER)).toEqual({ ok: true });
    expect(curling.validate(state, round(2, HOME, 1), ROSTER)).toEqual({
      ok: false,
      code: 'roundNotNext',
    });
    expect(curling.validate(state, round(4), ROSTER)).toEqual({ ok: false, code: 'roundNotNext' });
    expect(curling.validate(recorded(CURLING_ROUND_COUNT), round(1), ROSTER)).toEqual({
      ok: false,
      code: 'roundsComplete',
    });
    expect(curling.validate(state, round(3, 'team-elsewhere', 1), ROSTER)).toEqual({
      ok: false,
      code: 'teamNotInGame',
    });
    expect(
      curling.validate(
        state,
        event({ type: CURLING_ROUND_BLANK_EVENT_TYPE, roundNumber: 3, playerUserId: SHOOTER }),
        ROSTER,
      ),
    ).toEqual({
      ok: false,
      code: 'playerNotAllowed',
    });
  });

  it('is ready to finalize only with every round recorded, and a voided middle round is the next to record', () => {
    const almost = recorded(CURLING_ROUND_COUNT - 1);
    expect(curling.nextRound(almost)).toBe(CURLING_ROUND_COUNT);
    expect(curling.finalizationReadiness(almost, GAME)).toEqual({
      ready: false,
      reason: 'roundsIncomplete',
    });

    const full = recorded(CURLING_ROUND_COUNT);
    expect(curling.nextRound(full)).toBeNull();
    expect(curling.finalizationReadiness(full, GAME)).toEqual({ ready: true });

    const middleVoided = curling.undo(full, round(5));
    expect(curling.nextRound(middleVoided)).toBe(5);
    expect(curling.finalizationReadiness(middleVoided, GAME)).toEqual({
      ready: false,
      reason: 'roundsIncomplete',
    });
  });

  it('has no correctable field: a correction throws in apply, and every line derives to itself', () => {
    expect(curling.correctableFields).toEqual({ team: [], player: [] });
    expect(() =>
      curling.apply(
        curling.emptyStats(GAME),
        event({
          type: STAT_CORRECTION_EVENT_TYPE,
          teamId: HOME,
          stat: 'score',
          value: 1,
          correctionSource: 'admin',
          operationId: 'op',
          reason: 'wrong end',
        }),
      ),
    ).toThrow();
    expect(curling.deriveLine('teamSeason', { score: 3 })).toEqual({ score: 3 });
  });
});

describe('football — team-scored, finalized by hand', () => {
  it("adds each event's points to its team and refuses a player on any football event", () => {
    const state = applyAll(football, football.emptyStats(GAME), [
      event({ type: SIX, teamId: HOME }),
      event({ type: ONE, teamId: HOME }),
    ]);
    expect(gameScoreMirror(state)).toEqual({ [HOME]: 7, [AWAY]: 0 });

    expect(
      football.validate(state, event({ type: SIX, teamId: HOME, playerUserId: SHOOTER }), ROSTER),
    ).toEqual({
      ok: false,
      code: 'playerNotAllowed',
    });
    expect(
      football.validate(state, event({ type: TWO, teamId: 'team-elsewhere' }), ROSTER),
    ).toEqual({ ok: false, code: 'teamNotInGame' });
  });

  it('refuses a zero, fractional, below-zero, or stale final-score edit', () => {
    const state = football.apply(football.emptyStats(GAME), event({ type: SIX, teamId: HOME }));
    const edit = (value: number, previousValue: number) =>
      event({ type: FOOTBALL_BULK_EDIT_EVENT_TYPE, teamId: HOME, value, previousValue });

    expect(football.validate(state, edit(14, 6), ROSTER)).toEqual({ ok: true });
    expect(football.validate(state, edit(0, 6), ROSTER)).toEqual({
      ok: false,
      code: 'bulkValueInvalid',
    });
    expect(football.validate(state, edit(0.5, 6), ROSTER)).toEqual({
      ok: false,
      code: 'bulkValueInvalid',
    });
    expect(football.validate(state, edit(-7, 6), ROSTER)).toEqual({
      ok: false,
      code: 'bulkValueInvalid',
    });
    expect(football.validate(state, edit(8, 0), ROSTER)).toEqual({ ok: false, code: 'bulkStale' });
  });

  it('corrects its team score, keeps no player line, and is always ready to finalize', () => {
    const corrected = football.apply(
      football.emptyStats(GAME),
      event({
        type: STAT_CORRECTION_EVENT_TYPE,
        teamId: AWAY,
        stat: 'score',
        value: 3,
        correctionSource: 'admin',
        operationId: 'op',
        reason: 'late field goal',
      }),
    );
    expect(gameScoreMirror(corrected)).toEqual({ [HOME]: 0, [AWAY]: 3 });
    expect(corrected.playerStats).toEqual({});
    expect(football.nextRound(corrected)).toBeNull();
    expect(football.finalizationReadiness(corrected, GAME)).toEqual({ ready: true });
  });
});

describe('the replay — one fold from the empty stats, in sequence order (SPORT-101)', () => {
  it('reproduces the rollup a known history was recorded to, voids and corrections included', () => {
    const shot = stored(player(THREE_POINTER, SHOOTER, { assistedByUserId: PASSER }));
    const mistake = stored(player(BASKETBALL_REBOUND_EVENT_TYPE, PASSER));
    const undo = stored(
      event({ type: STAT_VOID_EVENT_TYPE, targetEventId: mistake.eventId }),
      buildStatVoidId(mistake.eventId),
    );
    const correction = stored(
      event({
        type: STAT_CORRECTION_EVENT_TYPE,
        teamId: HOME,
        playerUserId: SHOOTER,
        stat: REBOUNDS,
        value: 2,
        correctionSource: 'migration',
        operationId: 'migration',
        reason: 'The recorded line holds rebounds its events do not explain',
      }),
      buildStatCorrectionId('migration', entry(HOME, SHOOTER), REBOUNDS),
    );
    // Handed out of order: the replay orders by sequence, never by position.
    const replayed = replayGameStats(basketball, GAME, [correction, undo, mistake, shot]);

    expect(replayed.playerStats[entry(HOME, SHOOTER)]).toEqual({
      points: 3,
      rebounds: 2,
      assists: 0,
      fantasyPoints: 6,
    });
    expect(replayed.playerStats[entry(HOME, PASSER)]).toEqual({
      points: 0,
      rebounds: 0,
      assists: 1,
      fantasyPoints: 2,
    });
    expect(gameScoreMirror(replayed)).toEqual({ [HOME]: 3, [AWAY]: 0 });
  });

  it('refuses to fold a void whose target it has not folded before it', () => {
    const orphan = stored(
      event({ type: STAT_VOID_EVENT_TYPE, targetEventId: 'never-recorded' }),
      buildStatVoidId('never-recorded'),
    );
    expect(() => replayGameStats(basketball, GAME, [orphan])).toThrow(/cannot be replayed/);
  });
});

describe('display — every play has a line, and every refusal has copy', () => {
  const resolve = {
    player: (userId: string) => (userId === 'ghost_1_gone' ? 'removed player' : `Player ${userId}`),
    team: (teamId: string) => `Team ${teamId}`,
  };

  it('describes every event type of every sport, a removed ghost included', () => {
    const samples: [AnySportAdapter, StatEventBody][] = [
      [basketball, player(BASKETBALL_ONE_POINT_EVENT_TYPE, 'ghost_1_gone')],
      [basketball, player(TWO_POINTER, SHOOTER, { assistedByUserId: PASSER })],
      [basketball, player(THREE_POINTER, SHOOTER)],
      [basketball, player(BASKETBALL_REBOUND_EVENT_TYPE, SHOOTER)],
      [basketball, player(BASKETBALL_ASSIST_EVENT_TYPE, SHOOTER)],
      [basketball, event({ type: BASKETBALL_TIMEOUT_EVENT_TYPE, teamId: HOME })],
      [basketball, player(BASKETBALL_BULK_EDIT_EVENT_TYPE, SHOOTER, { stat: POINTS, value: -2 })],
      [curling, round(1, HOME, 2)],
      [curling, round(2)],
      [football, event({ type: SIX, teamId: HOME })],
      [football, event({ type: TWO, teamId: HOME })],
      [football, event({ type: ONE, teamId: HOME })],
      [
        football,
        event({ type: FOOTBALL_BULK_EDIT_EVENT_TYPE, teamId: HOME, value: 3, previousValue: 7 }),
      ],
    ];
    for (const [adapter, body] of samples) {
      const line = adapter.display.describeEvent(stored(body), resolve);
      expect(line, body.type).not.toBe('');
      expect(line, body.type).not.toBe(body.type);
    }
    expect(basketball.display.describeEvent(stored(samples[0]![1]), resolve)).toContain(
      'removed player',
    );
    expect(basketball.display.describeEvent(stored(samples[1]![1]), resolve)).toContain(
      `Player ${PASSER}`,
    );
  });

  it("labels a void as an undo and a correction through the sport's field labels, never as a play", () => {
    for (const adapter of SPORT_ADAPTER_LIST) {
      expect(
        adapter.display.describeEvent(
          stored(event({ type: STAT_VOID_EVENT_TYPE, targetEventId: 'e1' })),
          resolve,
        ),
      ).toBe(VOID_PLAY_DESCRIPTION);
    }
    const correction = stored(
      event({
        type: STAT_CORRECTION_EVENT_TYPE,
        teamId: HOME,
        playerUserId: SHOOTER,
        stat: ASSISTS,
        value: 1,
        correctionSource: 'admin',
        operationId: 'op',
        reason: 'missed pass',
      }),
    );
    expect(basketball.display.describeEvent(correction, resolve)).toBe(
      `${basketball.display.fieldLabels.player.assists} corrected by +1 for Player ${SHOOTER} (Team ${HOME})`,
    );
  });

  it('declares a label for every event type and every counter of each sport', () => {
    for (const adapter of SPORT_ADAPTER_LIST) {
      for (const type of adapter.eventTypes)
        expect(adapter.display.eventLabels[type as never]).toBeDefined();
      for (const key of adapter.teamStatKeys)
        expect(adapter.display.fieldLabels.team[key as never]).toBeDefined();
      for (const key of adapter.playerStatKeys)
        expect(adapter.display.fieldLabels.player[key as never]).toBeDefined();
    }
  });

  it('shows the scoreboard each sport declares: the jump-ball marker on basketball alone, the round grid on curling alone', () => {
    const state = basketball.apply(
      basketball.emptyStats(GAME),
      player(TWO_POINTER, SHOOTER, { assistedByUserId: PASSER }),
    );
    const values = basketball.display.scoreboard.figures.map((figure) =>
      figure.value(
        state.teamStats[HOME]!,
        Object.entries(state.playerStats).map(([, line]) => line),
      ),
    );
    expect(values).toEqual([2, 0, 1, 0]);
    expect(SPORT_ADAPTER_LIST.filter((adapter) => adapter.display.scoreboard.jumpBall)).toEqual([
      basketball,
    ]);
    expect(
      SPORT_ADAPTER_LIST.filter((adapter) => adapter.display.scoreboard.roundSlots !== undefined),
    ).toEqual([curling]);
    expect(curling.display.rounds).toEqual({
      count: CURLING_ROUND_COUNT,
      label: anyInstanceOf(String),
    });
  });

  it('holds scorekeeper copy for every refusal and every not-ready reason', () => {
    for (const code of STAT_EVENT_REFUSAL_KEYS) expect(STAT_EVENT_REFUSAL_COPY[code]).toMatch(/\S/);
    for (const reason of FINALIZATION_NOT_READY_KEYS)
      expect(FINALIZATION_NOT_READY_COPY[reason]).toMatch(/\S/);
  });
});

describe('the replay of a known history, per sport (SPORT-101)', () => {
  it('reproduces a curling history — a re-scored end voided and recorded blank — from its events alone', () => {
    const first = stored(round(1, HOME, 2));
    const mistaken = stored(round(2, AWAY, 1));
    const undo = stored(
      event({ type: STAT_VOID_EVENT_TYPE, targetEventId: mistaken.eventId }),
      buildStatVoidId(mistaken.eventId),
    );
    const blank = stored(round(2));
    const third = stored(round(3, HOME, 3));
    // Handed out of order: the replay orders by sequence, never by position.
    const replayed = replayGameStats(curling, GAME, [third, blank, undo, mistaken, first]);

    // End 1 to the home side for 2, end 2 blank for both, end 3 to the home side for 3; the rest unrecorded.
    const unrecorded = Array.from({ length: CURLING_ROUND_COUNT - 3 }, () => null);
    expect(replayed.teamStats[HOME]).toEqual({ score: 5, roundScores: [2, 0, 3, ...unrecorded] });
    expect(replayed.teamStats[AWAY]).toEqual({ score: 0, roundScores: [0, 0, 0, ...unrecorded] });
    expect(replayed.playerStats).toEqual({});
    expect(curling.nextRound(replayed)).toBe(4);
  });

  it('reproduces a football history — a voided safety and a final-score entry — from its events alone', () => {
    const touchdown = stored(event({ type: SIX, teamId: HOME }));
    const extraPoint = stored(event({ type: ONE, teamId: HOME }));
    const safety = stored(event({ type: TWO, teamId: AWAY }));
    const undo = stored(
      event({ type: STAT_VOID_EVENT_TYPE, targetEventId: safety.eventId }),
      buildStatVoidId(safety.eventId),
    );
    // A final-score entry carries the change from the score the form showed: 0 → 3.
    const finalScore = stored(
      event({ type: FOOTBALL_BULK_EDIT_EVENT_TYPE, teamId: AWAY, value: 3, previousValue: 0 }),
    );
    const replayed = replayGameStats(football, GAME, [
      finalScore,
      undo,
      safety,
      extraPoint,
      touchdown,
    ]);

    expect(gameScoreMirror(replayed)).toEqual({ [HOME]: 7, [AWAY]: 3 });
    expect(replayed.playerStats).toEqual({});
  });
});

describe('curling — a fifteenth end', () => {
  const recorded = (count: number) =>
    applyAll(
      curling,
      curling.emptyStats(GAME),
      Array.from({ length: count }, (_, index) => round(index + 1)),
    );

  it('is refused once every end is recorded, and as a skipped end before that', () => {
    const beyond = CURLING_ROUND_COUNT + 1;
    expect(curling.validate(recorded(CURLING_ROUND_COUNT), round(beyond, HOME, 1), ROSTER)).toEqual(
      { ok: false, code: 'roundsComplete' },
    );
    expect(curling.validate(recorded(CURLING_ROUND_COUNT - 1), round(beyond), ROSTER)).toEqual({
      ok: false,
      code: 'roundNotNext',
    });
  });

  it('is never offered: at thirteen ends recorded the next is the fourteenth, and at fourteen there is none', () => {
    expect(curling.nextRound(recorded(CURLING_ROUND_COUNT - 1))).toBe(CURLING_ROUND_COUNT);
    expect(curling.nextRound(recorded(CURLING_ROUND_COUNT))).toBeNull();
  });
});

describe('basketball corrections — each correctable field moves exactly itself', () => {
  const base = applyAll(basketball, basketball.emptyStats(GAME), [
    player(TWO_POINTER, SHOOTER, { assistedByUserId: PASSER }),
    player(BASKETBALL_REBOUND_EVENT_TYPE, SHOOTER),
  ]);
  const correction = (stat: string, value: number, playerUserId?: string) =>
    event({
      type: STAT_CORRECTION_EVENT_TYPE,
      teamId: HOME,
      ...(playerUserId === undefined ? {} : { playerUserId }),
      stat,
      value,
      correctionSource: 'admin',
      operationId: 'operation-1',
      reason: 'The scorer missed a play',
    });

  for (const field of basketball.correctableFields.player) {
    it(`corrects a player's ${field} by its value, FP following, and nothing else on the game`, () => {
      const corrected = basketball.apply(base, correction(field, 3, SHOOTER));
      const before = base.playerStats[entry(HOME, SHOOTER)] as Record<string, number>;
      const counters = {
        points: before.points!,
        rebounds: before.rebounds!,
        assists: before.assists!,
        [field]: before[field]! + 3,
      };
      expect(corrected.playerStats[entry(HOME, SHOOTER)]).toEqual({
        ...counters,
        fantasyPoints: basketballFantasyPoints(counters),
      });
      expect(corrected.playerStats[entry(HOME, PASSER)]).toEqual(
        base.playerStats[entry(HOME, PASSER)],
      );
      expect(corrected.teamStats).toEqual(base.teamStats);
    });
  }

  for (const field of basketball.correctableFields.team) {
    it(`corrects a team's ${field} by its value, and no player line`, () => {
      const corrected = basketball.apply(base, correction(field, 2));
      const before = base.teamStats[HOME] as Record<string, number>;
      expect(corrected.teamStats[HOME]).toEqual({ ...before, [field]: before[field]! + 2 });
      expect(corrected.teamStats[AWAY]).toEqual(base.teamStats[AWAY]);
      expect(corrected.playerStats).toEqual(base.playerStats);
    });
  }
});

describe('deriveLine for a sport with no derived field', () => {
  it.each([
    [CURLING, curling],
    [FOOTBALL, football],
  ] as const)('returns every %s line of every kind exactly as given', (_sport, adapter) => {
    for (const kind of STAT_LINE_KIND_KEYS) {
      const line = { gamesPlayed: 3, score: 12, wins: 2 };
      expect(adapter.deriveLine(kind, line)).toEqual(line);
    }
  });
});

describe('lines the rollup holds, in the team-scored sports', () => {
  it('keeps a team line whose score returns to zero, and never creates a player line', () => {
    const touchdown = event({ type: SIX, teamId: HOME });
    const footballUndone = football.undo(
      football.apply(football.emptyStats(GAME), touchdown),
      touchdown,
    );
    expect(footballUndone.teamStats[HOME]).toEqual({ score: 0 });
    expect(footballUndone.playerStats).toEqual({});

    const end = round(1, HOME, 2);
    const curlingUndone = curling.undo(curling.apply(curling.emptyStats(GAME), end), end);
    expect(curlingUndone.teamStats[HOME]).toEqual(curling.emptyStats(GAME).teamStats[HOME]);
    expect(curlingUndone.playerStats).toEqual({});
  });
});
