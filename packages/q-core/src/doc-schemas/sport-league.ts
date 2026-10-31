import { z } from 'zod';
import { MAX_PLAYOFF_CUTOFF } from '../constants/business.js';
import {
  LEAGUE_DESCRIPTION_INPUT_FORMAT,
  LEAGUE_TITLE_INPUT_FORMAT,
} from '../input-formats/input-formats.js';
import {
  calendarDateSchema,
  countSchema,
  epochMsSchema,
  leagueModeSchema,
  leagueStatusSchema,
  leagueTypeSchema,
  textFieldSchema,
} from './atoms.js';
import { GallerySummarySchema } from './gallery.js';
import { waiverTemplateIdSchema } from './waiver-template.js';

export const LEAGUE_DATES_OUT_OF_ORDER_MESSAGE = 'The league cannot end before it starts.';
export const WAIVER_REQUIREMENT_MISMATCH_MESSAGE =
  'Choose a waiver template when the league requires a waiver, and none when it does not.';

export function hasConsistentWaiverRequirement(league: {
  requiresWaiver: boolean;
  waiverTemplateId?: string | undefined;
}): boolean {
  return league.requiresWaiver === (league.waiverTemplateId !== undefined);
}

export function refineLeagueSettings<
  T extends {
    leagueStartDate: string;
    leagueEndDate: string;
    requiresWaiver: boolean;
    waiverTemplateId?: string | undefined;
  },
>(league: T, ctx: z.core.$RefinementCtx<T>): void {
  if (league.leagueEndDate < league.leagueStartDate) {
    ctx.addIssue({
      code: 'custom',
      path: ['leagueEndDate'],
      message: LEAGUE_DATES_OUT_OF_ORDER_MESSAGE,
    });
  }
  if (!hasConsistentWaiverRequirement(league)) {
    ctx.addIssue({
      code: 'custom',
      path: ['waiverTemplateId'],
      message: WAIVER_REQUIREMENT_MISMATCH_MESSAGE,
    });
  }
}

export const playoffCutoffSchema = countSchema.max(MAX_PLAYOFF_CUTOFF);

export const SportLeagueSchema = z
  .object({
    leagueTitle: textFieldSchema(LEAGUE_TITLE_INPUT_FORMAT),
    description: textFieldSchema(LEAGUE_DESCRIPTION_INPUT_FORMAT),
    leagueType: leagueTypeSchema,
    leagueMode: leagueModeSchema,
    leagueStartDate: calendarDateSchema,
    leagueEndDate: calendarDateSchema,
    status: leagueStatusSchema,
    playoffCutoff: playoffCutoffSchema,
    playoffCutoffComp: playoffCutoffSchema,
    playoffCutoffRec: playoffCutoffSchema,
    requiresWaiver: z.boolean(),
    waiverTemplateId: waiverTemplateIdSchema.optional(),
    pictures: GallerySummarySchema.optional(),
    // Only its changing matters: the write fence of the MAX_TEAMS_PER_LEAGUE cap
    // (RULE-STD-BACKEND-116).
    teamRevision: countSchema.optional(),
    // Only its changing matters: the write fence of the MAX_GAMES_PER_LEAGUE cap
    // (RULE-STD-BACKEND-116).
    gameRevision: countSchema.optional(),
    createdAt: epochMsSchema,
    updatedAt: epochMsSchema,
  })
  .superRefine(refineLeagueSettings);
export type SportLeague = z.infer<typeof SportLeagueSchema>;
