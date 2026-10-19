// Callable contracts for the league: creation, the settings edit, the status move, and the mode
// switch. Every one is admin authority, and the acting admin is `request.auth.uid` — never an input
// field (ARCH-106).

import { z } from 'zod';
import { MAX_PLAYOFF_CUTOFF } from '../constants/business.js';
import {
  LEAGUE_DESCRIPTION_INPUT_FORMAT,
  LEAGUE_TITLE_INPUT_FORMAT,
} from '../input-formats/input-formats.js';
import {
  calendarDateSchema,
  textFieldSchema,
  countSchema,
  epochMsSchema,
  leagueIdSchema,
  leagueModeSchema,
  leagueStatusSchema,
  leagueTypeSchema,
} from '../doc-schemas/atoms.js';
import { playoffCutoffCountSchema, refineLeagueSettings } from '../doc-schemas/sport-league.js';
import { waiverTemplateIdSchema } from '../doc-schemas/waiver-template.js';

// The title and description, each built from its field's one declaration, so the form and the wire
// run the same check.
export const leagueTitleSchema = textFieldSchema(LEAGUE_TITLE_INPUT_FORMAT);
export const leagueDescriptionSchema = textFieldSchema(LEAGUE_DESCRIPTION_INPUT_FORMAT);
export const playoffCutoffSchema = playoffCutoffCountSchema.max(MAX_PLAYOFF_CUTOFF);

// The settings an admin sets at creation and edits afterwards, in the order the update's result and
// audit event list them. Sport and mode are not settings: the sport is fixed at
// creation, and the mode changes only through the mode switch, which retypes the league's teams.
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

// The playoff cutoffs among the settings: a league whose mode sorts its teams by type shows the
// competitive and recreational pair, any other league the single cutoff.
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

// The whole settings set, every time: the callable writes exactly these fields, and a waiver
// requirement turned off drops the template reference with it. `expectedUpdatedAt` is the league's
// `updatedAt` as the admin loaded it: a save that would change a league written since is refused,
// so a stale form never writes its old values over another admin's edit.
export const AdminUpdateSportLeagueInputSchema = z
  .object({ leagueId: leagueIdSchema, expectedUpdatedAt: epochMsSchema, ...leagueSettingsShape })
  .strict()
  .superRefine(refineLeagueSettings);
export type AdminUpdateSportLeagueInput = z.infer<typeof AdminUpdateSportLeagueInputSchema>;
// `changedFields` is empty when the settings already held every value sent. `updatedAt` is the
// league's `updatedAt` once the save is done — the value written, or the stored one when nothing
// changed — and the league it names holds exactly the settings sent, so it is the form's next
// `expectedUpdatedAt` and a second save from the same form is not refused as stale.
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

// The league's `updatedAt` before and after a status move or a mode switch, equal when nothing moved.
// Neither changes a setting and neither checks the settings form, so a form advances its
// `expectedUpdatedAt` to `updatedAt` only when it was loaded at `previousUpdatedAt`. A form loaded
// at any other value was already stale, and advancing it would let its old values overwrite the
// edit that made it stale.
const leagueUpdatedAtMoveShape = { previousUpdatedAt: epochMsSchema, updatedAt: epochMsSchema };

export const AdminUpdateSportLeagueStatusResultSchema = z
  .object({ leagueId: leagueIdSchema, status: leagueStatusSchema, ...leagueUpdatedAtMoveShape })
  .strict();
export type AdminUpdateSportLeagueStatusResult = z.infer<
  typeof AdminUpdateSportLeagueStatusResultSchema
>;

export const SwitchLeagueModeInputSchema = z
  .object({ leagueId: leagueIdSchema, newMode: leagueModeSchema })
  .strict();
export type SwitchLeagueModeInput = z.infer<typeof SwitchLeagueModeInputSchema>;
// `teamsUpdated` is 0 when the league was already in `newMode`: nothing is rewritten.
export const SwitchLeagueModeResultSchema = z
  .object({
    leagueId: leagueIdSchema,
    leagueMode: leagueModeSchema,
    teamsUpdated: countSchema,
    ...leagueUpdatedAtMoveShape,
  })
  .strict();
export type SwitchLeagueModeResult = z.infer<typeof SwitchLeagueModeResultSchema>;
