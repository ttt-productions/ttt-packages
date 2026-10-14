// Fixed-ID system documents in the underscore buckets, plus the derived stat documents. Every one
// is callable-only for writes.

import { z } from 'zod';
import {
  MAX_ANNOUNCEMENT_MESSAGE_LENGTH,
  MAX_APP_VERSION_LENGTH,
  MAX_LANDING_ABOUT_TEXT_LENGTH,
  MAX_LANDING_HERO_TITLE_LENGTH,
  MAX_MAINTENANCE_MESSAGE_LENGTH,
} from '../constants/business.js';
import { MAX_STATS_VALIDATION_DISCREPANCIES } from '../constants/sports.js';
import { GallerySummarySchema } from './gallery.js';
import {
  countSchema,
  epochMsSchema,
  gameIdSchema,
  leagueIdSchema,
  statsBeaconActionSchema,
  statsDiscrepancyKindSchema,
  statsOperationIdSchema,
  teamIdSchema,
  userIdSchema,
} from './atoms.js';

// `_appConfig/app` — the app-wide operational levers, set through the audited updateAppConfig
// callable. `appVersion` is what a live client compares itself against to force a refresh. It is
// written whole through `mergeAppConfigUpdate` and read one lever at a time through
// `readAppConfigLever` (../utils/app-config.ts). Every text lever carries the same cap as its
// updateAppConfig input field, so no writer can store a value the input would refuse.
export const AppConfigSchema = z.object({
  // `''` is valid here — no version published yet; only the update input requires a value.
  appVersion: z.string().max(MAX_APP_VERSION_LENGTH),
  maintenanceMode: z.boolean(),
  maintenanceMessage: z.string().max(MAX_MAINTENANCE_MESSAGE_LENGTH).optional(),
  registrationEnabled: z.boolean(),
  // Empty means no banner — there is no separate on/off flag. Non-empty is the band above every
  // page.
  announcementMessage: z.string().max(MAX_ANNOUNCEMENT_MESSAGE_LENGTH).optional(),
});
export type AppConfig = z.infer<typeof AppConfigSchema>;

// `_appConfig/landingPage` — admin-authored landing page copy, written by adminUpdateLandingPage,
// plus the landing gallery's summary, which only the picture core writes.
export const LandingPageConfigSchema = z.object({
  heroTitle: z.string().max(MAX_LANDING_HERO_TITLE_LENGTH),
  aboutCompany: z.string().max(MAX_LANDING_ABOUT_TEXT_LENGTH),
  pictures: GallerySummarySchema.optional(),
  updatedAt: epochMsSchema,
});
export type LandingPageConfig = z.infer<typeof LandingPageConfigSchema>;

// `_appConfig/statsBeacon` — the signal watching clients refresh their stats on, replaced whole by
// every write. The scope ids say what changed; an action that spans more than one game or league
// omits them, and because every write replaces the document, an omitted id never survives from an
// earlier write.
export const StatsBeaconSchema = z.object({
  updatedAt: epochMsSchema,
  action: statsBeaconActionSchema,
  leagueId: leagueIdSchema.optional(),
  gameId: gameIdSchema.optional(),
  teamIds: z.array(teamIdSchema).optional(),
});
export type StatsBeacon = z.infer<typeof StatsBeaconSchema>;

// `_systemData/adminList` — the admin and referee rosters. The source of truth the `admin` and
// `referee` custom claims are minted from, written only by the audited updateAdminList callable;
// the first admin of a fresh environment is seeded in the console.
export const AdminListSchema = z.object({
  admins: z.array(userIdSchema),
  referees: z.array(userIdSchema),
});
export type AdminList = z.infer<typeof AdminListSchema>;

// `statsValidationReports/{reportId}` — one stats check: every place a game's stored numbers, or a
// derived aggregate, disagree with what the game's events and the completed games say they should
// be. Its id is the check's operation id, which the admin's browser mints, so two checks never share
// a report. Written only by the check, page by page; `complete` turns true with its last page.
export const STATS_DISCREPANCY_VALUE_SCHEMA = z.union([
  z.number(),
  z.string(),
  z.array(z.number().nullable()),
  z.record(z.string(), z.number()),
  z.null(),
]);

export const StatsDiscrepancySchema = z.strictObject({
  kind: statsDiscrepancyKindSchema,
  gameId: gameIdSchema.optional(),
  // The slash path of the document the finding is about.
  path: z.string().min(1),
  // The line or entry within it — a team id, a roster-entry id, a user id — when there is one.
  key: z.string().min(1).optional(),
  field: z.string().min(1).optional(),
  expected: STATS_DISCREPANCY_VALUE_SCHEMA.optional(),
  actual: STATS_DISCREPANCY_VALUE_SCHEMA.optional(),
});
export type StatsDiscrepancy = z.infer<typeof StatsDiscrepancySchema>;

export const StatsValidationScopeSchema = z
  .strictObject({ gameId: gameIdSchema.optional(), leagueId: leagueIdSchema.optional() })
  .refine((scope) => scope.gameId === undefined || scope.leagueId === undefined, 'One game or one league, not both.');
export type StatsValidationScope = z.infer<typeof StatsValidationScopeSchema>;

export const StatsValidationSummarySchema = z.strictObject({
  totalGamesChecked: countSchema,
  totalUsersChecked: countSchema,
  totalTeamsChecked: countSchema,
  totalLeaguesChecked: countSchema,
  discrepanciesFound: countSchema,
});
export type StatsValidationSummary = z.infer<typeof StatsValidationSummarySchema>;

export const StatsValidationReportSchema = z.strictObject({
  reportId: z.string().min(1),
  operationId: statsOperationIdSchema,
  ranAt: epochMsSchema,
  ranByUserId: userIdSchema,
  scope: StatsValidationScopeSchema,
  complete: z.boolean(),
  // Game-tier findings first, then aggregate ones, at most MAX_STATS_VALIDATION_DISCREPANCIES.
  discrepancies: z.array(StatsDiscrepancySchema).max(MAX_STATS_VALIDATION_DISCREPANCIES),
  // Every finding, kept or not, counted by kind.
  discrepancyCounts: z.partialRecord(statsDiscrepancyKindSchema, countSchema),
  summary: StatsValidationSummarySchema,
});
export type StatsValidationReport = z.infer<typeof StatsValidationReportSchema>;
