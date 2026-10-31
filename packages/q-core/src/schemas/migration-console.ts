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
import {
  MAX_MIGRATION_PAGE_SIZE,
  MIGRATION_RECORD_OUTCOME_KEYS,
} from '../migration-console/run-state.js';
import type { ExecutableMigrationStep } from '../migration-console/manifest.js';
import {
  countSchema,
  epochMsSchema,
  repairReasonSchema,
  statsOperationIdSchema,
} from '../doc-schemas/atoms.js';

export const MAX_RECORDED_OPERATION_IDS = 10;

export const RunMigrationActionInputSchema = z
  .object({
    operationId: migrationOperationIdSchema,
    reason: repairReasonSchema,
    dryRun: z.boolean(),
    pageSize: z.number().int().min(1).max(MAX_MIGRATION_PAGE_SIZE),
    expectEmptySource: z.boolean().optional(),
    acknowledgeUnexaminedSources: z.boolean().optional(),
  })
  .strict();
export type RunMigrationActionInput = z.infer<typeof RunMigrationActionInputSchema>;

// Keeps the wire bound of every action and adds the chosen action's own ceiling.
export function migrationPageSizeSchema(step: Pick<ExecutableMigrationStep, 'maxPageSize'>) {
  return RunMigrationActionInputSchema.shape.pageSize.max(step.maxPageSize);
}

export const MigrationActionPageResultSchema = z
  .object({
    actionId: migrationActionIdSchema,
    operationId: migrationOperationIdSchema,
    dryRun: z.boolean(),
    read: countSchema,
    written: countSchema,
    skipped: countSchema,
    checked: countSchema,
    missing: countSchema,
    mismatched: countSchema,
    details: z.record(z.string().min(1), countSchema),
    findings: z.array(MigrationFindingSchema),
    nextResumeAfter: z.string().min(1).nullable(),
    complete: z.boolean(),
    run: MigrationRunRecordSchema,
  })
  .strict();
export type MigrationActionPageResult = z.infer<typeof MigrationActionPageResultSchema>;

export const GetMigrationConsoleInputSchema = z.object({}).strict();
export type GetMigrationConsoleInput = z.infer<typeof GetMigrationConsoleInputSchema>;

export const MigrationStepStateSchema = z
  .object({
    actionId: migrationActionIdSchema,
    unlocked: z.boolean(),
    satisfied: z.boolean(),
    waitingOn: z.array(migrationActionIdSchema),
    previewCurrent: z.boolean(),
    record: MigrationActionRunSchema.nullable(),
  })
  .strict();
export type MigrationStepState = z.infer<typeof MigrationStepStateSchema>;

export const GetMigrationConsoleResultSchema = z
  .object({
    console: MigrationConsoleSchema,
    steps: z.array(MigrationStepStateSchema),
    readAt: epochMsSchema,
  })
  .strict();
export type GetMigrationConsoleResult = z.infer<typeof GetMigrationConsoleResultSchema>;

export const RecordMigrationControlRunInputSchema = z
  .object({
    actionId: migrationActionIdSchema,
    operationIds: z.array(statsOperationIdSchema).max(MAX_RECORDED_OPERATION_IDS),
    reason: repairReasonSchema,
  })
  .strict();
export type RecordMigrationControlRunInput = z.infer<typeof RecordMigrationControlRunInputSchema>;

export const RecordMigrationCheckpointInputSchema = z
  .object({
    actionId: migrationActionIdSchema,
    evidence: migrationEvidenceSchema,
  })
  .strict();
export type RecordMigrationCheckpointInput = z.infer<typeof RecordMigrationCheckpointInputSchema>;

export const RecordMigrationCutoverInputSchema = z.object({ reason: repairReasonSchema }).strict();
export type RecordMigrationCutoverInput = z.infer<typeof RecordMigrationCutoverInputSchema>;

export const RecordMigrationStepResultSchema = z
  .object({
    actionId: migrationActionIdSchema,
    outcome: z.enum(MIGRATION_RECORD_OUTCOME_KEYS),
    record: MigrationActionRunSchema,
  })
  .strict();
export type RecordMigrationStepResult = z.infer<typeof RecordMigrationStepResultSchema>;
