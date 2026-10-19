// The vocabulary of the console's recorded state: whether the destinations still belong to the
// migration, where a run stands, and the bounds on what a run keeps.

/**
 * Whether the V2 destinations still hold migration output only (`preCutover`) or belong to the
 * running product (`live`). The console resolves it from its own recorded cutover marker, never from
 * operator input: every copy refuses a live destination, and every verification holds what the
 * product edits to its schema only once the destination is live.
 */
export const MIGRATION_DESTINATION_STATE_KEYS = ['preCutover', 'live'] as const;
export type MigrationDestinationState = (typeof MIGRATION_DESTINATION_STATE_KEYS)[number];
export const PRE_CUTOVER_DESTINATION_STATE =
  'preCutover' as const satisfies MigrationDestinationState;
export const LIVE_DESTINATION_STATE = 'live' as const satisfies MigrationDestinationState;

/** Where one run of an action stands: still paging, at its end, or stopped by a refusal or a fault. */
export const MIGRATION_RUN_STATUS_KEYS = ['running', 'complete', 'stopped'] as const;
export type MigrationRunStatus = (typeof MIGRATION_RUN_STATUS_KEYS)[number];

/** The most documents one page of any action reads; each core refuses less where it must. */
export const MAX_MIGRATION_PAGE_SIZE = 500;

/**
 * The findings a run keeps on its record — the first skipped, missing, or mismatched documents it
 * met. Every page's full list is in that page's answer; the record counts the rest.
 */
export const MAX_MIGRATION_RUN_FINDINGS = 50;

/** The longest text a finding or a stop reason keeps. */
export const MAX_MIGRATION_FINDING_TEXT_LENGTH = 500;

/** What a record call did: recorded the step, or found it already recorded with the same evidence. */
export const MIGRATION_RECORD_OUTCOME_KEYS = ['recorded', 'alreadyRecorded'] as const;
export type MigrationRecordOutcome = (typeof MIGRATION_RECORD_OUTCOME_KEYS)[number];
