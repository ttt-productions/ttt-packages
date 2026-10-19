// The migration console's callables. Every one is admin-only, asking its auth gate for admin.
//
// Each executable cutover action has its own callable (`MigrationStep.callable`), and every one of
// them takes `RunMigrationActionInputSchema` and answers `MigrationActionPageResultSchema` — one page
// per call. The console holds each run's resume key itself, so a browser that lost its place resumes
// the same logical run by sending the same operation id; a new operation id starts the action over.
// The line resolution is the one action with its own input (`AdminResolveUnrosteredStatLineInputSchema`).

import { z } from 'zod';
import {
  MigrationActionRunSchema,
  MigrationConsoleSchema,
  MigrationFindingSchema,
  MigrationRunRecordSchema,
  migrationActionIdSchema,
  migrationEvidenceSchema,
  migrationOperationIdSchema,
} from '../doc-schemas/migration-console.js';
import { MAX_MIGRATION_PAGE_SIZE, MIGRATION_RECORD_OUTCOME_KEYS } from '../migration-console/run-state.js';
import {
  countSchema,
  epochMsSchema,
  repairReasonSchema,
  statsOperationIdSchema,
} from '../doc-schemas/atoms.js';

// The operation ids a product control's record names: one per sport for the hall of fame, one
// otherwise, none for a control that writes no operation.
const MAX_RECORDED_OPERATION_IDS = 10;

/** One page of an executable action. */
export const RunMigrationActionInputSchema = z
  .object({
    operationId: migrationOperationIdSchema,
    // Required on every page (BACKEND-212); the run keeps the one its first page gave.
    reason: repairReasonSchema,
    // A preview: read, transform, and report, writing nothing. A verification only reads either way.
    dryRun: z.boolean(),
    pageSize: z.number().int().min(1).max(MAX_MIGRATION_PAGE_SIZE),
    // A verification's declaration, read at the run's first page, that its source really is empty —
    // without it a sweep that checked nothing does not pass.
    expectEmptySource: z.boolean().optional(),
    // `verify.v1Pictures` only, read at the run's first page: the operator, having reviewed them,
    // acknowledges the picture sources the verification cannot examine — in another bucket (every
    // source, in a rehearsal, which copies Firestore only), or every one on a page unavailable or
    // refused — so they are reported instead of failing the run. Any other action refuses it.
    acknowledgeUnexaminedSources: z.boolean().optional(),
  })
  .strict();
export type RunMigrationActionInput = z.infer<typeof RunMigrationActionInputSchema>;

/** What one page did, and the run it belongs to as recorded after it. */
export const MigrationActionPageResultSchema = z
  .object({
    actionId: migrationActionIdSchema,
    operationId: migrationOperationIdSchema,
    dryRun: z.boolean(),
    // The page's own counts; a write action fills read, written, and skipped, a verification checked,
    // missing, and mismatched.
    read: countSchema,
    written: countSchema,
    skipped: countSchema,
    checked: countSchema,
    missing: countSchema,
    mismatched: countSchema,
    details: z.record(z.string().min(1), countSchema),
    // Every document the page reported, in full.
    findings: z.array(MigrationFindingSchema),
    nextResumeAfter: z.string().min(1).nullable(),
    // The run reached its end with this page.
    complete: z.boolean(),
    run: MigrationRunRecordSchema,
  })
  .strict();
export type MigrationActionPageResult = z.infer<typeof MigrationActionPageResultSchema>;

/** The console as it stands: the marker, the lock, and every step's recorded state. */
export const GetMigrationConsoleInputSchema = z.object({}).strict();
export type GetMigrationConsoleInput = z.infer<typeof GetMigrationConsoleInputSchema>;

export const MigrationStepStateSchema = z
  .object({
    actionId: migrationActionIdSchema,
    // Every dependency satisfied: the step may run.
    unlocked: z.boolean(),
    // The step itself is satisfied for its dependents.
    satisfied: z.boolean(),
    // A dependency not yet satisfied, each named.
    waitingOn: z.array(migrationActionIdSchema),
    // Its latest preview reached its end since its dependencies were last done: a step that removes
    // data starts a new run only then.
    previewCurrent: z.boolean(),
    record: MigrationActionRunSchema.nullable(),
  })
  .strict();
export type MigrationStepState = z.infer<typeof MigrationStepStateSchema>;

export const GetMigrationConsoleResultSchema = z
  .object({
    console: MigrationConsoleSchema,
    // In cutover order, one per manifest step.
    steps: z.array(MigrationStepStateSchema),
    readAt: epochMsSchema,
  })
  .strict();
export type GetMigrationConsoleResult = z.infer<typeof GetMigrationConsoleResultSchema>;

/** A product control's run, recorded once the console has checked its evidence. */
export const RecordMigrationControlRunInputSchema = z
  .object({
    actionId: migrationActionIdSchema,
    operationIds: z.array(statsOperationIdSchema).max(MAX_RECORDED_OPERATION_IDS),
    reason: repairReasonSchema,
  })
  .strict();
export type RecordMigrationControlRunInput = z.infer<typeof RecordMigrationControlRunInputSchema>;

/** An operator checkpoint, recorded with the operator's evidence. */
export const RecordMigrationCheckpointInputSchema = z
  .object({
    actionId: migrationActionIdSchema,
    evidence: migrationEvidenceSchema,
  })
  .strict();
export type RecordMigrationCheckpointInput = z.infer<typeof RecordMigrationCheckpointInputSchema>;

/** The cutover: from here on the product owns every destination. */
export const RecordMigrationCutoverInputSchema = z
  .object({ reason: repairReasonSchema })
  .strict();
export type RecordMigrationCutoverInput = z.infer<typeof RecordMigrationCutoverInputSchema>;

/** What a record call answers: the step as now recorded. A second identical record changes nothing. */
export const RecordMigrationStepResultSchema = z
  .object({
    actionId: migrationActionIdSchema,
    outcome: z.enum(MIGRATION_RECORD_OUTCOME_KEYS),
    record: MigrationActionRunSchema,
  })
  .strict();
export type RecordMigrationStepResult = z.infer<typeof RecordMigrationStepResultSchema>;
