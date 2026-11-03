import { z } from 'zod';
import { CURLING_ROUND_COUNT, MAX_CURLING_ROUND_POINTS } from '../constants/sports.js';
import { parseStatsJobId } from '../ids/stats-ids.js';
import {
  countSchema,
  documentIdSegmentSchema,
  enteredStatCountSchema,
  epochMsSchema,
  gameIdSchema,
  gameRosterPlayerIdSchema,
  leagueIdSchema,
  sportKeySchema,
  statsOperationIdSchema,
  statsValidationReportIdSchema,
  teamIdSchema,
  userIdSchema,
} from '../doc-schemas/atoms.js';
import { StatsDestinationChangeSchema } from '../doc-schemas/stats-changes.js';
import {
  StatsValidationReportSchema,
  StatsValidationScopeSchema,
  StatsValidationSummarySchema,
} from '../doc-schemas/system.js';
import {
  HISTORICAL_STAT_KEYS,
  HistoricalStatsSchema,
  type HistoricalStats,
} from '../doc-schemas/user-profile.js';
import {
  GAME_FINALIZE_OUTCOME_KEYS,
  GAME_REOPEN_OUTCOME_KEYS,
  GAME_STATS_REPAIR_OUTCOME_KEYS,
  STATS_JOB_KIND_KEYS,
  STATS_JOB_STAGE_KEYS,
  STATS_JOB_STATE_KEYS,
  UNROSTERED_STAT_LINE_RESOLUTION_OUTCOME_KEYS,
} from '../types/stats.js';

export const UpdateSportGameFinalizeInputSchema = z.object({ gameId: gameIdSchema }).strict();
export type UpdateSportGameFinalizeInput = z.infer<typeof UpdateSportGameFinalizeInputSchema>;

export const UpdateSportGameFinalizeResultSchema = z
  .object({
    gameId: gameIdSchema,
    leagueId: leagueIdSchema,
    outcome: z.enum(GAME_FINALIZE_OUTCOME_KEYS),
    nonScoringRosterPlayerIds: z.array(gameRosterPlayerIdSchema),
  })
  .strict();
export type UpdateSportGameFinalizeResult = z.infer<typeof UpdateSportGameFinalizeResultSchema>;

export const AdminUpdateSportGameReopenInputSchema = z.object({ gameId: gameIdSchema }).strict();
export type AdminUpdateSportGameReopenInput = z.infer<typeof AdminUpdateSportGameReopenInputSchema>;

export const AdminUpdateSportGameReopenResultSchema = z
  .object({
    gameId: gameIdSchema,
    leagueId: leagueIdSchema,
    outcome: z.enum(GAME_REOPEN_OUTCOME_KEYS),
  })
  .strict();
export type AdminUpdateSportGameReopenResult = z.infer<
  typeof AdminUpdateSportGameReopenResultSchema
>;

export const AdminCreateGameRosterPlayerInputSchema = z
  .object({
    gameId: gameIdSchema,
    userId: userIdSchema,
    teamId: teamIdSchema,
    dryRun: z.boolean().optional(),
  })
  .strict();
export type AdminCreateGameRosterPlayerInput = z.infer<
  typeof AdminCreateGameRosterPlayerInputSchema
>;

export const AdminCreateGameRosterPlayerResultSchema = z
  .object({
    gameId: gameIdSchema,
    userId: userIdSchema,
    teamId: teamIdSchema,
    outcome: z.enum(UNROSTERED_STAT_LINE_RESOLUTION_OUTCOME_KEYS),
    gameConverts: z.boolean(),
  })
  .strict();
export type AdminCreateGameRosterPlayerResult = z.infer<
  typeof AdminCreateGameRosterPlayerResultSchema
>;

const statsRepairFields = {
  operationId: statsOperationIdSchema,
  dryRun: z.boolean(),
};

export const AdminUpdateSportLeagueStatsRecalculateInputSchema = z
  .object({ leagueId: leagueIdSchema, ...statsRepairFields })
  .strict();
export type AdminUpdateSportLeagueStatsRecalculateInput = z.infer<
  typeof AdminUpdateSportLeagueStatsRecalculateInputSchema
>;

export const AdminUpdateUserProfileStatsRecalculateInputSchema = z
  .object({ userId: userIdSchema, ...statsRepairFields })
  .strict();
export type AdminUpdateUserProfileStatsRecalculateInput = z.infer<
  typeof AdminUpdateUserProfileStatsRecalculateInputSchema
>;

export const StatsRebuildResultSchema = z
  .object({
    operationId: statsOperationIdSchema,
    dryRun: z.boolean(),
    changes: z.array(StatsDestinationChangeSchema),
    changesTruncated: z.boolean(),
  })
  .strict();
export type StatsRebuildResult = z.infer<typeof StatsRebuildResultSchema>;

const statsJobRequestIdSchema = z.uuid();

const statsJobIdSchema = documentIdSegmentSchema.refine(
  (id) => parseStatsJobId(id) !== null,
  'Not a stats job id.',
);

export const AdminCreateStatsJobInputSchema = z
  .object({ requestId: statsJobRequestIdSchema })
  .strict();
export type AdminCreateStatsJobInput = z.infer<typeof AdminCreateStatsJobInputSchema>;

export const AdminCreateStatsJobResultSchema = z.object({ jobId: statsJobIdSchema }).strict();
export type AdminCreateStatsJobResult = z.infer<typeof AdminCreateStatsJobResultSchema>;

export const AdminGetStatsJobInputSchema = z.object({ kind: z.enum(STATS_JOB_KIND_KEYS) }).strict();
export type AdminGetStatsJobInput = z.infer<typeof AdminGetStatsJobInputSchema>;

export const StatsJobProgressSchema = z
  .object({
    jobId: statsJobIdSchema,
    kind: z.enum(STATS_JOB_KIND_KEYS),
    state: z.enum(STATS_JOB_STATE_KEYS),
    stage: z.enum(STATS_JOB_STAGE_KEYS),
    stageDone: countSchema,
    changed: countSchema,
    deadLettered: z.boolean(),
    completedAt: epochMsSchema.nullable(),
  })
  .strict();
export type StatsJobProgress = z.infer<typeof StatsJobProgressSchema>;

export const AdminGetStatsJobResultSchema = z
  .object({ job: StatsJobProgressSchema.nullable() })
  .strict();
export type AdminGetStatsJobResult = z.infer<typeof AdminGetStatsJobResultSchema>;

export const AdminUpdateSportGameStatsRecalculateInputSchema = z
  .object({ gameId: gameIdSchema, ...statsRepairFields })
  .strict();
export type AdminUpdateSportGameStatsRecalculateInput = z.infer<
  typeof AdminUpdateSportGameStatsRecalculateInputSchema
>;

const roundSlotValueSchema = z.number().int().min(0).max(MAX_CURLING_ROUND_POINTS).nullable();

// Two team lines of a game, each holding its sport's fixed round slots.
const MAX_ROUND_SLOT_CHANGES = 2 * CURLING_ROUND_COUNT;

const replacedEntryListSchema = z
  .object({ stored: z.array(gameRosterPlayerIdSchema), rebuilt: z.array(gameRosterPlayerIdSchema) })
  .strict();

export const GameRepairChangesSchema = z
  .object({
    lines: z.array(
      z
        .object({
          lineKey: z.string().min(1),
          field: z.string().min(1),
          stored: z.number(),
          rebuilt: z.number(),
        })
        .strict(),
    ),
    scores: z.array(
      z.object({ teamId: teamIdSchema, stored: z.number(), rebuilt: z.number() }).strict(),
    ),
    // Present when a round slot changed: each changed slot of a line, a null slot unplayed.
    roundSlots: z
      .array(
        z
          .object({
            lineKey: z.string().min(1),
            slotIndex: z
              .number()
              .int()
              .min(0)
              .max(CURLING_ROUND_COUNT - 1),
            stored: roundSlotValueSchema,
            rebuilt: roundSlotValueSchema,
          })
          .strict(),
      )
      .min(1)
      .max(MAX_ROUND_SLOT_CHANGES)
      .optional(),
    absentRosterPlayerIds: replacedEntryListSchema.optional(),
    nonScoringRosterPlayerIds: replacedEntryListSchema.optional(),
    statEventSequence: z.object({ stored: countSchema, rebuilt: countSchema }).strict().optional(),
    recordRewritten: z.literal(true).optional(),
  })
  .strict();
export type GameRepairChanges = z.infer<typeof GameRepairChangesSchema>;

export const GameStatsRepairResultSchema = z
  .object({
    gameId: gameIdSchema,
    leagueId: leagueIdSchema,
    operationId: statsOperationIdSchema,
    dryRun: z.boolean(),
    outcome: z.enum(GAME_STATS_REPAIR_OUTCOME_KEYS),
    gameChanged: z.boolean(),
    gameChanges: GameRepairChangesSchema,
    destinationChanges: z.array(StatsDestinationChangeSchema),
  })
  .strict();
export type GameStatsRepairResult = z.infer<typeof GameStatsRepairResultSchema>;

const EnteredHistoricalStatsSchema = z
  .object(
    Object.fromEntries(HISTORICAL_STAT_KEYS.map((key) => [key, enteredStatCountSchema])) as Record<
      keyof HistoricalStats,
      typeof enteredStatCountSchema
    >,
  )
  .strict();

export const AdminUpdateHistoricalStatInputSchema = z
  .object({
    userId: userIdSchema,
    sportKey: sportKeySchema,
    stats: EnteredHistoricalStatsSchema,
    operationId: statsOperationIdSchema,
    dryRun: z.boolean(),
  })
  .strict();
export type AdminUpdateHistoricalStatInput = z.infer<typeof AdminUpdateHistoricalStatInputSchema>;

export const AdminUpdateHistoricalStatResultSchema = z
  .object({
    userId: userIdSchema,
    sportKey: sportKeySchema,
    operationId: statsOperationIdSchema,
    dryRun: z.boolean(),
    outcome: z.enum(GAME_STATS_REPAIR_OUTCOME_KEYS),
    baselineBefore: HistoricalStatsSchema.nullable(),
    changes: z.array(StatsDestinationChangeSchema),
  })
  .strict();
export type AdminUpdateHistoricalStatResult = z.infer<typeof AdminUpdateHistoricalStatResultSchema>;

export const AdminCreateStatsValidationReportInputSchema = z
  .object({
    scope: StatsValidationScopeSchema.strict(),
    requestId: statsJobRequestIdSchema.optional(),
  })
  .strict()
  .refine(
    (input) =>
      (input.requestId !== undefined) ===
      (input.scope.gameId === undefined && input.scope.leagueId === undefined),
    { message: 'A check of everything, and only that, carries a request id.', path: ['requestId'] },
  );
export type AdminCreateStatsValidationReportInput = z.infer<
  typeof AdminCreateStatsValidationReportInputSchema
>;

export const AdminCreateStatsValidationReportResultSchema = z
  .object({
    reportId: statsValidationReportIdSchema,
    jobId: statsJobIdSchema.optional(),
    complete: z.boolean(),
    summary: StatsValidationSummarySchema,
    discrepancyCounts: StatsValidationReportSchema.shape.discrepancyCounts,
  })
  .strict();
export type AdminCreateStatsValidationReportResult = z.infer<
  typeof AdminCreateStatsValidationReportResultSchema
>;

export const AdminDeleteStatsValidationReportInputSchema = z
  .object({ reportId: statsValidationReportIdSchema })
  .strict();
export type AdminDeleteStatsValidationReportInput = z.infer<
  typeof AdminDeleteStatsValidationReportInputSchema
>;

export const AdminDeleteStatsValidationReportResultSchema = z
  .object({ reportId: statsValidationReportIdSchema })
  .strict();
export type AdminDeleteStatsValidationReportResult = z.infer<
  typeof AdminDeleteStatsValidationReportResultSchema
>;
