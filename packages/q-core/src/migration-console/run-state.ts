export const MIGRATION_DESTINATION_STATE_KEYS = ['preCutover', 'live'] as const;
export type MigrationDestinationState = (typeof MIGRATION_DESTINATION_STATE_KEYS)[number];
export const PRE_CUTOVER_DESTINATION_STATE =
  'preCutover' as const satisfies MigrationDestinationState;
export const LIVE_DESTINATION_STATE = 'live' as const satisfies MigrationDestinationState;

export const MIGRATION_RUN_STATUS_KEYS = ['running', 'complete', 'stopped'] as const;
export type MigrationRunStatus = (typeof MIGRATION_RUN_STATUS_KEYS)[number];

export const MAX_MIGRATION_PAGE_SIZE = 500;

export const MAX_MIGRATION_RUN_FINDINGS = 50;

export const MAX_MIGRATION_FINDING_TEXT_LENGTH = 500;

export const MIGRATION_RECORD_OUTCOME_KEYS = ['recorded', 'alreadyRecorded'] as const;
export type MigrationRecordOutcome = (typeof MIGRATION_RECORD_OUTCOME_KEYS)[number];
