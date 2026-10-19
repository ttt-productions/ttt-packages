// Callable contracts for the stats pipeline: finalize, reopen, the Fix stats actions — the rebuilds,
// the game repairs, the historical baseline, the stats check, and deleting a check's report — and the
// migration's placement of
// an unplaceable stat line.

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
import { StatsDestinationChangeSchema, StatsOperationCountsSchema } from '../doc-schemas/stats-operation.js';
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

// `finalizeGame` (a captain or co-captain of either team) / `adminFinalizeGame` (an admin or a
// referee): make a game's numbers permanent. Everything it writes is derived server-side from the
// game's events; nothing in the input is a number (SPORT-202).
export const FinalizeGameInputSchema = z.object({ gameId: gameIdSchema }).strict();
export type FinalizeGameInput = z.infer<typeof FinalizeGameInputSchema>;

// `alreadyFinalized` when the game was completed before the call: nothing was written (SPORT-203).
export const FinalizeGameResultSchema = z
  .object({
    gameId: gameIdSchema,
    leagueId: leagueIdSchema,
    outcome: z.enum(GAME_FINALIZE_OUTCOME_KEYS),
    nonScoringRosterPlayerIds: z.array(gameRosterPlayerIdSchema),
  })
  .strict();
export type FinalizeGameResult = z.infer<typeof FinalizeGameResultSchema>;

// `reopenGame` (an admin): take a finalized game's numbers back out so it can be scored again. It
// changes a completed record, so the admin says why (SPORT-206, BACKEND-212).
export const ReopenGameInputSchema = z.object({ gameId: gameIdSchema, reason: repairReasonSchema }).strict();
export type ReopenGameInput = z.infer<typeof ReopenGameInputSchema>;

// `alreadyOpen` when the game was not completed: nothing was written.
export const ReopenGameResultSchema = z
  .object({ gameId: gameIdSchema, leagueId: leagueIdSchema, outcome: z.enum(GAME_REOPEN_OUTCOME_KEYS) })
  .strict();
export type ReopenGameResult = z.infer<typeof ReopenGameResultSchema>;

// `resolve.unrosteredStatLine` (an admin, at the cutover console, before the cutover): a recorded V1
// stat line that no roster entry and no play of the game can place is placed on the team the admin
// names, as the game's missing roster entry; the game's copy is then run again. The admin says why.
// `dryRun` previews the placement — whether the game would then convert — and writes nothing.
export const AdminResolveUnrosteredStatLineInputSchema = z
  .object({
    gameId: gameIdSchema,
    userId: userIdSchema,
    teamId: teamIdSchema,
    reason: repairReasonSchema,
    dryRun: z.boolean().optional(),
  })
  .strict();
export type AdminResolveUnrosteredStatLineInput = z.infer<typeof AdminResolveUnrosteredStatLineInputSchema>;

// `gameConverts` says whether the game's stats now convert, so the operator knows the copy can run.
export const AdminResolveUnrosteredStatLineResultSchema = z
  .object({
    gameId: gameIdSchema,
    userId: userIdSchema,
    teamId: teamIdSchema,
    outcome: z.enum(UNROSTERED_STAT_LINE_RESOLUTION_OUTCOME_KEYS),
    gameConverts: z.boolean(),
  })
  .strict();
export type AdminResolveUnrosteredStatLineResult = z.infer<typeof AdminResolveUnrosteredStatLineResultSchema>;

// Every rebuild and every game repair is a repair of a completed record: it takes a reason, runs
// under an operation id the admin's browser mints when the admin starts it, and offers a dry run that
// lists each document it would change, with before and after, and writes nothing (BACKEND-212,
// SPORT-206). A real run resumes from its operation document, so a cursor is taken from the client
// only to page a dry run, which keeps no operation.
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

// `recalculateLeagueStats`: every team of one league — its standings line and its per-membership rows.
export const RecalculateLeagueStatsInputSchema = z
  .object({ leagueId: leagueIdSchema, ...statsRepairFields })
  .strict()
  .refine(cursorOnlyOnDryRun, CURSOR_ONLY_ON_DRY_RUN);
export type RecalculateLeagueStatsInput = z.infer<typeof RecalculateLeagueStatsInputSchema>;

// `recalculateAllLeagueStats`: every league, closed ones included, a page of leagues per call.
export const RecalculateAllLeagueStatsInputSchema = z
  .object({ ...statsRepairFields })
  .strict()
  .refine(cursorOnlyOnDryRun, CURSOR_ONLY_ON_DRY_RUN);
export type RecalculateAllLeagueStatsInput = z.infer<typeof RecalculateAllLeagueStatsInputSchema>;

// `recalculateUserStats`: one person's career line in every sport.
export const RecalculateUserStatsInputSchema = z
  .object({ userId: userIdSchema, ...statsRepairFields })
  .strict()
  .refine(cursorOnlyOnDryRun, CURSOR_ONLY_ON_DRY_RUN);
export type RecalculateUserStatsInput = z.infer<typeof RecalculateUserStatsInputSchema>;

// `recalculateAllUserStats`: every profile's career lines, a page of profiles per call.
export const RecalculateAllUserStatsInputSchema = z
  .object({ ...statsRepairFields })
  .strict()
  .refine(cursorOnlyOnDryRun, CURSOR_ONLY_ON_DRY_RUN);
export type RecalculateAllUserStatsInput = z.infer<typeof RecalculateAllUserStatsInputSchema>;

// `recalculateHallOfFame`: one sport's hall of fame — one person's entry, or the whole sport a page
// of profiles per call. Refused for a sport that keeps none.
export const RecalculateHallOfFameInputSchema = z
  .object({ sportKey: sportKeySchema, userId: userIdSchema.optional(), ...statsRepairFields })
  .strict()
  .refine(cursorOnlyOnDryRun, CURSOR_ONLY_ON_DRY_RUN);
export type RecalculateHallOfFameInput = z.infer<typeof RecalculateHallOfFameInputSchema>;

// What one call of a rebuild did. `complete` is false while a paged rebuild has pages left: the
// admin calls again with the same operation id — or, for a dry run, with `resumeAfter` set to
// `nextResumeAfter`. `changes` is every document this call changed or, on a dry run, would change,
// up to MAX_STATS_REPAIR_LISTED_CHANGES (`changesTruncated` says more were left out). A game whose
// stored numbers disagree with its record is named in `stoppedOnGameIds`, and what it feeds is left
// untouched. `scopeChanged` says a game was finalized or reopened in the scope while it ran, so the
// admin runs it again.
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

// A line a correction sets, by its absolute value: the team line of `teamId`, or the player line
// `{teamId}_{playerUserId}` when a player is named. Only a field the sport's adapter lists in
// `correctableFields` may be set.
export const GameStatsCorrectionTargetSchema = z
  .object({
    teamId: teamIdSchema,
    playerUserId: userIdSchema.optional(),
    stat: statCounterKeySchema,
    value: countSchema,
  })
  .strict();
export type GameStatsCorrectionTarget = z.infer<typeof GameStatsCorrectionTargetSchema>;

// `adminCorrectGameStats`: set named fields of a game's lines to the values given, or keep the
// numbers the game stores now — a hand edit made outside the app — as corrections. Exactly one of the
// two.
export const AdminCorrectGameStatsInputSchema = z
  .object({
    gameId: gameIdSchema,
    targets: z.array(GameStatsCorrectionTargetSchema).min(1).max(MAX_GAME_STATS_CORRECTION_TARGETS).optional(),
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

// `recalculateGameStats`: restore a game's numbers from its events, discarding a hand edit.
export const RecalculateGameStatsInputSchema = z
  .object({
    gameId: gameIdSchema,
    reason: repairReasonSchema,
    operationId: statsOperationIdSchema,
    dryRun: z.boolean(),
  })
  .strict();
export type RecalculateGameStatsInput = z.infer<typeof RecalculateGameStatsInputSchema>;

// One correction a repair appended, or on a dry run would append.
export const GameStatsCorrectionSchema = z
  .object({ lineKey: z.string().min(1), field: statCounterKeySchema, value: z.number().int() })
  .strict();
export type GameStatsCorrection = z.infer<typeof GameStatsCorrectionSchema>;

// A list of roster entries a repair replaced, as the game stored it and as the repair rebuilds it.
const replacedEntryListSchema = z
  .object({ stored: z.array(gameRosterPlayerIdSchema), rebuilt: z.array(gameRosterPlayerIdSchema) })
  .strict();

// Every value of the game document a repair changed, each with the value the game stored and the
// value the repair writes — never the whole document (BACKEND-212). `lines` holds each changed field
// of a team or player line (`lineKey` the team id or the roster entry id), `scores` each team whose
// score mirror changed, and the lists, the event counter and `recordRewritten` appear only when the
// repair changes them; `recordRewritten` names the finalized record's page counts before and after,
// without copying the record.
export const GameRepairChangesSchema = z
  .object({
    lines: z.array(
      z.object({ lineKey: z.string().min(1), field: z.string().min(1), stored: z.number(), rebuilt: z.number() }).strict(),
    ),
    scores: z.array(z.object({ teamId: teamIdSchema, stored: z.number(), rebuilt: z.number() }).strict()),
    absentRosterPlayerIds: replacedEntryListSchema.optional(),
    nonScoringRosterPlayerIds: replacedEntryListSchema.optional(),
    statEventSequence: z.object({ stored: countSchema, rebuilt: countSchema }).strict().optional(),
    recordRewritten: z.object({ pagesBefore: countSchema, pagesAfter: countSchema }).strict().optional(),
  })
  .strict();
export type GameRepairChanges = z.infer<typeof GameRepairChangesSchema>;

// What a game repair did: `reconciled` it changed the game; `unchanged` there was nothing to change;
// `alreadyApplied` the operation had already committed and this call is its acknowledged retry.
// `gameChanges` is what it changed on the game document, or on a dry run would change; empty lists
// for any other outcome.
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

// `adminUpdateHistoricalStats`: a person's pre-Q-Sports career totals for a sport that takes them,
// written whole, and their career line and hall-of-fame entry rebuilt with them.
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
export type AdminUpdateHistoricalStatsResult = z.infer<typeof AdminUpdateHistoricalStatsResultSchema>;

// `runStatsValidation`: check one game, one league, or — with neither — everything. A check that
// reaches its time budget saves its place on its operation and answers `complete: false`; calling
// again with the same operation id resumes it. It writes no stat, so it takes no reason.
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

// `adminDeleteStatsValidationReport`: delete one stats check's report. It writes no stat, so it takes
// no reason; a report that is not there is refused as not found.
export const AdminDeleteStatsValidationReportInputSchema = z
  .object({ reportId: statsValidationReportIdSchema })
  .strict();
export type AdminDeleteStatsValidationReportInput = z.infer<typeof AdminDeleteStatsValidationReportInputSchema>;

export const AdminDeleteStatsValidationReportResultSchema = z
  .object({ reportId: statsValidationReportIdSchema })
  .strict();
export type AdminDeleteStatsValidationReportResult = z.infer<typeof AdminDeleteStatsValidationReportResultSchema>;
