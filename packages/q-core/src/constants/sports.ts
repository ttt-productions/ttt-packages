import { MAX_STAT_EVENTS_PER_GAME } from './business.js';
import {
  BASKETBALL_ASSIST_EVENT_TYPE,
  BASKETBALL_BULK_EDIT_EVENT_TYPE,
  BASKETBALL_ONE_POINT_EVENT_TYPE,
  BASKETBALL_REBOUND_EVENT_TYPE,
  BASKETBALL_THREE_POINT_EVENT_TYPE,
  BASKETBALL_TIMEOUT_EVENT_TYPE,
  BASKETBALL_TWO_POINT_EVENT_TYPE,
  FOOTBALL_BULK_EDIT_EVENT_TYPE,
  FOOTBALL_ONE_POINT_EVENT_TYPE,
  FOOTBALL_SIX_POINT_EVENT_TYPE,
  FOOTBALL_TWO_POINT_EVENT_TYPE,
} from '../types/sports.js';
import type {
  BasketballPlayerStatKey,
  BasketballStatEventType,
  FootballStatEventType,
} from '../types/sports.js';
import type { FinalizationNotReadyReason, StatEventRefusalCode } from '../types/stats.js';

export const BASKETBALL_POINTS_BY_EVENT_TYPE = {
  [BASKETBALL_ONE_POINT_EVENT_TYPE]: 1,
  [BASKETBALL_TWO_POINT_EVENT_TYPE]: 2,
  [BASKETBALL_THREE_POINT_EVENT_TYPE]: 3,
  [BASKETBALL_REBOUND_EVENT_TYPE]: 0,
  [BASKETBALL_ASSIST_EVENT_TYPE]: 0,
  [BASKETBALL_TIMEOUT_EVENT_TYPE]: 0,
  [BASKETBALL_BULK_EDIT_EVENT_TYPE]: 0,
} as const satisfies Record<BasketballStatEventType, number>;

// Every weight is a multiple of one half, so FP summed across games equals FP of the summed
// counters exactly.
export const BASKETBALL_FANTASY_POINT_WEIGHTS = {
  points: 1,
  rebounds: 1.5,
  assists: 2,
} as const satisfies Record<BasketballPlayerStatKey, number>;

export const CURLING_ROUND_COUNT = 14;

export const MAX_CURLING_ROUND_POINTS = 4;

export const MAX_STAT_COUNT = 999_999;

// One scoring write carries at most a whole game's stat log.
export const MAX_STAT_EVENTS_PER_WRITE = MAX_STAT_EVENTS_PER_GAME;

export const MAX_STATS_REPAIR_LISTED_CHANGES = 500;

export const MAX_STATS_VALIDATION_DISCREPANCIES = 500;

export const FOOTBALL_POINTS_BY_EVENT_TYPE = {
  [FOOTBALL_SIX_POINT_EVENT_TYPE]: 6,
  [FOOTBALL_TWO_POINT_EVENT_TYPE]: 2,
  [FOOTBALL_ONE_POINT_EVENT_TYPE]: 1,
  [FOOTBALL_BULK_EDIT_EVENT_TYPE]: 0,
} as const satisfies Record<FootballStatEventType, number>;

export const TEAM_NOT_IN_GAME_MESSAGE = 'That team is not playing in this game.';

export const NOT_ON_GAME_ROSTER_MESSAGE = "That player is not on this game's roster.";

export const STAT_EVENT_REFUSAL_COPY = {
  eventTypeNotInSport: "That stat does not belong to this game's sport.",
  teamNotInGame: TEAM_NOT_IN_GAME_MESSAGE,
  playerNotRostered: "That player is not on this game's roster for that team.",
  assisterNotRostered: "The assisting player is not on this game's roster for that team.",
  assistNotAllowed:
    'Only a 2- or 3-point basket can be assisted, and never by the player who scored it.',
  playerNotAllowed: "That stat is the team's; it cannot name a player.",
  roundNotNext: 'That end is not the next one to record.',
  roundsComplete: 'Every end is already recorded.',
  bulkValueInvalid:
    'That entry is not a real result: stats are whole numbers and never go below zero.',
  eventIdConflict:
    'A different stat was already saved under this one. Discard it and enter it again.',
  voidTargetNotSportEvent: 'There is no recorded stat there to undo.',
  correctionNotAccepted: 'Corrections are made from Fix stats, not from the scoring screen.',
} as const satisfies Record<StatEventRefusalCode, string>;

export const STATS_MIGRATION_OPERATION_ID = 'migration';
export const FINALIZATION_NOT_READY_COPY = {
  roundsIncomplete: 'Every end must be recorded before the game can be finalized.',
} as const satisfies Record<FinalizationNotReadyReason, string>;

export const HALL_OF_FAME_MINIMUM_GAMES_CHOICES = [25, 50, 100] as const;
export type HallOfFameMinimumGames = (typeof HALL_OF_FAME_MINIMUM_GAMES_CHOICES)[number];
