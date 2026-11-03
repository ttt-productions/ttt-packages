import { z } from 'zod';
import {
  CURLING_ROUND_COUNT,
  MAX_CURLING_ROUND_POINTS,
  MAX_GAME_STATS_CORRECTION_TARGETS,
} from '../constants/sports.js';
import {
  countSchema,
  enteredStatCountSchema,
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
import {
  HISTORICAL_STAT_KEYS,
  HistoricalStatsSchema,
  type HistoricalStats,
} from '../doc-schemas/user-profile.js';
import {
  GAME_FINALIZE_OUTCOME_KEYS,
  GAME_REOPEN_OUTCOME_KEYS,
  GAME_STATS_REPAIR_OUTCOME_KEYS,
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

export const AdminUpdateSportGameReopenInputSchema = z
  .object({ gameId: gameIdSchema, reason: repairReasonSchema })
  .strict();
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
    reason: repairReasonSchema,
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

export const AdminUpdateSportLeagueStatsRecalculateInputSchema = z
  .object({ leagueId: leagueIdSchema, ...statsRepairFields })
  .strict()
  .refine(cursorOnlyOnDryRun, CURSOR_ONLY_ON_DRY_RUN);
export type AdminUpdateSportLeagueStatsRecalculateInput = z.infer<
  typeof AdminUpdateSportLeagueStatsRecalculateInputSchema
>;

export const RecalculateAllLeagueStatsInputSchema = z
  .object({ ...statsRepairFields })
  .strict()
  .refine(cursorOnlyOnDryRun, CURSOR_ONLY_ON_DRY_RUN);
export type RecalculateAllLeagueStatsInput = z.infer<typeof RecalculateAllLeagueStatsInputSchema>;

export const AdminUpdateUserProfileStatsRecalculateInputSchema = z
  .object({ userId: userIdSchema, ...statsRepairFields })
  .strict()
  .refine(cursorOnlyOnDryRun, CURSOR_ONLY_ON_DRY_RUN);
export type AdminUpdateUserProfileStatsRecalculateInput = z.infer<
  typeof AdminUpdateUserProfileStatsRecalculateInputSchema
>;

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
    value: enteredStatCountSchema,
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

export const AdminUpdateSportGameStatsRecalculateInputSchema = z
  .object({
    gameId: gameIdSchema,
    reason: repairReasonSchema,
    operationId: statsOperationIdSchema,
    dryRun: z.boolean(),
  })
  .strict();
export type AdminUpdateSportGameStatsRecalculateInput = z.infer<
  typeof AdminUpdateSportGameStatsRecalculateInputSchema
>;

export const GameStatsCorrectionSchema = z
  .object({ lineKey: z.string().min(1), field: statCounterKeySchema, value: z.number().int() })
  .strict();
export type GameStatsCorrection = z.infer<typeof GameStatsCorrectionSchema>;

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
    corrections: z.array(GameStatsCorrectionSchema),
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
    reason: repairReasonSchema,
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
  .object({ operationId: statsOperationIdSchema, scope: StatsValidationScopeSchema.strict() })
  .strict();
export type AdminCreateStatsValidationReportInput = z.infer<
  typeof AdminCreateStatsValidationReportInputSchema
>;

export const AdminCreateStatsValidationReportResultSchema = z
  .object({
    reportId: z.string().min(1),
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
