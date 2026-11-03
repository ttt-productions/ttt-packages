import { z } from 'zod';
import { LEAGUE_DESCRIPTION_INPUT, LEAGUE_TITLE_INPUT } from '../constants/text-fields.js';
import {
  calendarDateSchema,
  countSchema,
  epochMsSchema,
  leagueIdSchema,
  leagueModeSchema,
  leagueStatusSchema,
  leagueTypeSchema,
} from '../doc-schemas/atoms.js';
import { textFieldSchema } from './text-field.js';
import { playoffCutoffSchema, refineLeagueSettings } from '../doc-schemas/sport-league.js';
import { waiverTemplateIdSchema } from '../doc-schemas/waiver-template.js';

export const leagueTitleSchema = textFieldSchema(LEAGUE_TITLE_INPUT);
export const leagueDescriptionSchema = textFieldSchema(LEAGUE_DESCRIPTION_INPUT);

export const LEAGUE_SETTINGS_FIELD_KEYS = [
  'leagueTitle',
  'description',
  'leagueStartDate',
  'leagueEndDate',
  'playoffCutoff',
  'playoffCutoffComp',
  'playoffCutoffRec',
  'requiresWaiver',
  'waiverTemplateId',
] as const;
export type LeagueSettingsField = (typeof LEAGUE_SETTINGS_FIELD_KEYS)[number];
export const leagueSettingsFieldSchema = z.enum(LEAGUE_SETTINGS_FIELD_KEYS);

export const PLAYOFF_CUTOFF_FIELD_KEYS = [
  'playoffCutoff',
  'playoffCutoffComp',
  'playoffCutoffRec',
] as const satisfies readonly LeagueSettingsField[];
export type PlayoffCutoffField = (typeof PLAYOFF_CUTOFF_FIELD_KEYS)[number];

// Every cutoff is sent whether or not the league's mode shows it, so a later mode switch finds the
// other mode's cutoffs already set.
const leagueSettingsShape = {
  leagueTitle: leagueTitleSchema,
  description: leagueDescriptionSchema,
  leagueStartDate: calendarDateSchema,
  leagueEndDate: calendarDateSchema,
  playoffCutoff: playoffCutoffSchema,
  playoffCutoffComp: playoffCutoffSchema,
  playoffCutoffRec: playoffCutoffSchema,
  requiresWaiver: z.boolean(),
  waiverTemplateId: waiverTemplateIdSchema.optional(),
} satisfies Record<LeagueSettingsField, z.ZodType>;

export const AdminCreateSportLeagueInputSchema = z
  .object({ ...leagueSettingsShape, leagueType: leagueTypeSchema, leagueMode: leagueModeSchema })
  .strict()
  .superRefine(refineLeagueSettings);
export type AdminCreateSportLeagueInput = z.infer<typeof AdminCreateSportLeagueInputSchema>;
export const AdminCreateSportLeagueResultSchema = z.object({ leagueId: leagueIdSchema }).strict();
export type AdminCreateSportLeagueResult = z.infer<typeof AdminCreateSportLeagueResultSchema>;

export const AdminUpdateSportLeagueInputSchema = z
  .object({ leagueId: leagueIdSchema, expectedUpdatedAt: epochMsSchema, ...leagueSettingsShape })
  .strict()
  .superRefine(refineLeagueSettings);
export type AdminUpdateSportLeagueInput = z.infer<typeof AdminUpdateSportLeagueInputSchema>;
export const AdminUpdateSportLeagueResultSchema = z
  .object({
    leagueId: leagueIdSchema,
    changedFields: z.array(leagueSettingsFieldSchema),
    updatedAt: epochMsSchema,
  })
  .strict();
export type AdminUpdateSportLeagueResult = z.infer<typeof AdminUpdateSportLeagueResultSchema>;

export const AdminUpdateSportLeagueStatusInputSchema = z
  .object({ leagueId: leagueIdSchema, status: leagueStatusSchema })
  .strict();
export type AdminUpdateSportLeagueStatusInput = z.infer<
  typeof AdminUpdateSportLeagueStatusInputSchema
>;

const leagueUpdatedAtMoveShape = { previousUpdatedAt: epochMsSchema, updatedAt: epochMsSchema };

export const AdminUpdateSportLeagueStatusResultSchema = z
  .object({ leagueId: leagueIdSchema, status: leagueStatusSchema, ...leagueUpdatedAtMoveShape })
  .strict();
export type AdminUpdateSportLeagueStatusResult = z.infer<
  typeof AdminUpdateSportLeagueStatusResultSchema
>;

export const AdminUpdateSportLeagueModeInputSchema = z
  .object({ leagueId: leagueIdSchema, newMode: leagueModeSchema })
  .strict();
export type AdminUpdateSportLeagueModeInput = z.infer<typeof AdminUpdateSportLeagueModeInputSchema>;
export const AdminUpdateSportLeagueModeResultSchema = z
  .object({
    leagueId: leagueIdSchema,
    leagueMode: leagueModeSchema,
    teamsUpdated: countSchema,
    ...leagueUpdatedAtMoveShape,
  })
  .strict();
export type AdminUpdateSportLeagueModeResult = z.infer<
  typeof AdminUpdateSportLeagueModeResultSchema
>;
