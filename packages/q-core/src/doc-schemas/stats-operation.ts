import { z } from 'zod';
import { STATS_OPERATION_STATUS_KEYS, STATS_VALIDATION_PHASE_KEYS } from '../types/stats.js';
import type { StatsOperationKind } from '../types/stats.js';
import {
  countSchema,
  epochMsSchema,
  gameIdSchema,
  leagueIdSchema,
  repairReasonSchema,
  sportKeySchema,
  userIdSchema,
} from './atoms.js';
import { StatsValidationScopeSchema } from './system.js';

export const StatsOperationCountsSchema = z.object({
  read: countSchema,
  changed: countSchema,
  skipped: countSchema,
});
export type StatsOperationCounts = z.infer<typeof StatsOperationCountsSchema>;

const operationBase = {
  startedByUserId: userIdSchema,
  startedAt: epochMsSchema,
  updatedAt: epochMsSchema,
  status: z.enum(STATS_OPERATION_STATUS_KEYS),
  resumeAfter: z.string().min(1).optional(),
  counts: StatsOperationCountsSchema,
};

const rebuildFields = {
  ...operationBase,
  reason: repairReasonSchema,
};

const gameScope = z.object({ gameId: gameIdSchema });

// `hashStatsOperationRequest` of the values the operation was opened with. Optional: an operation
// stored before it existed still resumes.
const requestHashSchema = z.string().regex(/^[0-9a-f]{64}$/);

export const LeagueStatsRebuildOperationSchema = z.object({
  ...rebuildFields,
  kind: z.literal('leagueStatsRebuild' satisfies StatsOperationKind),
  scope: z.object({ leagueId: leagueIdSchema.optional() }),
});

export const LifetimeStatsRebuildOperationSchema = z.object({
  ...rebuildFields,
  kind: z.literal('lifetimeStatsRebuild' satisfies StatsOperationKind),
  scope: z.object({ userId: userIdSchema.optional() }),
});

export const HallOfFameRebuildOperationSchema = z.object({
  ...rebuildFields,
  kind: z.literal('hallOfFameRebuild' satisfies StatsOperationKind),
  scope: z.object({ sportKey: sportKeySchema, userId: userIdSchema.optional() }),
});

export const StatsValidationOperationSchema = z.object({
  ...operationBase,
  kind: z.literal('statsValidation' satisfies StatsOperationKind),
  scope: StatsValidationScopeSchema,
  phase: z.enum(STATS_VALIDATION_PHASE_KEYS),
});

export const GameStatsCorrectionOperationSchema = z.object({
  ...operationBase,
  kind: z.literal('gameStatsCorrection' satisfies StatsOperationKind),
  scope: gameScope,
  reason: repairReasonSchema,
  requestHash: requestHashSchema.optional(),
});

export const GameStatsRecalculationOperationSchema = z.object({
  ...operationBase,
  kind: z.literal('gameStatsRecalculation' satisfies StatsOperationKind),
  scope: gameScope,
  reason: repairReasonSchema,
});

export const HistoricalStatsUpdateOperationSchema = z.object({
  ...operationBase,
  kind: z.literal('historicalStatsUpdate' satisfies StatsOperationKind),
  scope: z.object({ userId: userIdSchema, sportKey: sportKeySchema }),
  reason: repairReasonSchema,
  requestHash: requestHashSchema.optional(),
});

export const GhostRemovedFinishedEntrySchema = z.object({
  gameId: gameIdSchema,
  wasAbsent: z.boolean(),
  wasNonScoring: z.boolean(),
});
export type GhostRemovedFinishedEntry = z.infer<typeof GhostRemovedFinishedEntrySchema>;

export const GhostLinkedGameSchema = z.object({
  gameId: gameIdSchema,
  completed: z.boolean(),
  merged: z.boolean(),
});
export type GhostLinkedGame = z.infer<typeof GhostLinkedGameSchema>;

export const StatsDestinationChangeSchema = z.object({
  ref: z.string().min(1),
  field: z.string().min(1),
  before: z.record(z.string(), z.number()).nullable(),
  after: z.record(z.string(), z.number()).nullable(),
});
export type StatsDestinationChange = z.infer<typeof StatsDestinationChangeSchema>;

export const StatsOperationSchema = z.discriminatedUnion('kind', [
  LeagueStatsRebuildOperationSchema,
  LifetimeStatsRebuildOperationSchema,
  HallOfFameRebuildOperationSchema,
  StatsValidationOperationSchema,
  GameStatsCorrectionOperationSchema,
  GameStatsRecalculationOperationSchema,
  HistoricalStatsUpdateOperationSchema,
]);
export type StatsOperation = z.infer<typeof StatsOperationSchema>;
