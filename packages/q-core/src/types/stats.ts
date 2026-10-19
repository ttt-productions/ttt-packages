// Canonical unions of the stat event store and the stats operations (ARCH-102). What each sport's
// own events and lines are is ./sports.ts; these are the sport-agnostic halves every sport shares.

import { CAPTAIN_TEAM_ROLES, SYSTEM_ROLE_KEYS } from './unions.js';

// The two store-level events, members of every sport's event union. A void undoes the one event it
// targets; a correction adds a signed value to one correctable field of one line.
export const STAT_VOID_EVENT_TYPE = 'STAT_VOID';
export const STAT_CORRECTION_EVENT_TYPE = 'STAT_CORRECTION';
export const STAT_STORE_EVENT_TYPE_KEYS = [
  STAT_VOID_EVENT_TYPE,
  STAT_CORRECTION_EVENT_TYPE,
] as const;
export type StatStoreEventType = (typeof STAT_STORE_EVENT_TYPE_KEYS)[number];

// The fields of a stored stat event the writing core derives — its place in the replay, and who
// recorded it under which authority — so a caller never sends them (ARCH-106).
export const STAT_EVENT_RECORDER_FIELD_KEYS = [
  'sequence',
  'acceptedAt',
  'recordedByUserId',
  'recordedByAuthority',
  'recordedByTeamId',
] as const;
export type StatEventRecorderField = (typeof STAT_EVENT_RECORDER_FIELD_KEYS)[number];

// The name snapshots only a copied event carries; nothing writes one on a new event (SPORT-104).
export const STAT_EVENT_SNAPSHOT_FIELD_KEYS = [
  'displayNameSnapshot',
  'assistedByDisplayNameSnapshot',
] as const;
export type StatEventSnapshotField = (typeof STAT_EVENT_SNAPSHOT_FIELD_KEYS)[number];

// Who appended a correction: an admin reconciling a game, or the copy that carries a recorded
// result its events do not explain.
export const STAT_CORRECTION_SOURCE_KEYS = ['admin', 'migration'] as const;
export type StatCorrectionSource = (typeof STAT_CORRECTION_SOURCE_KEYS)[number];

// The authority the writing core confirmed for an event: a global role, or a team role on one of
// the game's teams.
export const STAT_EVENT_AUTHORITY_KEYS = [...SYSTEM_ROLE_KEYS, ...CAPTAIN_TEAM_ROLES] as const;
export type StatEventAuthority = (typeof STAT_EVENT_AUTHORITY_KEYS)[number];

// Every kind of stat line: the four player kinds, then the two team kinds. A sport's line of each
// kind is declared once, in `SPORT_LINE_SCHEMAS`; a kind a sport has no line for is `never` there.
export const PLAYER_STAT_LINE_KIND_KEYS = [
  'gamePlayer',
  'membershipRow',
  'lifetime',
  'hallOfFame',
] as const;
export const TEAM_STAT_LINE_KIND_KEYS = ['gameTeam', 'teamSeason'] as const;
export const STAT_LINE_KIND_KEYS = [
  ...PLAYER_STAT_LINE_KIND_KEYS,
  ...TEAM_STAT_LINE_KIND_KEYS,
] as const;
export type StatLineKind = (typeof STAT_LINE_KIND_KEYS)[number];
export type PlayerStatLineKind = (typeof PLAYER_STAT_LINE_KIND_KEYS)[number];

// One logical run of a stats action, recorded on its `statsOperations` document.
export const STATS_OPERATION_KIND_KEYS = [
  'leagueStatsRebuild',
  'lifetimeStatsRebuild',
  'hallOfFameRebuild',
  'statsValidation',
  'gameStatsCorrection',
  'gameStatsRecalculation',
  'historicalStatsUpdate',
  'ghostPlayerStats',
  'gameDeletion',
] as const;
export type StatsOperationKind = (typeof STATS_OPERATION_KIND_KEYS)[number];

// The rebuilds: each replaces one destination from the finalized games, a unit at a time, and shares
// one paged run.
export const STATS_REBUILD_OPERATION_KIND_KEYS = [
  'leagueStatsRebuild',
  'lifetimeStatsRebuild',
  'hallOfFameRebuild',
] as const satisfies readonly StatsOperationKind[];
export type StatsRebuildOperationKind = (typeof STATS_REBUILD_OPERATION_KIND_KEYS)[number];

export const STATS_OPERATION_STATUS_KEYS = ['running', 'complete', 'stopped'] as const;
export type StatsOperationStatus = (typeof STATS_OPERATION_STATUS_KEYS)[number];

// A validation run checks every game first, then the destinations those games feed.
export const STATS_VALIDATION_PHASE_KEYS = ['games', 'destinations'] as const;
export type StatsValidationPhase = (typeof STATS_VALIDATION_PHASE_KEYS)[number];

// A ghost has one operation for both of its ways out, so a link and a removal refuse each other.
export const GHOST_STATS_OPERATION_ACTION_KEYS = ['link', 'removal'] as const;
export type GhostStatsOperationAction = (typeof GHOST_STATS_OPERATION_ACTION_KEYS)[number];

// Why a scoring write refused an event. The first ten are a sport adapter's `validate`; the last
// four are the store driver's own: an id already stored, or earlier in the batch, with different
// content; a void whose target is missing, a void, or a correction; a correction sent to a scoring
// entry, which only the game-reconcile core appends; and a void that would leave a stat below zero,
// because a later edit already moved its target's field down.
export const STAT_EVENT_REFUSAL_KEYS = [
  'eventTypeNotInSport',
  'teamNotInGame',
  'playerNotRostered',
  'assisterNotRostered',
  'assistNotAllowed',
  'playerNotAllowed',
  'roundNotNext',
  'roundsComplete',
  'bulkValueInvalid',
  'bulkStale',
  'eventIdConflict',
  'voidTargetNotSportEvent',
  'correctionNotAccepted',
  'undoBelowZero',
] as const;
export type StatEventRefusalCode = (typeof STAT_EVENT_REFUSAL_KEYS)[number];

// Why a game may not be finalized yet — a sport played in rounds with an end still unrecorded.
export const FINALIZATION_NOT_READY_KEYS = ['roundsIncomplete'] as const;
export type FinalizationNotReadyReason = (typeof FINALIZATION_NOT_READY_KEYS)[number];

// The scoring panel a sport's adapter names; the scoring screen renders one component per kind.
export const SCORING_PANEL_KIND_KEYS = ['playerEvents', 'teamPoints', 'rounds'] as const;
export type ScoringPanelKind = (typeof SCORING_PANEL_KIND_KEYS)[number];

// The bulk-entry form body a sport's adapter names; the bulk-entry dialog renders one per kind.
export const BULK_ENTRY_KIND_KEYS = ['playerLines', 'teamScores', 'rounds'] as const;
export type BulkEntryKind = (typeof BULK_ENTRY_KIND_KEYS)[number];

// What a scoring write did with each event it was sent: stored it now, or found it already stored
// by an earlier send and acknowledged it without applying it again.
export const RECORDED_STAT_EVENT_OUTCOME_KEYS = ['recorded', 'alreadyRecorded'] as const;
export type RecordedStatEventOutcome = (typeof RECORDED_STAT_EVENT_OUTCOME_KEYS)[number];

// What finalize did: made the game's numbers permanent, or found it already finalized and changed
// nothing (SPORT-203).
export const GAME_FINALIZE_OUTCOME_KEYS = ['finalized', 'alreadyFinalized'] as const;
export type GameFinalizeOutcome = (typeof GAME_FINALIZE_OUTCOME_KEYS)[number];

// What reopen did: took a finalized game's numbers back out, or found the game already open and
// changed nothing.
export const GAME_REOPEN_OUTCOME_KEYS = ['reopened', 'alreadyOpen'] as const;
export type GameReopenOutcome = (typeof GAME_REOPEN_OUTCOME_KEYS)[number];

// Why a path that makes numbers permanent, or takes them back, refused a game whose stored numbers
// disagree with what produced them — something changed them outside the app, and an admin
// reconciles the game in Fix stats first. Finalize, reopen, and a ghost link never adopt or discard
// an unexplained difference (ENG-009):
//   statsOutOfBand      the rollup or score mirror is not the replay of the game's events or record
//   finalRecordMissing  a completed game has no finalized record
//   aggregateBelowZero  a stored derived line holds less than the game put into it
export const STATS_INTEGRITY_REFUSAL_KEYS = [
  'statsOutOfBand',
  'finalRecordMissing',
  'aggregateBelowZero',
] as const;
export type StatsIntegrityRefusal = (typeof STATS_INTEGRITY_REFUSAL_KEYS)[number];

// What a game repair in Fix stats did: changed the game (`reconciled`), found nothing to change
// (`unchanged`), or found its operation already committed and acknowledged the retry
// (`alreadyApplied`).
export const GAME_STATS_REPAIR_OUTCOME_KEYS = [
  'reconciled',
  'unchanged',
  'alreadyApplied',
] as const;
export type GameStatsRepairOutcome = (typeof GAME_STATS_REPAIR_OUTCOME_KEYS)[number];

// Why a game repair in Fix stats was refused, in the refusal's details, so the form says what to do:
//   eventUnreadable     an event document no longer parses or replays — fix it in the console first
//   eventSequenceGap    the events do not hold exactly the sequences 1..n — a gap or a repeat — which
//                       a repair never renumbers: fix the event documents in the console first
//   sourcesDisagree     the record, the stored rollup, and the events all disagree: no one of them
//                       says what finalize applied
//   scoreAmbiguous      keep-stored: the team line's score and the score mirror were both edited, to
//                       different values — give the score as a target instead
//   fieldNotCorrectable a field the sport's adapter does not let a correction change — restore from
//                       the events instead, or reopen and re-score
//   lineNotRostered     a line for someone not on the game's roster
//   teamNotInGame       a target names a team the game does not hold
//   gameTooLarge        the repair would not fit in one commit
export const GAME_REPAIR_REFUSAL_KEYS = [
  'eventUnreadable',
  'eventSequenceGap',
  'sourcesDisagree',
  'scoreAmbiguous',
  'fieldNotCorrectable',
  'lineNotRostered',
  'teamNotInGame',
  'gameTooLarge',
] as const;
export type GameRepairRefusal = (typeof GAME_REPAIR_REFUSAL_KEYS)[number];

// What a ghost link did with the team's memberships: the ghost's membership became the account's
// (`handedOver`); the account had none and the ghost none either, so the closed-league link gave the
// account one (`created`); both held one and one survives with the higher role (`merged`); or only
// the account held one, and it stands (`kept`).
export const GHOST_LINK_MEMBERSHIP_OUTCOME_KEYS = [
  'handedOver',
  'created',
  'merged',
  'kept',
] as const;
export type GhostLinkMembershipOutcome = (typeof GHOST_LINK_MEMBERSHIP_OUTCOME_KEYS)[number];

// What the migration's placement of an unplaceable V1 stat line did: `alreadyResolved` when the game
// already held the entry it would write — nothing was written.
export const UNROSTERED_STAT_LINE_RESOLUTION_OUTCOME_KEYS = [
  'resolved',
  'alreadyResolved',
] as const;
export type UnrosteredStatLineResolutionOutcome =
  (typeof UNROSTERED_STAT_LINE_RESOLUTION_OUTCOME_KEYS)[number];

// Why a ghost's removal was refused, in the refusal's details, so the client answers each one: the
// ghost has played (link it instead) or its removal stopped on finding it had; a game the removal
// needs is held by another operation (try again shortly); the ghost is being, or was, linked; the
// ghost is the team's captain (change the captain first).
export const GHOST_REMOVAL_REFUSAL_KEYS = [
  'ghostHasPlayed',
  'removalStopped',
  'gameHeld',
  'ghostBeingLinked',
  'captainNotRemovable',
] as const;
export type GhostRemovalRefusal = (typeof GHOST_REMOVAL_REFUSAL_KEYS)[number];
