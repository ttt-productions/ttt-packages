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
export const migrationOperationIdSchema = documentIdSegmentSchema;
export const migrationEvidenceSchema = textFieldSchema(MIGRATION_EVIDENCE_INPUT_FORMAT);

const findingText = z.string().max(MAX_MIGRATION_FINDING_TEXT_LENGTH);

export const MigrationFindingSchema = z.strictObject({
  category: z.string().min(1).max(64),
  id: findingText,
  field: findingText,
  reason: findingText,
});
export type MigrationFinding = z.infer<typeof MigrationFindingSchema>;

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
  completedAt: epochMsSchema.optional(),
  status: z.enum(MIGRATION_RUN_STATUS_KEYS),
  pages: countSchema,
  nextResumeAfter: z.string().min(1).nullable(),
  counts: MigrationRunCountsSchema,
  details: z.record(z.string().min(1), countSchema),
  findings: z.array(MigrationFindingSchema).max(MAX_MIGRATION_RUN_FINDINGS),
  findingsNotKept: countSchema,
  expectEmptySource: z.boolean(),
  acknowledgeUnexaminedSources: z.boolean().optional(),
  stoppedReason: findingText.optional(),
});
export type MigrationRunRecord = z.infer<typeof MigrationRunRecordSchema>;

export const MigrationStepRecordSchema = z.strictObject({
  recordedAt: epochMsSchema,
  recordedByUserId: userIdSchema,
  operationIds: z.array(statsOperationIdSchema).optional(),
  evidence: migrationEvidenceSchema,
});
export type MigrationStepRecord = z.infer<typeof MigrationStepRecordSchema>;

export const MigrationActionRunSchema = z.strictObject({
  actionId: migrationActionIdSchema,
  run: MigrationRunRecordSchema.optional(),
  preview: MigrationRunRecordSchema.optional(),
  recorded: MigrationStepRecordSchema.optional(),
});
export type MigrationActionRun = z.infer<typeof MigrationActionRunSchema>;

export const MigrationConsoleLockSchema = z.strictObject({
  actionId: migrationActionIdSchema,
  operationId: migrationOperationIdSchema,
  heldByUserId: userIdSchema,
  expiresAt: epochMsSchema,
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
