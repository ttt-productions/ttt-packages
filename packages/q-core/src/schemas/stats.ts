import { z } from 'zod';
import { MAX_GAME_STATS_CORRECTION_TARGETS } from '../constants/sports.js';
import {
  countSchema,
  gameIdSchema,
  gameRosterPlayerIdSchema,
  leagueIdSchema,
  repairReasonSchema,
  sportKeySchema,
  statCounterKeySchema,
  statsOperationIdSchema,
  statsValidationReportIdSchema,
  teamIdSchema,
  userIdSchema,
} from '../doc-schemas/atoms.js';
import {
  StatsDestinationChangeSchema,
  StatsOperationCountsSchema,
} from '../doc-schemas/stats-operation.js';
import {
  StatsValidationReportSchema,
  StatsValidationScopeSchema,
  StatsValidationSummarySchema,
} from '../doc-schemas/system.js';
import { HistoricalStatsSchema } from '../doc-schemas/user-profile.js';
import {
  GAME_FINALIZE_OUTCOME_KEYS,
  GAME_REOPEN_OUTCOME_KEYS,
  GAME_STATS_REPAIR_OUTCOME_KEYS,
  UNROSTERED_STAT_LINE_RESOLUTION_OUTCOME_KEYS,
} from '../types/stats.js';

export const FinalizeGameInputSchema = z.object({ gameId: gameIdSchema }).strict();
export type FinalizeGameInput = z.infer<typeof FinalizeGameInputSchema>;

export const FinalizeGameResultSchema = z
  .object({
    gameId: gameIdSchema,
    leagueId: leagueIdSchema,
    outcome: z.enum(GAME_FINALIZE_OUTCOME_KEYS),
    nonScoringRosterPlayerIds: z.array(gameRosterPlayerIdSchema),
  })
  .strict();
export type FinalizeGameResult = z.infer<typeof FinalizeGameResultSchema>;

export const ReopenGameInputSchema = z
  .object({ gameId: gameIdSchema, reason: repairReasonSchema })
  .strict();
export type ReopenGameInput = z.infer<typeof ReopenGameInputSchema>;

export const ReopenGameResultSchema = z
  .object({
    gameId: gameIdSchema,
    leagueId: leagueIdSchema,
    outcome: z.enum(GAME_REOPEN_OUTCOME_KEYS),
  })
  .strict();
export type ReopenGameResult = z.infer<typeof ReopenGameResultSchema>;

export const AdminResolveUnrosteredStatLineInputSchema = z
  .object({
    gameId: gameIdSchema,
    userId: userIdSchema,
    teamId: teamIdSchema,
    reason: repairReasonSchema,
    dryRun: z.boolean().optional(),
  })
  .strict();
export type AdminResolveUnrosteredStatLineInput = z.infer<
  typeof AdminResolveUnrosteredStatLineInputSchema
>;

export const AdminResolveUnrosteredStatLineResultSchema = z
  .object({
    gameId: gameIdSchema,
    userId: userIdSchema,
    teamId: teamIdSchema,
    outcome: z.enum(UNROSTERED_STAT_LINE_RESOLUTION_OUTCOME_KEYS),
    gameConverts: z.boolean(),
  })
  .strict();
export type AdminResolveUnrosteredStatLineResult = z.infer<
  typeof AdminResolveUnrosteredStatLineResultSchema
>;

const statsRepairFields = {
  reason: repairReasonSchema,
  operationId: statsOperationIdSchema,
  dryRun: z.boolean(),
  resumeAfter: z.string().min(1).optional(),
};

const cursorOnlyOnDryRun = (input: { dryRun: boolean; resumeAfter?: string }): boolean =>
  input.dryRun || input.resumeAfter === undefined;
const CURSOR_ONLY_ON_DRY_RUN = {
  message: 'A real run resumes from its operation; only a dry run takes a cursor.',
  path: ['resumeAfter'],
};

export const RecalculateLeagueStatsInputSchema = z
  .object({ leagueId: leagueIdSchema, ...statsRepairFields })
  .strict()
  .refine(cursorOnlyOnDryRun, CURSOR_ONLY_ON_DRY_RUN);
export type RecalculateLeagueStatsInput = z.infer<typeof RecalculateLeagueStatsInputSchema>;

export const RecalculateAllLeagueStatsInputSchema = z
  .object({ ...statsRepairFields })
  .strict()
  .refine(cursorOnlyOnDryRun, CURSOR_ONLY_ON_DRY_RUN);
export type RecalculateAllLeagueStatsInput = z.infer<typeof RecalculateAllLeagueStatsInputSchema>;

export const RecalculateUserStatsInputSchema = z
  .object({ userId: userIdSchema, ...statsRepairFields })
  .strict()
  .refine(cursorOnlyOnDryRun, CURSOR_ONLY_ON_DRY_RUN);
export type RecalculateUserStatsInput = z.infer<typeof RecalculateUserStatsInputSchema>;

export const RecalculateAllUserStatsInputSchema = z
  .object({ ...statsRepairFields })
  .strict()
  .refine(cursorOnlyOnDryRun, CURSOR_ONLY_ON_DRY_RUN);
export type RecalculateAllUserStatsInput = z.infer<typeof RecalculateAllUserStatsInputSchema>;

export const RecalculateHallOfFameInputSchema = z
  .object({ sportKey: sportKeySchema, userId: userIdSchema.optional(), ...statsRepairFields })
  .strict()
  .refine(cursorOnlyOnDryRun, CURSOR_ONLY_ON_DRY_RUN);
export type RecalculateHallOfFameInput = z.infer<typeof RecalculateHallOfFameInputSchema>;

export const StatsRebuildResultSchema = z
  .object({
    operationId: statsOperationIdSchema,
    dryRun: z.boolean(),
    complete: z.boolean(),
    nextResumeAfter: z.string().min(1).nullable(),
    counts: StatsOperationCountsSchema,
    stoppedOnGameIds: z.array(gameIdSchema),
    changes: z.array(StatsDestinationChangeSchema),
    changesTruncated: z.boolean(),
    scopeChanged: z.boolean(),
  })
  .strict();
export type StatsRebuildResult = z.infer<typeof StatsRebuildResultSchema>;

export const GameStatsCorrectionTargetSchema = z
  .object({
    teamId: teamIdSchema,
    playerUserId: userIdSchema.optional(),
    stat: statCounterKeySchema,
    value: countSchema,
  })
  .strict();
export type GameStatsCorrectionTarget = z.infer<typeof GameStatsCorrectionTargetSchema>;

export const AdminCorrectGameStatsInputSchema = z
  .object({
    gameId: gameIdSchema,
    targets: z
      .array(GameStatsCorrectionTargetSchema)
      .min(1)
      .max(MAX_GAME_STATS_CORRECTION_TARGETS)
      .optional(),
    keepStored: z.literal(true).optional(),
    reason: repairReasonSchema,
    operationId: statsOperationIdSchema,
    dryRun: z.boolean(),
  })
  .strict()
  .refine((input) => (input.targets === undefined) !== (input.keepStored === undefined), {
    message: 'Give the values to set, or keep the stored numbers — one of the two.',
    path: ['targets'],
  });
export type AdminCorrectGameStatsInput = z.infer<typeof AdminCorrectGameStatsInputSchema>;

export const RecalculateGameStatsInputSchema = z
  .object({
    gameId: gameIdSchema,
    reason: repairReasonSchema,
    operationId: statsOperationIdSchema,
    dryRun: z.boolean(),
  })
  .strict();
export type RecalculateGameStatsInput = z.infer<typeof RecalculateGameStatsInputSchema>;

export const GameStatsCorrectionSchema = z
  .object({ lineKey: z.string().min(1), field: statCounterKeySchema, value: z.number().int() })
  .strict();
export type GameStatsCorrection = z.infer<typeof GameStatsCorrectionSchema>;

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
    absentRosterPlayerIds: replacedEntryListSchema.optional(),
    nonScoringRosterPlayerIds: replacedEntryListSchema.optional(),
    statEventSequence: z.object({ stored: countSchema, rebuilt: countSchema }).strict().optional(),
    recordRewritten: z
      .object({ pagesBefore: countSchema, pagesAfter: countSchema })
      .strict()
      .optional(),
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
    corrections: z.array(GameStatsCorrectionSchema),
    gameChanged: z.boolean(),
    gameChanges: GameRepairChangesSchema,
    destinationChanges: z.array(StatsDestinationChangeSchema),
  })
  .strict();
export type GameStatsRepairResult = z.infer<typeof GameStatsRepairResultSchema>;

export const AdminUpdateHistoricalStatsInputSchema = z
  .object({
    userId: userIdSchema,
    sportKey: sportKeySchema,
    stats: HistoricalStatsSchema,
    reason: repairReasonSchema,
    operationId: statsOperationIdSchema,
    dryRun: z.boolean(),
  })
  .strict();
export type AdminUpdateHistoricalStatsInput = z.infer<typeof AdminUpdateHistoricalStatsInputSchema>;

export const AdminUpdateHistoricalStatsResultSchema = z
  .object({
    userId: userIdSchema,
    sportKey: sportKeySchema,
    operationId: statsOperationIdSchema,
    dryRun: z.boolean(),
    outcome: z.enum(GAME_STATS_REPAIR_OUTCOME_KEYS),
    baselineBefore: HistoricalStatsSchema.nullable(),
    stoppedOnGameIds: z.array(gameIdSchema),
    changes: z.array(StatsDestinationChangeSchema),
  })
  .strict();
export type AdminUpdateHistoricalStatsResult = z.infer<
  typeof AdminUpdateHistoricalStatsResultSchema
>;

export const RunStatsValidationInputSchema = z
  .object({ operationId: statsOperationIdSchema, scope: StatsValidationScopeSchema })
  .strict();
export type RunStatsValidationInput = z.infer<typeof RunStatsValidationInputSchema>;

export const RunStatsValidationResultSchema = z
  .object({
    reportId: z.string().min(1),
    complete: z.boolean(),
    summary: StatsValidationSummarySchema,
    discrepancyCounts: StatsValidationReportSchema.shape.discrepancyCounts,
  })
  .strict();
export type RunStatsValidationResult = z.infer<typeof RunStatsValidationResultSchema>;

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
