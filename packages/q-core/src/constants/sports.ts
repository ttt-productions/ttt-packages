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
import { MAX_STAT_EVENTS_PER_GAME } from './business.js';
import type {
  BasketballPlayerStatKey,
  BasketballStatEventType,
  FootballStatEventType,
} from '../types/sports.js';
import type {
  FinalizationNotReadyReason,
  GameRepairRefusal,
  StatEventRefusalCode,
  StatsIntegrityRefusal,
} from '../types/stats.js';

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

// The most events one scoring write may carry: each event is a document created in the write's one
// transaction, and a Firestore transaction commits at most 500 writes.
export const MAX_STAT_EVENTS_PER_WRITE = 200;

export const MAX_GAME_STATS_CORRECTION_TARGETS = 200;

export const MAX_STATS_REPAIR_LISTED_CHANGES = 500;

export const MAX_STATS_VALIDATION_DISCREPANCIES = 500;

export const STAT_HISTORY_PAGE_SIZE = 1000;

export const MAX_STAT_HISTORY_PAGES = Math.ceil(MAX_STAT_EVENTS_PER_GAME / STAT_HISTORY_PAGE_SIZE);

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
  roundNotNext: 'That round is not the next one to record.',
  roundsComplete: 'Every round is already recorded.',
  bulkValueInvalid:
    'That entry is not a real result: stats are whole numbers and never go below zero.',
  bulkStale: 'The numbers changed while you were editing. Check the flagged values and save again.',
  eventIdConflict:
    'A different stat was already saved under this one. Discard it and enter it again.',
  voidTargetNotSportEvent: 'There is no recorded stat there to undo.',
  correctionNotAccepted: 'Corrections are made from Fix stats, not from the scoring screen.',
  undoBelowZero:
    'Undoing that play would leave a stat below zero, because a later entry already lowered it.',
} as const satisfies Record<StatEventRefusalCode, string>;

export const STATS_MIGRATION_OPERATION_ID = 'migration';
export const STATS_MIGRATION_CORRECTION_REASON =
  'The recorded result differs from what its recorded plays add up to; this correction keeps the recorded result.';

export const GAME_REPAIR_REFUSAL_COPY = {
  eventUnreadable:
    "One of this game's recorded stats can no longer be read. Fix the event in the console, then repair the game.",
  eventSequenceGap:
    "This game's recorded stats are numbered with a gap or a repeat. Fix the event documents in the console, then restore the game.",
  sourcesDisagree:
    "This game's record, its stored numbers, and its recorded stats all disagree, so nothing says what was applied. Fix the game in the console first.",
  scoreAmbiguous:
    "The team's score was edited in two places to different values. Enter the score you want as a correction instead.",
  fieldNotCorrectable:
    'That number cannot be corrected for this sport. Restore the game from its recorded stats, or reopen it and score it again.',
  lineNotRostered: "That player is not on this game's roster.",
  teamNotInGame: 'That team is not playing in this game.',
  gameTooLarge: 'This repair is too large to save at once.',
} as const satisfies Record<GameRepairRefusal, string>;

export const STATS_INTEGRITY_REFUSAL_COPY = {
  statsOutOfBand:
    "This game's stored numbers no longer match the stats recorded for it. An admin must reconcile the game in Fix stats first.",
  finalRecordMissing:
    "This finalized game's record of its stats is missing. An admin must repair the game in Fix stats first.",
  aggregateBelowZero:
    'A league, career, or hall-of-fame total holds less than this game added to it. An admin must rebuild the totals in Fix stats first.',
} as const satisfies Record<StatsIntegrityRefusal, string>;

export const FINALIZATION_NOT_READY_COPY = {
  roundsIncomplete: 'Every round must be recorded before the game can be finalized.',
} as const satisfies Record<FinalizationNotReadyReason, string>;

export const HALL_OF_FAME_MINIMUM_GAMES_CHOICES = [25, 50, 100] as const;
export type HallOfFameMinimumGames = (typeof HALL_OF_FAME_MINIMUM_GAMES_CHOICES)[number];
