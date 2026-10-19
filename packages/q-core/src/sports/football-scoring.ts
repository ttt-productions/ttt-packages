// The football adapter's scoring, display, and bulk-entry members. Football is team-scored: each
// event adds its points to one team's score, no event names a player, and there is no finish rule —
// the game is finalized by hand. Bulk entry takes each team's final score.
//
// `apply` and `undo` are one function over an event's points with opposite signs, so they are exact
// inverses by construction (SPORT-103).

import { z } from 'zod';
import {
  FOOTBALL_POINTS_BY_EVENT_TYPE,
  MAX_STAT_EVENTS_PER_WRITE,
  TEAM_NOT_IN_GAME_MESSAGE,
} from '../constants/sports.js';
import type { FootballTeamStats, GameStatEvent } from '../doc-schemas/game-stats.js';
import type { FootballGameStats, GameStats } from '../doc-schemas/sport-game.js';
import {
  FOOTBALL_BULK_EDIT_EVENT_TYPE,
  FOOTBALL_ONE_POINT_EVENT_TYPE,
  FOOTBALL_SCORE_EVENT_TYPE_KEYS,
  FOOTBALL_SIX_POINT_EVENT_TYPE,
  FOOTBALL_STAT_EVENT_TYPE_KEYS,
  FOOTBALL_TEAM_STAT_KEYS,
  FOOTBALL_TWO_POINT_EVENT_TYPE,
} from '../types/sports.js';
import type { FootballStatEventType, FootballTeamStatKey } from '../types/sports.js';
import {
  BULK_ENTRY_TOO_LARGE_MESSAGE,
  bulkEntryCountField,
  type BulkEntryContext,
  type StatEventDraft,
  type TeamScoresBulkEntry,
  type TeamScoresValues,
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
  type SportScoring,
  type SportStatEventBody,
  type StatCorrectionBody,
  type StatEventBody,
} from './scoring.js';
import {
  describeStoreEvent,
  formatSignedValue,
  type Scoreboard,
  type StatEventLabel,
  type StatEventNameResolver,
  type StatFieldLabels,
  type TeamPointsScoringPanel,
} from './scoring-display.js';

type FootballEvent = Extract<SportStatEventBody, { type: FootballStatEventType }>;

function isFootballEvent(event: StatEventBody | undefined): event is FootballEvent {
  return isSportStatEventIn(FOOTBALL_STAT_EVENT_TYPE_KEYS, event);
}

// The registry chose this adapter by the game's `leagueType`, so the rollup it is handed is a
// football game's (SPORT-002).
function ownStats(state: GameStats): FootballGameStats {
  return state as FootballGameStats;
}

export function emptyFootballTeamLine(): FootballTeamStats {
  return Object.fromEntries(FOOTBALL_TEAM_STAT_KEYS.map((key) => [key, 0])) as FootballTeamStats;
}

function teamScoreOf(state: FootballGameStats, teamId: string): number {
  return (state.teamStats[teamId] ?? emptyFootballTeamLine()).score;
}

/** The points an event adds to its team's score: a scoring event's own, or a bulk edit's `value`. */
function pointsOf(event: FootballEvent): number {
  return event.type === FOOTBALL_BULK_EDIT_EVENT_TYPE
    ? event.value
    : FOOTBALL_POINTS_BY_EVENT_TYPE[event.type];
}

function addToScore(stateIn: GameStats, teamId: string, amount: number): FootballGameStats {
  const state = ownStats(stateIn);
  const line = state.teamStats[teamId] ?? emptyFootballTeamLine();
  return {
    teamStats: { ...state.teamStats, [teamId]: { ...line, score: line.score + amount } },
    playerStats: state.playerStats,
  };
}

// A correction to the team's score; football keeps no player line to correct.
const CORRECTABLE_FIELDS: CorrectableFields = { team: FOOTBALL_TEAM_STAT_KEYS, player: [] };

function correctionAmount(event: StatCorrectionBody): number {
  const fields =
    event.playerUserId === undefined ? CORRECTABLE_FIELDS.team : CORRECTABLE_FIELDS.player;
  if (!fields.includes(event.stat)) {
    throw new Error(
      `A football correction cannot change ${event.stat} on a ${event.playerUserId === undefined ? 'team' : 'player'} line.`,
    );
  }
  return event.value;
}

function namesPlayer(event: StatEventBody): boolean {
  return 'playerUserId' in event && event.playerUserId !== undefined;
}

const validate: SportScoring['validate'] = (stateIn, event, roster) => {
  if (!isFootballEvent(event)) return refuseStatEvent('eventTypeNotInSport');
  if (!roster.teamIds.includes(event.teamId)) return refuseStatEvent('teamNotInGame');
  if (namesPlayer(event)) return refuseStatEvent('playerNotAllowed');
  if (event.type === FOOTBALL_BULK_EDIT_EVENT_TYPE) {
    if (!Number.isInteger(event.value) || event.value === 0)
      return refuseStatEvent('bulkValueInvalid');
    const score = teamScoreOf(ownStats(stateIn), event.teamId);
    if (event.previousValue !== score) return refuseStatEvent('bulkStale');
    if (score + event.value < 0) return refuseStatEvent('bulkValueInvalid');
  }
  return STAT_EVENT_ACCEPTED;
};

// What a completed football game adds: the standings line from the two scores, and a game played
// to every present roster entry, whatever its team scored. There are no individual stats, so only
// absence withholds a game played and no entry is ever non-scoring.
const FOOTBALL_CONTRIBUTION: ContributionSpec = {
  playerStatKeys: [],
  teamSeasonPlayerSums: [],
  zeroLineIsNonScoring: false,
  deriveLine: (_kind, line) => line,
};

export const FOOTBALL_SCORING: SportScoring = {
  validate,
  apply: (state, event) => {
    if (isStatCorrection(event)) return addToScore(state, event.teamId, correctionAmount(event));
    if (!isFootballEvent(event))
      throw new Error(`The football adapter does not apply ${event.type}.`);
    return addToScore(state, event.teamId, pointsOf(event));
  },
  undo: (state, target) => {
    if (!isFootballEvent(target))
      throw new Error(`The football adapter does not undo ${target.type}.`);
    return addToScore(state, target.teamId, -pointsOf(target));
  },
  // A football line has no derived field.
  deriveLine: FOOTBALL_CONTRIBUTION.deriveLine,
  correctableFields: CORRECTABLE_FIELDS,
  // No rounds and no finish rule: the game is finalized by hand.
  nextRound: () => null,
  finalizationReadiness: () => FINALIZATION_READY,
  participation: (state, rosterPlayerIds, absentRosterPlayerIds) =>
    decideParticipation(FOOTBALL_CONTRIBUTION, state, rosterPlayerIds, absentRosterPlayerIds),
  contribution: (game) => buildGameContribution(FOOTBALL_CONTRIBUTION, game),
};

// ---------------------------------------------------------------------------------------------
// Display
// ---------------------------------------------------------------------------------------------

export const FOOTBALL_EVENT_LABELS = {
  [FOOTBALL_SIX_POINT_EVENT_TYPE]: { button: '+6', play: '6 points' },
  [FOOTBALL_TWO_POINT_EVENT_TYPE]: { button: '+2', play: '2 points' },
  [FOOTBALL_ONE_POINT_EVENT_TYPE]: { button: '+1', play: '1 point' },
  [FOOTBALL_BULK_EDIT_EVENT_TYPE]: { button: 'Final scores', play: 'Final score entry' },
} as const satisfies Record<FootballStatEventType, StatEventLabel>;

export const FOOTBALL_FIELD_LABELS = {
  team: { score: 'Score' },
  player: {},
} as const satisfies StatFieldLabels<FootballTeamStatKey, never>;

export function describeFootballEvent(
  event: GameStatEvent,
  resolve: StatEventNameResolver,
): string {
  const storeEvent = describeStoreEvent(event, resolve, FOOTBALL_FIELD_LABELS);
  if (storeEvent !== null) return storeEvent;
  if (!isFootballEvent(event)) return event.type;
  const team = resolve.team(event.teamId);
  if (event.type === FOOTBALL_BULK_EDIT_EVENT_TYPE) {
    return `${team}: ${formatSignedValue(event.value)} points (${FOOTBALL_EVENT_LABELS[event.type].play.toLowerCase()})`;
  }
  return `${team}: ${FOOTBALL_EVENT_LABELS[event.type].play}`;
}

export const FOOTBALL_SCOREBOARD: Scoreboard = {
  figures: [{ id: 'points', label: 'Points', value: (teamLine) => teamLine.score }],
  jumpBall: false,
};

export const FOOTBALL_SCORING_PANEL: TeamPointsScoringPanel = {
  kind: 'teamPoints',
  eventTypes: FOOTBALL_SCORE_EVENT_TYPE_KEYS,
};

// ---------------------------------------------------------------------------------------------
// Bulk entry — each team's final score
// ---------------------------------------------------------------------------------------------

function scoreDrafts(values: TeamScoresValues, context: BulkEntryContext): StatEventDraft[] {
  const state = ownStats(context.state);
  const drafts: StatEventDraft[] = [];
  for (const teamId of context.game.teamIds) {
    const entered = values.scores[teamId];
    const previousValue = teamScoreOf(state, teamId);
    if (entered === undefined || entered === previousValue) continue;
    drafts.push({
      type: FOOTBALL_BULK_EDIT_EVENT_TYPE,
      teamId,
      value: entered - previousValue,
      previousValue,
    });
  }
  return drafts;
}

export const FOOTBALL_BULK_ENTRY: TeamScoresBulkEntry = {
  kind: 'teamScores',
  formDefaults: (context) => ({
    scores: Object.fromEntries(
      context.game.teamIds.map((teamId) => [teamId, teamScoreOf(ownStats(context.state), teamId)]),
    ),
  }),
  formSchema: (context) => {
    const teams = new Set(context.game.teamIds);
    return z
      .object({ scores: z.record(z.string(), bulkEntryCountField) })
      .superRefine((values, issues) => {
        for (const teamId of Object.keys(values.scores)) {
          if (!teams.has(teamId))
            issues.addIssue({
              code: 'custom',
              path: ['scores', teamId],
              message: TEAM_NOT_IN_GAME_MESSAGE,
            });
        }
        if (scoreDrafts(values, context).length > MAX_STAT_EVENTS_PER_WRITE) {
          issues.addIssue({
            code: 'custom',
            path: ['scores'],
            message: BULK_ENTRY_TOO_LARGE_MESSAGE,
          });
        }
      });
  },
  toEvents: scoreDrafts,
};
