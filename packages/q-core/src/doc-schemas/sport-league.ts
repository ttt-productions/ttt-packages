// `sportLeagues/{leagueId}` — one league: its sport, mode, dates, status, playoff cutoffs, and waiver
// requirement. The admin league callables write its settings, status, and mode; the picture core
// writes `pictures`. Teams, games, and player stats live in their own collections and are never
// copied onto the league.

import { z } from 'zod';
import {
  calendarDateSchema,
  countSchema,
  epochMsSchema,
  leagueModeSchema,
  leagueStatusSchema,
  leagueTypeSchema,
} from './atoms.js';
import { GallerySummarySchema } from './gallery.js';
import { waiverTemplateIdSchema } from './waiver-template.js';

export const LEAGUE_DATES_OUT_OF_ORDER_MESSAGE = 'The league cannot end before it starts.';
export const WAIVER_REQUIREMENT_MISMATCH_MESSAGE =
  'Choose a waiver template when the league requires a waiver, and none when it does not.';

/**
 * A league names a waiver template exactly when it requires a waiver, so no reader needs a
 * sentinel for "no waiver" and no stale template id survives turning the requirement off.
 */
export function hasConsistentWaiverRequirement(league: {
  requiresWaiver: boolean;
  waiverTemplateId?: string | undefined;
}): boolean {
  return league.requiresWaiver === (league.waiverTemplateId !== undefined);
}

/**
 * The cross-field rules every league settings shape obeys — the stored document and both callable
 * inputs — so the rule a form shows, the callable enforces, and the copy action validates is one
 * rule.
 */
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

// How many teams reach the playoffs is a count; the callable inputs bound it with `MAX_PLAYOFF_CUTOFF`.
export const playoffCutoffCountSchema = countSchema;

export const SportLeagueSchema = z
  .object({
    leagueTitle: z.string(),
    description: z.string(),
    leagueType: leagueTypeSchema,
    leagueMode: leagueModeSchema,
    leagueStartDate: calendarDateSchema,
    leagueEndDate: calendarDateSchema,
    status: leagueStatusSchema,
    // How many teams reach the playoffs: `playoffCutoff` in a Regular league, the Competitive and
    // Recreational pools' own cutoffs in a Competitive/Recreational one. All three are kept in both
    // modes so a mode switch loses none.
    playoffCutoff: playoffCutoffCountSchema,
    playoffCutoffComp: playoffCutoffCountSchema,
    playoffCutoffRec: playoffCutoffCountSchema,
    requiresWaiver: z.boolean(),
    waiverTemplateId: waiverTemplateIdSchema.optional(),
    // The league's picture gallery summary — absent is an empty gallery. Only the picture core
    // writes it; the league callables and the copy action never do.
    pictures: GallerySummarySchema.optional(),
    // Advanced by every team created in the league; absent until the first. Only its changing
    // matters: team creation counts the league's teams in its transaction against
    // MAX_TEAMS_PER_LEAGUE, and a query does not lock against an insert — so each creation writes this
    // document, and two creations at the cap conflict instead of both passing (BACKEND-116).
    teamRevision: countSchema.optional(),
    // Advanced by every game created in the league, a schedule week's included; absent until the
    // first. Only its changing matters, the same way: game creation counts the league's games in its
    // transaction against MAX_GAMES_PER_LEAGUE.
    gameRevision: countSchema.optional(),
    createdAt: epochMsSchema,
    updatedAt: epochMsSchema,
  })
  .superRefine(refineLeagueSettings);
export type SportLeague = z.infer<typeof SportLeagueSchema>;
