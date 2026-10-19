// The migration console's recorded state — admin read, written only by the console's callables.
//
// `_serverData/migrationConsole` holds the cutover marker and the lock: one action runs at a time, and
// whether the destinations are still the migration's is recorded here, never taken from the
// operator. `migrationActionRuns/{actionId}` holds each step's latest real run — the one its
// dependents read — its latest preview, and, for a recorded step, what was recorded.

import { z } from 'zod';
import { MIGRATION_EVIDENCE_INPUT_FORMAT } from '../input-formats/input-formats.js';
import { MIGRATION_ACTION_ID_KEYS } from '../migration-console/action-ids.js';
import {
  MAX_MIGRATION_FINDING_TEXT_LENGTH,
  MAX_MIGRATION_RUN_FINDINGS,
  MIGRATION_DESTINATION_STATE_KEYS,
  MIGRATION_RUN_STATUS_KEYS,
} from '../migration-console/run-state.js';
import {
  countSchema,
  documentIdSegmentSchema,
  epochMsSchema,
  repairReasonSchema,
  statsOperationIdSchema,
  textFieldSchema,
  userIdSchema,
} from './atoms.js';

export const migrationActionIdSchema = z.enum(MIGRATION_ACTION_ID_KEYS);
export const migrationDestinationStateSchema = z.enum(MIGRATION_DESTINATION_STATE_KEYS);
/** One logical run of an action, minted by the admin's browser when the admin starts it. */
export const migrationOperationIdSchema = documentIdSegmentSchema;
/** What the operator records as proof of a step the console cannot see done. */
export const migrationEvidenceSchema = textFieldSchema(MIGRATION_EVIDENCE_INPUT_FORMAT);

const findingText = z.string().max(MAX_MIGRATION_FINDING_TEXT_LENGTH);

/**
 * One document an action reported: skipped by a copy, missing or mismatched in a verification, or
 * named by one of an action's own report lists (a merged pair, a created roster entry, a ghost's
 * disposition) — `category` names which.
 */
export const MigrationFindingSchema = z.strictObject({
  category: z.string().min(1).max(64),
  id: findingText,
  field: findingText,
  reason: findingText,
});
export type MigrationFinding = z.infer<typeof MigrationFindingSchema>;

/** A run's totals across its pages. A write action fills the first three, a verification the next three. */
export const MigrationRunCountsSchema = z.strictObject({
  read: countSchema,
  written: countSchema,
  skipped: countSchema,
  checked: countSchema,
  missing: countSchema,
  mismatched: countSchema,
});
export type MigrationRunCounts = z.infer<typeof MigrationRunCountsSchema>;

export const MigrationRunRecordSchema = z.strictObject({
  operationId: migrationOperationIdSchema,
  dryRun: z.boolean(),
  reason: repairReasonSchema,
  startedByUserId: userIdSchema,
  startedAt: epochMsSchema,
  updatedAt: epochMsSchema,
  // Set with `complete`: the moment the run reached its end.
  completedAt: epochMsSchema.optional(),
  status: z.enum(MIGRATION_RUN_STATUS_KEYS),
  pages: countSchema,
  // The resume key of the next page, or null once the run reached its end.
  nextResumeAfter: z.string().min(1).nullable(),
  counts: MigrationRunCountsSchema,
  // An action's own counters beyond the shared ones — merged pairs, corrections by field, kept
  // ghosts by disposition — summed across pages.
  details: z.record(z.string().min(1), countSchema),
  findings: z.array(MigrationFindingSchema).max(MAX_MIGRATION_RUN_FINDINGS),
  // Findings met past the kept ones; each page's answer carried them in full.
  findingsNotKept: countSchema,
  // A verification run declared, at its start, that its source is empty.
  expectEmptySource: z.boolean(),
  // A `verify.v1Pictures` run acknowledged, at its start, the sources it cannot examine.
  acknowledgeUnexaminedSources: z.boolean().optional(),
  // Why a stopped run stopped: the refusal its core gave.
  stoppedReason: findingText.optional(),
});
export type MigrationRunRecord = z.infer<typeof MigrationRunRecordSchema>;

/** A product control's run, an operator checkpoint, or the cutover, as recorded. */
export const MigrationStepRecordSchema = z.strictObject({
  recordedAt: epochMsSchema,
  recordedByUserId: userIdSchema,
  // A product control's runs, whose evidence the console checked.
  operationIds: z.array(statsOperationIdSchema).optional(),
  // An operator checkpoint's evidence, or a recorded step's reason.
  evidence: migrationEvidenceSchema,
});
export type MigrationStepRecord = z.infer<typeof MigrationStepRecordSchema>;

export const MigrationActionRunSchema = z.strictObject({
  actionId: migrationActionIdSchema,
  // The latest real run: what every dependent and every gate reads.
  run: MigrationRunRecordSchema.optional(),
  // The latest dry run, kept apart so a preview never stands in for a run.
  preview: MigrationRunRecordSchema.optional(),
  recorded: MigrationStepRecordSchema.optional(),
});
export type MigrationActionRun = z.infer<typeof MigrationActionRunSchema>;

/** The one action holding the console, until its lease runs out. */
export const MigrationConsoleLockSchema = z.strictObject({
  actionId: migrationActionIdSchema,
  operationId: migrationOperationIdSchema,
  heldByUserId: userIdSchema,
  expiresAt: epochMsSchema,
  // Present while one page of the run is in flight: the moment its claim was stamped, and that
  // page's fencing token. Only the page holding this exact token records its result or releases the
  // lock; any other page, the same run's included, is refused while it stands. A lock stored
  // without one has no page in flight.
  pageClaimedAt: epochMsSchema.optional(),
});
export type MigrationConsoleLock = z.infer<typeof MigrationConsoleLockSchema>;

export const MigrationConsoleSchema = z.strictObject({
  destinationState: migrationDestinationStateSchema,
  cutoverRecordedAt: epochMsSchema.optional(),
  cutoverRecordedByUserId: userIdSchema.optional(),
  lock: MigrationConsoleLockSchema.nullable(),
  updatedAt: epochMsSchema,
});
export type MigrationConsole = z.infer<typeof MigrationConsoleSchema>;
