import { z } from 'zod';
import { MAX_APP_VERSION_LENGTH } from '../constants/business.js';
import {
  ANNOUNCEMENT_MESSAGE_INPUT_FORMAT,
  LANDING_ABOUT_TEXT_INPUT_FORMAT,
  LANDING_HERO_TITLE_INPUT_FORMAT,
  MAINTENANCE_MESSAGE_INPUT_FORMAT,
} from '../input-formats/input-formats.js';
import { MAX_STATS_VALIDATION_DISCREPANCIES } from '../constants/sports.js';
import { GallerySummarySchema } from './gallery.js';
import {
  countSchema,
  documentIdSegmentSchema,
  epochMsSchema,
  gameIdSchema,
  leagueIdSchema,
  statsBeaconActionSchema,
  statsDiscrepancyKindSchema,
  statsOperationIdSchema,
  teamIdSchema,
  textFieldSchema,
  userIdSchema,
} from './atoms.js';

export const AppConfigSchema = z.object({
  // `''` is valid here — no version published yet; only the update input requires a value.
  appVersion: z.string().max(MAX_APP_VERSION_LENGTH),
  maintenanceMode: z.boolean(),
  maintenanceMessage: textFieldSchema(MAINTENANCE_MESSAGE_INPUT_FORMAT).optional(),
  registrationEnabled: z.boolean(),
  announcementMessage: textFieldSchema(ANNOUNCEMENT_MESSAGE_INPUT_FORMAT).optional(),
});
export type AppConfig = z.infer<typeof AppConfigSchema>;

export const LandingPageConfigSchema = z.object({
  heroTitle: textFieldSchema(LANDING_HERO_TITLE_INPUT_FORMAT),
  aboutCompany: textFieldSchema(LANDING_ABOUT_TEXT_INPUT_FORMAT),
  pictures: GallerySummarySchema.optional(),
  updatedAt: epochMsSchema,
});
export type LandingPageConfig = z.infer<typeof LandingPageConfigSchema>;

export const StatsBeaconSchema = z.object({
  updatedAt: epochMsSchema,
  // A fresh document id minted by every write, so two commits in the same millisecond still move
  // the beacon.
  changeId: documentIdSegmentSchema.optional(),
  action: statsBeaconActionSchema,
  leagueId: leagueIdSchema.optional(),
  gameId: gameIdSchema.optional(),
  teamIds: z.array(teamIdSchema).optional(),
});
export type StatsBeacon = z.infer<typeof StatsBeaconSchema>;

export const AdminListSchema = z.object({
  admins: z.array(userIdSchema),
  referees: z.array(userIdSchema),
});
export type AdminList = z.infer<typeof AdminListSchema>;

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
  path: z.string().min(1),
  key: z.string().min(1).optional(),
  field: z.string().min(1).optional(),
  expected: STATS_DISCREPANCY_VALUE_SCHEMA.optional(),
  actual: STATS_DISCREPANCY_VALUE_SCHEMA.optional(),
});
export type StatsDiscrepancy = z.infer<typeof StatsDiscrepancySchema>;

export const StatsValidationScopeSchema = z
  .strictObject({ gameId: gameIdSchema.optional(), leagueId: leagueIdSchema.optional() })
  .refine(
    (scope) => scope.gameId === undefined || scope.leagueId === undefined,
    'One game or one league, not both.',
  );
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
  discrepancies: z.array(StatsDiscrepancySchema).max(MAX_STATS_VALIDATION_DISCREPANCIES),
  discrepancyCounts: z.partialRecord(statsDiscrepancyKindSchema, countSchema),
  summary: StatsValidationSummarySchema,
});
export type StatsValidationReport = z.infer<typeof StatsValidationReportSchema>;
