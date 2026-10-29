// The curling adapter's scoring, display, and bulk-entry members. Curling is team-scored by round: a
// round event records one round — one team's points, or a blank round for every team — and nothing
// names a player. A round is recorded once, in order: `validate` accepts a round event only for the
// first unrecorded round, and re-scoring a round is a void of its event plus a new one, so no curling
// event is ever superseded and undoing one always returns its round to unrecorded (RULE-QS-SPORT-913).

import { z } from 'zod';
import {
  CURLING_ROUND_COUNT,
  MAX_CURLING_ROUND_POINTS,
  MAX_STAT_EVENTS_PER_WRITE,
} from '../constants/sports.js';
import type { CurlingTeamStats, GameStatEvent } from '../doc-schemas/game-stats.js';
import type { CurlingGameStats, GameStats } from '../doc-schemas/sport-game.js';
import {
  CURLING_ROUND_BLANK_EVENT_TYPE,
  CURLING_ROUND_SCORE_EVENT_TYPE,
  CURLING_STAT_EVENT_TYPE_KEYS,
} from '../types/sports.js';
import type { CurlingStatEventType, CurlingTeamStatKey } from '../types/sports.js';
import { STAT_VOID_EVENT_TYPE } from '../types/stats.js';
import {
  BULK_ENTRY_TOO_LARGE_MESSAGE,
  bulkEntryCountField,
  type BulkEntryContext,
  type RoundsBulkEntry,
  type RoundsValues,
  type StatEventDraft,
} from './bulk-entry.js';
import {
  buildGameContribution,
  decideParticipation,
  type ContributionSpec,
} from './contribution.js';
import {
  FINALIZATION_READY,
  STAT_EVENT_ACCEPTED,
  isSportStatEventIn,
  isStatCorrection,
  refuseStatEvent,
  type CorrectableFields,
  type FinalizationReadiness,
  type GameTeamLine,
  type SportScoring,
  type SportStatEventBody,
  type StatEventBody,
} from './scoring.js';
import {
  describeStoreEvent,
  type RoundsDisplay,
  type RoundsScoringPanel,
  type Scoreboard,
  type StatEventLabel,
  type StatEventNameResolver,
  type StatFieldLabels,
} from './scoring-display.js';

type CurlingEvent = Extract<SportStatEventBody, { type: CurlingStatEventType }>;

function isCurlingEvent(event: StatEventBody | undefined): event is CurlingEvent {
  return isSportStatEventIn(CURLING_STAT_EVENT_TYPE_KEYS, event);
}

// The registry chose this adapter by the game's `leagueType`, so the rollup it is handed is a
// curling game's (RULE-QS-SPORT-902).
function ownStats(state: GameStats): CurlingGameStats {
  return state as CurlingGameStats;
}

function ownTeamLine(line: GameTeamLine): CurlingTeamStats {
  return line as CurlingTeamStats;
}

// ---------------------------------------------------------------------------------------------
// Lines — a team's `score` is always the sum of its recorded rounds
// ---------------------------------------------------------------------------------------------

type RoundSlots = CurlingTeamStats['roundScores'];

function sumOfRounds(roundScores: RoundSlots): number {
  return roundScores.reduce<number>((total, slot) => total + (slot ?? 0), 0);
}

/** Every round unrecorded — `null`, where a blank round is `0`. */
export function emptyCurlingTeamLine(): CurlingTeamStats {
  const roundScores: RoundSlots = Array.from({ length: CURLING_ROUND_COUNT }, () => null);
  return { score: sumOfRounds(roundScores), roundScores };
}

function withRound(
  line: CurlingTeamStats,
  roundNumber: number,
  slot: number | null,
): CurlingTeamStats {
  const roundScores = [...line.roundScores];
  roundScores[roundNumber - 1] = slot;
  return { score: sumOfRounds(roundScores), roundScores };
}

/**
 * Record or clear one round on every team line: a scored round is the scoring team's points and 0
 * for the others, a blank round 0 for all, and a cleared round `null` for all.
 */
function setRound(stateIn: GameStats, event: CurlingEvent, recorded: boolean): CurlingGameStats {
  const state = ownStats(stateIn);
  const teamStats = { ...state.teamStats };
  const scoringTeamId = event.type === CURLING_ROUND_SCORE_EVENT_TYPE ? event.teamId : undefined;
  if (scoringTeamId !== undefined && teamStats[scoringTeamId] === undefined) {
    teamStats[scoringTeamId] = emptyCurlingTeamLine();
  }
  for (const [teamId, line] of Object.entries(teamStats)) {
    const points =
      event.type === CURLING_ROUND_SCORE_EVENT_TYPE && teamId === scoringTeamId ? event.points : 0;
    teamStats[teamId] = withRound(line, event.roundNumber, recorded ? points : null);
  }
  return { teamStats, playerStats: state.playerStats };
}

function nextCurlingRound(stateIn: GameStats): number | null {
  const lines = Object.values(ownStats(stateIn).teamStats);
  for (let roundNumber = 1; roundNumber <= CURLING_ROUND_COUNT; roundNumber += 1) {
    if (lines.length === 0 || lines.some((line) => line.roundScores[roundNumber - 1] === null))
      return roundNumber;
  }
  return null;
}

// ---------------------------------------------------------------------------------------------
// Scoring
// ---------------------------------------------------------------------------------------------

// No curling field is correctable: a curling result changes only by reopening the game and
// re-scoring the round.
const CORRECTABLE_FIELDS: CorrectableFields = { team: [], player: [] };

function namesPlayer(event: StatEventBody): boolean {
  return 'playerUserId' in event && event.playerUserId !== undefined;
}

const validate: SportScoring['validate'] = (state, event, roster) => {
  if (!isCurlingEvent(event)) return refuseStatEvent('eventTypeNotInSport');
  if (namesPlayer(event)) return refuseStatEvent('playerNotAllowed');
  if (event.type === CURLING_ROUND_SCORE_EVENT_TYPE && !roster.teamIds.includes(event.teamId)) {
    return refuseStatEvent('teamNotInGame');
  }
  const next = nextCurlingRound(state);
  if (next === null) return refuseStatEvent('roundsComplete');
  return event.roundNumber === next ? STAT_EVENT_ACCEPTED : refuseStatEvent('roundNotNext');
};

function finalizationReadiness(state: GameStats): FinalizationReadiness {
  return nextCurlingRound(state) === null
    ? FINALIZATION_READY
    : { ready: false, reason: 'roundsIncomplete' };
}

// What a completed curling game adds: the standings line from the two scores, and a game played
// to every present roster entry, whatever its team scored. There are no individual stats, so only
// absence withholds a game played and no entry is ever non-scoring.
const CURLING_CONTRIBUTION: ContributionSpec = {
  playerStatKeys: [],
  teamSeasonPlayerSums: [],
  zeroLineIsNonScoring: false,
  deriveLine: (_kind, line) => line,
};

export const CURLING_SCORING: SportScoring = {
  validate,
  apply: (state, event) => {
    if (isStatCorrection(event)) throw new Error('No curling field is correctable.');
    if (!isCurlingEvent(event))
      throw new Error(`The curling adapter does not apply ${event.type}.`);
    return setRound(state, event, true);
  },
  undo: (state, target) => {
    if (!isCurlingEvent(target))
      throw new Error(`The curling adapter does not undo ${target.type}.`);
    return setRound(state, target, false);
  },
  // A curling line has no derived field.
  deriveLine: CURLING_CONTRIBUTION.deriveLine,
  correctableFields: CORRECTABLE_FIELDS,
  nextRound: nextCurlingRound,
  finalizationReadiness,
  participation: (state, rosterPlayerIds, absentRosterPlayerIds) =>
    decideParticipation(CURLING_CONTRIBUTION, state, rosterPlayerIds, absentRosterPlayerIds),
  contribution: (game) => buildGameContribution(CURLING_CONTRIBUTION, game),
};

// ---------------------------------------------------------------------------------------------
// Display
// ---------------------------------------------------------------------------------------------

export const CURLING_ROUNDS: RoundsDisplay = { count: CURLING_ROUND_COUNT, label: 'Round' };

export const CURLING_EVENT_LABELS = {
  [CURLING_ROUND_SCORE_EVENT_TYPE]: { button: 'Score', play: 'Round score' },
  [CURLING_ROUND_BLANK_EVENT_TYPE]: { button: '+0 (Blank)', play: 'Blank end' },
} as const satisfies Record<CurlingStatEventType, StatEventLabel>;

export const CURLING_FIELD_LABELS = {
  team: { score: 'Score' },
  player: {},
} as const satisfies StatFieldLabels<CurlingTeamStatKey, never>;

export function describeCurlingEvent(event: GameStatEvent, resolve: StatEventNameResolver): string {
  const storeEvent = describeStoreEvent(event, resolve, CURLING_FIELD_LABELS);
  if (storeEvent !== null) return storeEvent;
  if (!isCurlingEvent(event)) return event.type;
  const round = `${CURLING_ROUNDS.label} ${event.roundNumber}`;
  if (event.type === CURLING_ROUND_BLANK_EVENT_TYPE)
    return `${round}: ${CURLING_EVENT_LABELS[event.type].play.toLowerCase()}`;
  return `${round}: ${resolve.team(event.teamId)} scored ${event.points}`;
}

export const CURLING_SCOREBOARD: Scoreboard = {
  figures: [{ id: 'points', label: 'Points', value: (teamLine) => teamLine.score }],
  jumpBall: false,
  roundSlots: (teamLine) => ownTeamLine(teamLine).roundScores,
};

export const CURLING_SCORING_PANEL: RoundsScoringPanel = {
  kind: 'rounds',
  scoreEventType: CURLING_ROUND_SCORE_EVENT_TYPE,
  blankEventType: CURLING_ROUND_BLANK_EVENT_TYPE,
  maxPoints: MAX_CURLING_ROUND_POINTS,
};

// ---------------------------------------------------------------------------------------------
// Bulk entry — one row per round, a cell per team
// ---------------------------------------------------------------------------------------------

export const CURLING_ROUND_POINTS_MESSAGE = `A round is worth 0 to ${MAX_CURLING_ROUND_POINTS} points.`;
export const CURLING_ONE_SCORING_TEAM_MESSAGE =
  'A round is scored by one team (the other 0 or empty), blank (0 for every team), or left empty.';
export const CURLING_NO_SKIPPED_ROUND_MESSAGE =
  'Rounds are recorded in order: fill in every earlier round first.';

type RoundOutcome =
  | { readonly kind: 'unrecorded' }
  | { readonly kind: 'blank' }
  | { readonly kind: 'scored'; readonly teamId: string; readonly points: number }
  | { readonly kind: 'invalid' };

function roundOutcome(
  row: Readonly<Record<string, number | null | undefined>>,
  teamIds: readonly string[],
): RoundOutcome {
  const cells = teamIds.map((teamId) => ({ teamId, points: row[teamId] ?? null }));
  if (cells.every((cell) => cell.points === null)) return { kind: 'unrecorded' };
  if (cells.every((cell) => cell.points === 0)) return { kind: 'blank' };
  const scorers = cells.filter((cell) => cell.points !== null && cell.points > 0);
  const [scorer] = scorers;
  if (scorers.length === 1 && scorer !== undefined && scorer.points !== null) {
    return { kind: 'scored', teamId: scorer.teamId, points: scorer.points };
  }
  return { kind: 'invalid' };
}

function sameOutcome(left: RoundOutcome, right: RoundOutcome): boolean {
  if (left.kind === 'scored' && right.kind === 'scored')
    return left.teamId === right.teamId && left.points === right.points;
  return left.kind === right.kind;
}

function storedRound(
  context: BulkEntryContext,
  roundNumber: number,
): Record<string, number | null> {
  const state = ownStats(context.state);
  return Object.fromEntries(
    context.game.teamIds.map((teamId) => [
      teamId,
      state.teamStats[teamId]?.roundScores[roundNumber - 1] ?? null,
    ]),
  );
}

function roundDrafts(values: RoundsValues, context: BulkEntryContext): StatEventDraft[] {
  const { teamIds } = context.game;
  const liveEventByRound = new Map(
    context.liveRoundEvents.map((event) => [event.roundNumber, event.eventId]),
  );
  const voids: StatEventDraft[] = [];
  const recorded: StatEventDraft[] = [];
  values.rounds.forEach((row, index) => {
    const roundNumber = index + 1;
    const entered = roundOutcome(row, teamIds);
    if (sameOutcome(entered, roundOutcome(storedRound(context, roundNumber), teamIds))) return;
    const liveEventId = liveEventByRound.get(roundNumber);
    if (liveEventId !== undefined)
      voids.push({ type: STAT_VOID_EVENT_TYPE, targetEventId: liveEventId });
    if (entered.kind === 'scored') {
      recorded.push({
        type: CURLING_ROUND_SCORE_EVENT_TYPE,
        teamId: entered.teamId,
        roundNumber,
        points: entered.points,
      });
    } else if (entered.kind === 'blank') {
      recorded.push({ type: CURLING_ROUND_BLANK_EVENT_TYPE, roundNumber });
    }
  });
  // Every void first, then the new rounds in order: each changed round is unrecorded again before
  // any new event is validated, so each new event is the next unrecorded round when it arrives.
  return [...voids, ...recorded];
}

const roundCell = bulkEntryCountField
  .pipe(z.number().max(MAX_CURLING_ROUND_POINTS, CURLING_ROUND_POINTS_MESSAGE))
  .nullable();

export const CURLING_BULK_ENTRY: RoundsBulkEntry = {
  kind: 'rounds',
  formDefaults: (context) => ({
    rounds: Array.from({ length: CURLING_ROUND_COUNT }, (_, index) =>
      storedRound(context, index + 1),
    ),
  }),
  formSchema: (context) => {
    const { teamIds } = context.game;
    const row = z.strictObject(Object.fromEntries(teamIds.map((teamId) => [teamId, roundCell])));
    return z
      .object({ rounds: z.array(row).length(CURLING_ROUND_COUNT) })
      .superRefine((values, issues) => {
        let unrecordedBefore = false;
        values.rounds.forEach((cells, index) => {
          const outcome = roundOutcome(cells, teamIds);
          if (outcome.kind === 'invalid') {
            issues.addIssue({
              code: 'custom',
              path: ['rounds', index],
              message: CURLING_ONE_SCORING_TEAM_MESSAGE,
            });
          } else if (outcome.kind === 'unrecorded') {
            unrecordedBefore = true;
          } else if (unrecordedBefore) {
            issues.addIssue({
              code: 'custom',
              path: ['rounds', index],
              message: CURLING_NO_SKIPPED_ROUND_MESSAGE,
            });
          }
        });
        if (roundDrafts(values, context).length > MAX_STAT_EVENTS_PER_WRITE) {
          issues.addIssue({
            code: 'custom',
            path: ['rounds'],
            message: BULK_ENTRY_TOO_LARGE_MESSAGE,
          });
        }
      });
  },
  toEvents: roundDrafts,
};
