// The basketball adapter's scoring, display, and bulk-entry members. Basketball is player-scored: a
// shot credits its scorer's points and its team's score, and — when it names one — its assister's
// assists, all on the one event (SPORT-003).
//
// `apply` and `undo` are one function over an event's effects with opposite signs, so they are exact
// inverses by construction (SPORT-103).

import { z } from 'zod';
import {
  BASKETBALL_FANTASY_POINT_WEIGHTS,
  BASKETBALL_POINTS_BY_EVENT_TYPE,
  MAX_STAT_EVENTS_PER_WRITE,
  NOT_ON_GAME_ROSTER_MESSAGE,
} from '../constants/sports.js';
import type { BasketballPlayerStats, BasketballTeamStats, GameStatEvent } from '../doc-schemas/game-stats.js';
import type { BasketballGameStats, GameStats } from '../doc-schemas/sport-game.js';
import { buildGameRosterPlayerId, parseGameRosterPlayerId } from '../ids/compound-ids.js';
import {
  BASKETBALL_ASSISTABLE_SHOT_EVENT_TYPE_KEYS,
  BASKETBALL_ASSIST_EVENT_TYPE,
  BASKETBALL_BULK_EDIT_EVENT_TYPE,
  BASKETBALL_ONE_POINT_EVENT_TYPE,
  BASKETBALL_PLAYER_STAT_KEYS,
  BASKETBALL_PLAYER_TALLY_EVENT_TYPE_KEYS,
  BASKETBALL_REBOUND_EVENT_TYPE,
  BASKETBALL_SCORE_EVENT_TYPE_KEYS,
  BASKETBALL_STAT_EVENT_TYPE_KEYS,
  BASKETBALL_TEAM_STAT_KEYS,
  BASKETBALL_THREE_POINT_EVENT_TYPE,
  BASKETBALL_TIMEOUT_EVENT_TYPE,
  BASKETBALL_TWO_POINT_EVENT_TYPE,
} from '../types/sports.js';
import type {
  BasketballPlayerStatKey,
  BasketballStatEventType,
  BasketballTeamStatKey,
} from '../types/sports.js';
import { PLAYER_STAT_LINE_KIND_KEYS } from '../types/stats.js';
import type { StatLineKind } from '../types/stats.js';
import {
  BULK_ENTRY_TOO_LARGE_MESSAGE,
  bulkEntryCountField,
  type BulkEntryContext,
  type PlayerLinesBulkEntry,
  type PlayerLinesValues,
  type StatEventDraft,
} from './bulk-entry.js';
import { buildGameContribution, decideParticipation, type ContributionSpec } from './contribution.js';
import {
  FINALIZATION_READY,
  STAT_EVENT_ACCEPTED,
  isAllZeroLine,
  isSportStatEventIn,
  isStatCorrection,
  refuseStatEvent,
  type CorrectableFields,
  type GameTeamLine,
  type SportScoring,
  type SportStatEventBody,
  type StatCorrectionBody,
  type StatEventBody,
  type StatLineValues,
} from './scoring.js';
import {
  describeStoreEvent,
  formatSignedValue,
  type PlayerEventsScoringPanel,
  type Scoreboard,
  type StatEventLabel,
  type StatEventNameResolver,
  type StatFieldLabels,
} from './scoring-display.js';

type BasketballEvent = Extract<SportStatEventBody, { type: BasketballStatEventType }>;
type PlayerCounters = Record<BasketballPlayerStatKey, number>;

function isBasketballEvent(event: StatEventBody | undefined): event is BasketballEvent {
  return isSportStatEventIn(BASKETBALL_STAT_EVENT_TYPE_KEYS, event);
}

// The registry chose this adapter by the game's `leagueType`, so the rollup it is handed is a
// basketball game's (SPORT-002).
function ownStats(state: GameStats): BasketballGameStats {
  return state as BasketballGameStats;
}

function ownTeamLine(line: GameTeamLine): BasketballTeamStats {
  return line as BasketballTeamStats;
}

// ---------------------------------------------------------------------------------------------
// Lines
// ---------------------------------------------------------------------------------------------

/**
 * Fantasy points (FP) of a basketball line: each player counter times its weight. Every stored
 * `fantasyPoints` equals this over the counters of its own line; `deriveLine` is what applies it.
 */
export function basketballFantasyPoints(line: Pick<BasketballPlayerStats, BasketballPlayerStatKey>): number {
  return BASKETBALL_PLAYER_STAT_KEYS.reduce(
    (total, key) => total + line[key] * BASKETBALL_FANTASY_POINT_WEIGHTS[key],
    0,
  );
}

const FANTASY_POINTS_FIELD = 'fantasyPoints' satisfies keyof BasketballPlayerStats;
const PLAYER_LINE_KINDS: readonly StatLineKind[] = PLAYER_STAT_LINE_KIND_KEYS;

export function emptyBasketballTeamLine(): BasketballTeamStats {
  return Object.fromEntries(BASKETBALL_TEAM_STAT_KEYS.map((key) => [key, 0])) as BasketballTeamStats;
}

function emptyPlayerCounters(): PlayerCounters {
  return Object.fromEntries(BASKETBALL_PLAYER_STAT_KEYS.map((key) => [key, 0])) as PlayerCounters;
}

function counterOf(line: StatLineValues, field: string): number {
  const value = line[field] ?? 0;
  if (typeof value !== 'number') throw new TypeError(`A basketball line's ${field} is not a number.`);
  return value;
}

function playerCountersOf(line: StatLineValues | undefined): PlayerCounters {
  const counters = emptyPlayerCounters();
  if (line === undefined) return counters;
  for (const key of BASKETBALL_PLAYER_STAT_KEYS) counters[key] = counterOf(line, key);
  return counters;
}

// FP is an individual stat: it goes on the four player kinds and on no team kind.
function deriveBasketballLine(kind: StatLineKind, line: StatLineValues): StatLineValues {
  const withoutDerived = Object.fromEntries(Object.entries(line).filter(([field]) => field !== FANTASY_POINTS_FIELD));
  if (!PLAYER_LINE_KINDS.includes(kind)) return withoutDerived;
  return { ...withoutDerived, [FANTASY_POINTS_FIELD]: basketballFantasyPoints(playerCountersOf(line)) };
}

// ---------------------------------------------------------------------------------------------
// Events and their effects
// ---------------------------------------------------------------------------------------------

const CORRECTABLE_FIELDS: CorrectableFields = {
  team: BASKETBALL_TEAM_STAT_KEYS,
  player: BASKETBALL_PLAYER_STAT_KEYS,
};

const TALLY_FIELD = {
  [BASKETBALL_REBOUND_EVENT_TYPE]: 'rebounds',
  [BASKETBALL_ASSIST_EVENT_TYPE]: 'assists',
} as const satisfies Record<(typeof BASKETBALL_PLAYER_TALLY_EVENT_TYPE_KEYS)[number], BasketballPlayerStatKey>;

interface LineChange<Field extends string> {
  /** The team id of a team line, or the roster-entry id of a player line. */
  readonly line: string;
  readonly field: Field;
  readonly amount: number;
}

interface Effects {
  readonly team: readonly LineChange<BasketballTeamStatKey>[];
  readonly player: readonly LineChange<BasketballPlayerStatKey>[];
}

function assisterOf(event: StatEventBody): string | undefined {
  return 'assistedByUserId' in event && typeof event.assistedByUserId === 'string' ? event.assistedByUserId : undefined;
}

function namesPlayer(event: StatEventBody): boolean {
  return 'playerUserId' in event && event.playerUserId !== undefined;
}

function effectsOf(event: BasketballEvent): Effects {
  if (event.type === BASKETBALL_TIMEOUT_EVENT_TYPE) {
    return { team: [{ line: event.teamId, field: 'timeouts', amount: 1 }], player: [] };
  }
  const scorer = buildGameRosterPlayerId(event.teamId, event.playerUserId);
  if (event.type === BASKETBALL_BULK_EDIT_EVENT_TYPE) {
    // A scorer's points edit keeps the team's score the sum of its players' points.
    return {
      team: event.stat === 'points' ? [{ line: event.teamId, field: 'score', amount: event.value }] : [],
      player: [{ line: scorer, field: event.stat, amount: event.value }],
    };
  }

  const team: LineChange<BasketballTeamStatKey>[] = [];
  const player: LineChange<BasketballPlayerStatKey>[] = [];
  const points = BASKETBALL_POINTS_BY_EVENT_TYPE[event.type];
  if (points > 0) {
    team.push({ line: event.teamId, field: 'score', amount: points });
    player.push({ line: scorer, field: 'points', amount: points });
  }
  if (event.type === BASKETBALL_REBOUND_EVENT_TYPE || event.type === BASKETBALL_ASSIST_EVENT_TYPE) {
    player.push({ line: scorer, field: TALLY_FIELD[event.type], amount: 1 });
  }
  const assister = assisterOf(event);
  if (assister !== undefined) {
    player.push({ line: buildGameRosterPlayerId(event.teamId, assister), field: 'assists', amount: 1 });
  }
  return { team, player };
}

function correctionEffects(event: StatCorrectionBody): Effects {
  const fields = event.playerUserId === undefined ? CORRECTABLE_FIELDS.team : CORRECTABLE_FIELDS.player;
  if (!fields.includes(event.stat)) {
    throw new Error(`A basketball correction cannot change ${event.stat} on a ${event.playerUserId === undefined ? 'team' : 'player'} line.`);
  }
  // A correction moves only its own field: a player-points correction does not move the team score.
  return event.playerUserId === undefined
    ? { team: [{ line: event.teamId, field: event.stat as BasketballTeamStatKey, amount: event.value }], player: [] }
    : {
        team: [],
        player: [
          {
            line: buildGameRosterPlayerId(event.teamId, event.playerUserId),
            field: event.stat as BasketballPlayerStatKey,
            amount: event.value,
          },
        ],
      };
}

function applyEffects(state: BasketballGameStats, effects: Effects, sign: 1 | -1): BasketballGameStats {
  const teamStats = { ...state.teamStats };
  for (const change of effects.team) {
    const line = { ...(teamStats[change.line] ?? emptyBasketballTeamLine()) };
    line[change.field] += sign * change.amount;
    teamStats[change.line] = line;
  }

  const playerStats = { ...state.playerStats };
  for (const change of effects.player) {
    const counters = playerCountersOf(playerStats[change.line]);
    counters[change.field] += sign * change.amount;
    if (isAllZeroLine(counters, BASKETBALL_PLAYER_STAT_KEYS)) delete playerStats[change.line];
    else playerStats[change.line] = deriveBasketballLine('gamePlayer', counters) as BasketballPlayerStats;
  }
  return { teamStats, playerStats };
}

// ---------------------------------------------------------------------------------------------
// Validation — the same rules the bulk form holds, re-checked on the server (SPORT-006)
// ---------------------------------------------------------------------------------------------

function isAssistableShot(type: BasketballStatEventType): boolean {
  return (BASKETBALL_ASSISTABLE_SHOT_EVENT_TYPE_KEYS as readonly string[]).includes(type);
}

const validate: SportScoring['validate'] = (stateIn, event, roster) => {
  if (!isBasketballEvent(event)) return refuseStatEvent('eventTypeNotInSport');
  if (!roster.teamIds.includes(event.teamId)) return refuseStatEvent('teamNotInGame');
  if (event.type === BASKETBALL_TIMEOUT_EVENT_TYPE) {
    return namesPlayer(event) || assisterOf(event) !== undefined ? refuseStatEvent('playerNotAllowed') : STAT_EVENT_ACCEPTED;
  }

  const scorer = buildGameRosterPlayerId(event.teamId, event.playerUserId);
  if (!roster.rosterPlayerIds.has(scorer)) return refuseStatEvent('playerNotRostered');

  const assister = assisterOf(event);
  if (assister !== undefined) {
    if (!isAssistableShot(event.type) || assister === event.playerUserId) return refuseStatEvent('assistNotAllowed');
    if (!roster.rosterPlayerIds.has(buildGameRosterPlayerId(event.teamId, assister))) {
      return refuseStatEvent('assisterNotRostered');
    }
  }

  if (event.type === BASKETBALL_BULK_EDIT_EVENT_TYPE) {
    if (!Number.isInteger(event.value) || event.value === 0) return refuseStatEvent('bulkValueInvalid');
    const state = ownStats(stateIn);
    const current = playerCountersOf(state.playerStats[scorer])[event.stat];
    if (event.previousValue !== current) return refuseStatEvent('bulkStale');
    if (current + event.value < 0) return refuseStatEvent('bulkValueInvalid');
    const teamScore = (state.teamStats[event.teamId] ?? emptyBasketballTeamLine()).score;
    if (event.stat === 'points' && teamScore + event.value < 0) return refuseStatEvent('bulkValueInvalid');
  }
  return STAT_EVENT_ACCEPTED;
};

// What a completed basketball game adds: each entry's points, rebounds, assists, and FP to its row,
// and the team's rebounds and assists to its standings line. A present entry with no points,
// rebounds, or assists is credited no game played — zero points alone is not exclusion.
const BASKETBALL_CONTRIBUTION: ContributionSpec = {
  playerStatKeys: BASKETBALL_PLAYER_STAT_KEYS,
  teamSeasonPlayerSums: ['rebounds', 'assists'] satisfies BasketballPlayerStatKey[],
  zeroLineIsNonScoring: true,
  deriveLine: deriveBasketballLine,
};

export const BASKETBALL_SCORING: SportScoring = {
  validate,
  apply: (state, event) => {
    if (isStatCorrection(event)) return applyEffects(ownStats(state), correctionEffects(event), 1);
    if (!isBasketballEvent(event)) throw new Error(`The basketball adapter does not apply ${event.type}.`);
    return applyEffects(ownStats(state), effectsOf(event), 1);
  },
  undo: (state, target) => {
    if (!isBasketballEvent(target)) throw new Error(`The basketball adapter does not undo ${target.type}.`);
    return applyEffects(ownStats(state), effectsOf(target), -1);
  },
  deriveLine: deriveBasketballLine,
  correctableFields: CORRECTABLE_FIELDS,
  // Played in no rounds, and finalized by hand whenever the scorer chooses.
  nextRound: () => null,
  finalizationReadiness: () => FINALIZATION_READY,
  participation: (state, rosterPlayerIds, absentRosterPlayerIds) =>
    decideParticipation(BASKETBALL_CONTRIBUTION, state, rosterPlayerIds, absentRosterPlayerIds),
  contribution: (game) => buildGameContribution(BASKETBALL_CONTRIBUTION, game),
};

// ---------------------------------------------------------------------------------------------
// Display
// ---------------------------------------------------------------------------------------------

export const BASKETBALL_EVENT_LABELS = {
  [BASKETBALL_ONE_POINT_EVENT_TYPE]: { button: '+1 PT', play: '1-point basket' },
  [BASKETBALL_TWO_POINT_EVENT_TYPE]: { button: '+2 PT', play: '2-point basket' },
  [BASKETBALL_THREE_POINT_EVENT_TYPE]: { button: '+3 PT', play: '3-point basket' },
  [BASKETBALL_REBOUND_EVENT_TYPE]: { button: 'Rebound', play: 'Rebound' },
  [BASKETBALL_ASSIST_EVENT_TYPE]: { button: 'Assist', play: 'Assist' },
  [BASKETBALL_TIMEOUT_EVENT_TYPE]: { button: 'Timeout', play: 'Timeout' },
  [BASKETBALL_BULK_EDIT_EVENT_TYPE]: { button: 'Bulk entry', play: 'Bulk entry' },
} as const satisfies Record<BasketballStatEventType, StatEventLabel>;

export const BASKETBALL_FIELD_LABELS = {
  team: { score: 'Score', timeouts: 'Timeouts' },
  player: { points: 'Points', rebounds: 'Rebounds', assists: 'Assists' },
} as const satisfies StatFieldLabels<BasketballTeamStatKey, BasketballPlayerStatKey>;

export function describeBasketballEvent(event: GameStatEvent, resolve: StatEventNameResolver): string {
  const storeEvent = describeStoreEvent(event, resolve, BASKETBALL_FIELD_LABELS);
  if (storeEvent !== null) return storeEvent;
  if (!isBasketballEvent(event)) return event.type;

  const team = resolve.team(event.teamId);
  if (event.type === BASKETBALL_TIMEOUT_EVENT_TYPE) return `${team}: ${BASKETBALL_EVENT_LABELS[event.type].play}`;

  const player = `${resolve.player(event.playerUserId)} (${team})`;
  if (event.type === BASKETBALL_BULK_EDIT_EVENT_TYPE) {
    const field = BASKETBALL_FIELD_LABELS.player[event.stat].toLowerCase();
    return `${player}: ${formatSignedValue(event.value)} ${field} (${BASKETBALL_EVENT_LABELS[event.type].play.toLowerCase()})`;
  }
  const play = `${player}: ${BASKETBALL_EVENT_LABELS[event.type].play}`;
  const assister = assisterOf(event);
  return assister === undefined ? play : `${play}, assisted by ${resolve.player(assister)}`;
}

function sumOf(lines: readonly { readonly rebounds: number; readonly assists: number }[], field: 'rebounds' | 'assists'): number {
  return lines.reduce((total, line) => total + line[field], 0);
}

export const BASKETBALL_SCOREBOARD: Scoreboard = {
  figures: [
    { id: 'points', label: BASKETBALL_FIELD_LABELS.player.points, value: (teamLine) => teamLine.score },
    { id: 'rebounds', label: BASKETBALL_FIELD_LABELS.player.rebounds, value: (_teamLine, sideLines) => sumOf(sideLines, 'rebounds') },
    { id: 'assists', label: BASKETBALL_FIELD_LABELS.player.assists, value: (_teamLine, sideLines) => sumOf(sideLines, 'assists') },
    { id: 'timeouts', label: BASKETBALL_FIELD_LABELS.team.timeouts, value: (teamLine) => ownTeamLine(teamLine).timeouts },
  ],
  jumpBall: true,
};

export const BASKETBALL_SCORING_PANEL: PlayerEventsScoringPanel = {
  kind: 'playerEvents',
  playerEventTypes: [...BASKETBALL_SCORE_EVENT_TYPE_KEYS, ...BASKETBALL_PLAYER_TALLY_EVENT_TYPE_KEYS],
  assistableEventTypes: BASKETBALL_ASSISTABLE_SHOT_EVENT_TYPE_KEYS,
  teamEventTypes: [BASKETBALL_TIMEOUT_EVENT_TYPE],
};

// ---------------------------------------------------------------------------------------------
// Bulk entry — one row per roster entry, absent entries included
// ---------------------------------------------------------------------------------------------

export const BASKETBALL_TEAM_SCORE_FLOOR_MESSAGE = "These changes would leave a team's score below zero.";

const playerLineValuesSchema = z.strictObject(
  Object.fromEntries(BASKETBALL_PLAYER_STAT_KEYS.map((key) => [key, bulkEntryCountField])) as Record<
    BasketballPlayerStatKey,
    typeof bulkEntryCountField
  >,
);

function currentPlayerCounters(context: BulkEntryContext, entryId: string): PlayerCounters {
  return playerCountersOf(ownStats(context.state).playerStats[entryId]);
}

function bulkDrafts(values: PlayerLinesValues, context: BulkEntryContext): StatEventDraft[] {
  const increases: StatEventDraft[] = [];
  const decreases: StatEventDraft[] = [];
  for (const entryId of context.rosterPlayerIds) {
    const entered = values.lines[entryId];
    const entry = parseGameRosterPlayerId(entryId);
    if (entered === undefined || entry === null) continue;
    const before = currentPlayerCounters(context, entryId);
    for (const stat of BASKETBALL_PLAYER_STAT_KEYS) {
      const value = (entered[stat] ?? before[stat]) - before[stat];
      if (value === 0) continue;
      const draft: StatEventDraft = {
        type: BASKETBALL_BULK_EDIT_EVENT_TYPE,
        teamId: entry.teamId,
        playerUserId: entry.userId,
        stat,
        value,
        previousValue: before[stat],
      };
      (value > 0 ? increases : decreases).push(draft);
    }
  }
  // Every increase before any decrease, so a team's running score never dips below the floor its
  // final score clears — each draft passes `validate` against the state the ones before it leave.
  return [...increases, ...decreases];
}

export const BASKETBALL_BULK_ENTRY: PlayerLinesBulkEntry = {
  kind: 'playerLines',
  formDefaults: (context) => ({
    lines: Object.fromEntries(context.rosterPlayerIds.map((entryId) => [entryId, currentPlayerCounters(context, entryId)])),
  }),
  formSchema: (context) => {
    const roster = new Set(context.rosterPlayerIds);
    return z.object({ lines: z.record(z.string(), playerLineValuesSchema) }).superRefine((values, issues) => {
      for (const entryId of Object.keys(values.lines)) {
        if (!roster.has(entryId)) {
          issues.addIssue({ code: 'custom', path: ['lines', entryId], message: NOT_ON_GAME_ROSTER_MESSAGE });
        }
      }
      const state = ownStats(context.state);
      for (const teamId of context.game.teamIds) {
        let score = (state.teamStats[teamId] ?? emptyBasketballTeamLine()).score;
        for (const [entryId, entered] of Object.entries(values.lines)) {
          if (parseGameRosterPlayerId(entryId)?.teamId !== teamId) continue;
          score += entered.points - currentPlayerCounters(context, entryId).points;
        }
        if (score < 0) issues.addIssue({ code: 'custom', path: ['lines'], message: BASKETBALL_TEAM_SCORE_FLOOR_MESSAGE });
      }
      if (bulkDrafts(values, context).length > MAX_STAT_EVENTS_PER_WRITE) {
        issues.addIssue({ code: 'custom', path: ['lines'], message: BULK_ENTRY_TOO_LARGE_MESSAGE });
      }
    });
  },
  toEvents: bulkDrafts,
};
