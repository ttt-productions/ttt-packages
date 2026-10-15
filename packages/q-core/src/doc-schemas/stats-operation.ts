// `statsOperations/{operationId}` — one logical run of a stats action: a rebuild, a validation, a
// game's correction or recalculation, a historical-baseline update, a ghost's stats half, or a game
// deletion. The stats cores write it in the same commit as each page it records, so an interrupted
// run resumes the same operation instead of starting a second one, and a retried single-game action
// finds its operation `complete` and is acknowledged.
//
// It is also the hold on a game: while a multi-page operation works a game, the game's
// `statsOperationId` names this document, and every other writer of that game refuses it.
//
// The id is minted by the client when the admin starts the action, except two the server derives: a
// ghost's, from the team and the ghost, so a ghost has one operation for its links and its removal;
// and a game deletion's, from the game (`buildGameDeletionOperationId`).
// Admin read; written only by the stats cores.

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
  // The last document id a paged run finished; absent before its first page.
  resumeAfter: z.string().min(1).optional(),
  counts: StatsOperationCountsSchema,
};

// A rebuild replaces a destination whole and never rebuilds from a game whose record disagrees with
// its rollup; it names each such game and rebuilds everything that game does not feed.
const rebuildFields = {
  ...operationBase,
  reason: repairReasonSchema,
  stoppedOnGameIds: z.array(gameIdSchema),
};

const gameScope = z.strictObject({ gameId: gameIdSchema });

export const LeagueStatsRebuildOperationSchema = z.strictObject({
  ...rebuildFields,
  kind: z.literal('leagueStatsRebuild' satisfies StatsOperationKind),
  // Absent: every league.
  scope: z.strictObject({ leagueId: leagueIdSchema.optional() }),
});

export const LifetimeStatsRebuildOperationSchema = z.strictObject({
  ...rebuildFields,
  kind: z.literal('lifetimeStatsRebuild' satisfies StatsOperationKind),
  // Absent: every user.
  scope: z.strictObject({ userId: userIdSchema.optional() }),
});

export const HallOfFameRebuildOperationSchema = z.strictObject({
  ...rebuildFields,
  kind: z.literal('hallOfFameRebuild' satisfies StatsOperationKind),
  // Absent user: the whole sport.
  scope: z.strictObject({ sportKey: sportKeySchema, userId: userIdSchema.optional() }),
});

// A validation writes no stat, so it takes no reason.
export const StatsValidationOperationSchema = z.strictObject({
  ...operationBase,
  kind: z.literal('statsValidation' satisfies StatsOperationKind),
  // One game, one league, or — with neither — everything.
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

// One completed game a never-played ghost's removal took the ghost's entry off, with what the stored
// participation decision said of the entry before: absent, and credited no game played. The per-game
// transaction that removes the entry records it, so the removal's audit event names every one.
export const GhostRemovedFinishedEntrySchema = z.strictObject({
  gameId: gameIdSchema,
  wasAbsent: z.boolean(),
  wasNonScoring: z.boolean(),
});
export type GhostRemovedFinishedEntry = z.infer<typeof GhostRemovedFinishedEntrySchema>;

// One game a ghost link moved the ghost's entry on, whether the game was completed when it did, and
// whether the account already held an entry there that the ghost's merged into. The per-game
// transaction records it, so the link's audit event names every one.
export const GhostLinkedGameSchema = z.strictObject({
  gameId: gameIdSchema,
  completed: z.boolean(),
  merged: z.boolean(),
});
export type GhostLinkedGame = z.infer<typeof GhostLinkedGameSchema>;

// One derived line a stats action moved — a team's standings line, a per-membership row, a lifetime
// line, or a hall-of-fame entry — with its value before the action's first change to it and after
// its latest, `null` where there was or is no line. Every repair's audit event records them, and a
// dry run lists them without writing (BACKEND-212).
export const StatsDestinationChangeSchema = z.strictObject({
  ref: z.string().min(1),
  field: z.string().min(1),
  before: z.record(z.string(), z.number()).nullable(),
  after: z.record(z.string(), z.number()).nullable(),
});
export type StatsDestinationChange = z.infer<typeof StatsDestinationChangeSchema>;

// The ghost's one operation records the account a link chose, or the removal, so a call naming a
// different account — or a removal against a link — is refused, and the same call resumes. Neither
// takes a reason: a link is chosen and confirmed, and its audit event records who linked which ghost
// to whom and what moved (BACKEND-212).
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
    // A reason stored by a link or a removal recorded while they still took one; no operation
    // writes one now. A removal's is dropped on read; a link's is kept, so its stored operation
    // still resumes.
    reason: repairReasonSchema.optional(),
    // A removal's finished-game entries, in the order it removed them; absent on a link.
    removedFinishedGameEntries: z.array(GhostRemovedFinishedEntrySchema).optional(),
    // A link's games moved so far, in the order it moved them, and every derived line it changed;
    // absent on a removal.
    linkedGames: z.array(GhostLinkedGameSchema).optional(),
    destinationChanges: z.array(StatsDestinationChangeSchema).optional(),
    // What a completed link did with the team's memberships, so a call after completion answers it.
    membershipOutcome: z.enum(GHOST_LINK_MEMBERSHIP_OUTCOME_KEYS).optional(),
  })
  .overwrite((operation) => {
    if (operation.scope.action !== 'removal' || operation.reason === undefined) return operation;
    const { reason: _reason, ...withoutReason } = operation;
    return withoutReason;
  });
export type GhostPlayerStatsOperation = z.infer<typeof GhostPlayerStatsOperationSchema>;

// A game deletion pages out the game's events and roster under the hold and removes the game
// document last; running it again on a held game continues it.
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
