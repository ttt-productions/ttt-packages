import { z } from 'zod';
import {
  GHOST_LINK_MEMBERSHIP_OUTCOME_KEYS,
  STATS_OPERATION_STATUS_KEYS,
  STATS_VALIDATION_PHASE_KEYS,
} from '../types/stats.js';
import type { GhostStatsOperationAction, StatsOperationKind } from '../types/stats.js';
import {
  countSchema,
  epochMsSchema,
  gameIdSchema,
  leagueIdSchema,
  repairReasonSchema,
  sportKeySchema,
  teamIdSchema,
  userIdSchema,
} from './atoms.js';
import { StatsValidationScopeSchema } from './system.js';

export const StatsOperationCountsSchema = z.strictObject({
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
  stoppedOnGameIds: z.array(gameIdSchema),
};

const gameScope = z.strictObject({ gameId: gameIdSchema });

export const LeagueStatsRebuildOperationSchema = z.strictObject({
  ...rebuildFields,
  kind: z.literal('leagueStatsRebuild' satisfies StatsOperationKind),
  scope: z.strictObject({ leagueId: leagueIdSchema.optional() }),
});

export const LifetimeStatsRebuildOperationSchema = z.strictObject({
  ...rebuildFields,
  kind: z.literal('lifetimeStatsRebuild' satisfies StatsOperationKind),
  scope: z.strictObject({ userId: userIdSchema.optional() }),
});

export const HallOfFameRebuildOperationSchema = z.strictObject({
  ...rebuildFields,
  kind: z.literal('hallOfFameRebuild' satisfies StatsOperationKind),
  scope: z.strictObject({ sportKey: sportKeySchema, userId: userIdSchema.optional() }),
});

export const StatsValidationOperationSchema = z.strictObject({
  ...operationBase,
  kind: z.literal('statsValidation' satisfies StatsOperationKind),
  scope: StatsValidationScopeSchema,
  phase: z.enum(STATS_VALIDATION_PHASE_KEYS),
});

export const GameStatsCorrectionOperationSchema = z.strictObject({
  ...operationBase,
  kind: z.literal('gameStatsCorrection' satisfies StatsOperationKind),
  scope: gameScope,
  reason: repairReasonSchema,
});

export const GameStatsRecalculationOperationSchema = z.strictObject({
  ...operationBase,
  kind: z.literal('gameStatsRecalculation' satisfies StatsOperationKind),
  scope: gameScope,
  reason: repairReasonSchema,
});

export const HistoricalStatsUpdateOperationSchema = z.strictObject({
  ...operationBase,
  kind: z.literal('historicalStatsUpdate' satisfies StatsOperationKind),
  scope: z.strictObject({ userId: userIdSchema, sportKey: sportKeySchema }),
  reason: repairReasonSchema,
});

export const GhostRemovedFinishedEntrySchema = z.strictObject({
  gameId: gameIdSchema,
  wasAbsent: z.boolean(),
  wasNonScoring: z.boolean(),
});
export type GhostRemovedFinishedEntry = z.infer<typeof GhostRemovedFinishedEntrySchema>;

export const GhostLinkedGameSchema = z.strictObject({
  gameId: gameIdSchema,
  completed: z.boolean(),
  merged: z.boolean(),
});
export type GhostLinkedGame = z.infer<typeof GhostLinkedGameSchema>;

export const StatsDestinationChangeSchema = z.strictObject({
  ref: z.string().min(1),
  field: z.string().min(1),
  before: z.record(z.string(), z.number()).nullable(),
  after: z.record(z.string(), z.number()).nullable(),
});
export type StatsDestinationChange = z.infer<typeof StatsDestinationChangeSchema>;

export const GhostPlayerStatsOperationSchema = z
  .strictObject({
    ...operationBase,
    kind: z.literal('ghostPlayerStats' satisfies StatsOperationKind),
    scope: z.discriminatedUnion('action', [
      z.strictObject({
        action: z.literal('link' satisfies GhostStatsOperationAction),
        teamId: teamIdSchema,
        ghostUserId: userIdSchema,
        userId: userIdSchema,
      }),
      z.strictObject({
        action: z.literal('removal' satisfies GhostStatsOperationAction),
        teamId: teamIdSchema,
        ghostUserId: userIdSchema,
      }),
    ]),
    // Present only on an operation stored with a reason. A removal's is dropped on read; a link's
    // is kept, so its stored operation still resumes.
    reason: repairReasonSchema.optional(),
    removedFinishedGameEntries: z.array(GhostRemovedFinishedEntrySchema).optional(),
    linkedGames: z.array(GhostLinkedGameSchema).optional(),
    destinationChanges: z.array(StatsDestinationChangeSchema).optional(),
    membershipOutcome: z.enum(GHOST_LINK_MEMBERSHIP_OUTCOME_KEYS).optional(),
  })
  .overwrite((operation) => {
    if (operation.scope.action !== 'removal' || operation.reason === undefined) return operation;
    const { reason: _reason, ...withoutReason } = operation;
    return withoutReason;
  });
export type GhostPlayerStatsOperation = z.infer<typeof GhostPlayerStatsOperationSchema>;

export const GameDeletionOperationSchema = z.strictObject({
  ...operationBase,
  kind: z.literal('gameDeletion' satisfies StatsOperationKind),
  scope: gameScope,
});

export const StatsOperationSchema = z.discriminatedUnion('kind', [
  LeagueStatsRebuildOperationSchema,
  LifetimeStatsRebuildOperationSchema,
  HallOfFameRebuildOperationSchema,
  StatsValidationOperationSchema,
  GameStatsCorrectionOperationSchema,
  GameStatsRecalculationOperationSchema,
  HistoricalStatsUpdateOperationSchema,
  GhostPlayerStatsOperationSchema,
  GameDeletionOperationSchema,
]);
export type StatsOperation = z.infer<typeof StatsOperationSchema>;
