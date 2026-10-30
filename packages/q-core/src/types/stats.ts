import { CAPTAIN_TEAM_ROLES, SYSTEM_ROLE_KEYS } from './unions.js';

export const STAT_VOID_EVENT_TYPE = 'STAT_VOID';
export const STAT_CORRECTION_EVENT_TYPE = 'STAT_CORRECTION';
export const STAT_STORE_EVENT_TYPE_KEYS = [
  STAT_VOID_EVENT_TYPE,
  STAT_CORRECTION_EVENT_TYPE,
] as const;
export type StatStoreEventType = (typeof STAT_STORE_EVENT_TYPE_KEYS)[number];

export const STAT_EVENT_RECORDER_FIELD_KEYS = [
  'sequence',
  'acceptedAt',
  'recordedByUserId',
  'recordedByAuthority',
  'recordedByTeamId',
] as const;
export type StatEventRecorderField = (typeof STAT_EVENT_RECORDER_FIELD_KEYS)[number];

export const STAT_EVENT_SNAPSHOT_FIELD_KEYS = [
  'displayNameSnapshot',
  'assistedByDisplayNameSnapshot',
] as const;
export type StatEventSnapshotField = (typeof STAT_EVENT_SNAPSHOT_FIELD_KEYS)[number];

export const STAT_CORRECTION_SOURCE_KEYS = ['admin', 'migration'] as const;
export type StatCorrectionSource = (typeof STAT_CORRECTION_SOURCE_KEYS)[number];

export const STAT_EVENT_AUTHORITY_KEYS = [...SYSTEM_ROLE_KEYS, ...CAPTAIN_TEAM_ROLES] as const;
export type StatEventAuthority = (typeof STAT_EVENT_AUTHORITY_KEYS)[number];

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

export const STATS_REBUILD_OPERATION_KIND_KEYS = [
  'leagueStatsRebuild',
  'lifetimeStatsRebuild',
  'hallOfFameRebuild',
] as const satisfies readonly StatsOperationKind[];
export type StatsRebuildOperationKind = (typeof STATS_REBUILD_OPERATION_KIND_KEYS)[number];

export const STATS_OPERATION_STATUS_KEYS = ['running', 'complete', 'stopped'] as const;
export type StatsOperationStatus = (typeof STATS_OPERATION_STATUS_KEYS)[number];

export const STATS_VALIDATION_PHASE_KEYS = ['games', 'destinations'] as const;
export type StatsValidationPhase = (typeof STATS_VALIDATION_PHASE_KEYS)[number];

export const GHOST_STATS_OPERATION_ACTION_KEYS = ['link', 'removal'] as const;
export type GhostStatsOperationAction = (typeof GHOST_STATS_OPERATION_ACTION_KEYS)[number];

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

export const FINALIZATION_NOT_READY_KEYS = ['roundsIncomplete'] as const;
export type FinalizationNotReadyReason = (typeof FINALIZATION_NOT_READY_KEYS)[number];

export const SCORING_PANEL_KIND_KEYS = ['playerEvents', 'teamPoints', 'rounds'] as const;
export type ScoringPanelKind = (typeof SCORING_PANEL_KIND_KEYS)[number];

export const BULK_ENTRY_KIND_KEYS = ['playerLines', 'teamScores', 'rounds'] as const;
export type BulkEntryKind = (typeof BULK_ENTRY_KIND_KEYS)[number];

export const RECORDED_STAT_EVENT_OUTCOME_KEYS = ['recorded', 'alreadyRecorded'] as const;
export type RecordedStatEventOutcome = (typeof RECORDED_STAT_EVENT_OUTCOME_KEYS)[number];

export const GAME_FINALIZE_OUTCOME_KEYS = ['finalized', 'alreadyFinalized'] as const;
export type GameFinalizeOutcome = (typeof GAME_FINALIZE_OUTCOME_KEYS)[number];

export const GAME_REOPEN_OUTCOME_KEYS = ['reopened', 'alreadyOpen'] as const;
export type GameReopenOutcome = (typeof GAME_REOPEN_OUTCOME_KEYS)[number];

export const STATS_INTEGRITY_REFUSAL_KEYS = [
  'statsOutOfBand',
  'finalRecordMissing',
  'aggregateBelowZero',
] as const;
export type StatsIntegrityRefusal = (typeof STATS_INTEGRITY_REFUSAL_KEYS)[number];

export const GAME_STATS_REPAIR_OUTCOME_KEYS = [
  'reconciled',
  'unchanged',
  'alreadyApplied',
] as const;
export type GameStatsRepairOutcome = (typeof GAME_STATS_REPAIR_OUTCOME_KEYS)[number];

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

export const GHOST_LINK_MEMBERSHIP_OUTCOME_KEYS = [
  'handedOver',
  'created',
  'merged',
  'kept',
] as const;
export type GhostLinkMembershipOutcome = (typeof GHOST_LINK_MEMBERSHIP_OUTCOME_KEYS)[number];

export const UNROSTERED_STAT_LINE_RESOLUTION_OUTCOME_KEYS = [
  'resolved',
  'alreadyResolved',
] as const;
export type UnrosteredStatLineResolutionOutcome =
  (typeof UNROSTERED_STAT_LINE_RESOLUTION_OUTCOME_KEYS)[number];

export const GHOST_REMOVAL_REFUSAL_KEYS = [
  'ghostHasPlayed',
  'removalStopped',
  'gameHeld',
  'ghostBeingLinked',
  'captainNotRemovable',
] as const;
export type GhostRemovalRefusal = (typeof GHOST_REMOVAL_REFUSAL_KEYS)[number];
