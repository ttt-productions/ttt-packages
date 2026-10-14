// Callable contract for the admin dashboard's counts. Nothing stores them: `getAdminStats` counts the
// collections on every read, so the answer is the counts as they stand at `updatedAt`.

import { z } from 'zod';
import { countSchema, epochMsSchema } from '../doc-schemas/atoms.js';

// The calendar year of a league's `leagueStartDate` — the key of the teams-per-year breakdown.
export const leagueStartYearSchema = z.string().regex(/^\d{4}$/);

export const AdminStatsSchema = z
  .object({
    totalUsers: countSchema,
    totalTeams: countSchema,
    totalLeagues: countSchema,
    activeLeagues: countSchema,
    upcomingLeagues: countSchema,
    // Games with the completed status — the one finished status a game holds.
    totalGamesPlayed: countSchema,
    // Free-agent signups in active and upcoming leagues only: a closed league's leftover signups
    // are nobody looking for a team.
    activeFreeAgents: countSchema,
    // Teams per year of their league's start date. The years sum to `totalTeams` except for a team
    // whose league no longer exists, which has no year to count under.
    teamsByYear: z.record(leagueStartYearSchema, countSchema),
    // When the counts were taken.
    updatedAt: epochMsSchema,
  })
  .strict();
export type AdminStats = z.infer<typeof AdminStatsSchema>;

export const GetAdminStatsInputSchema = z.object({}).strict().nullish();
export type GetAdminStatsInput = z.infer<typeof GetAdminStatsInputSchema>;
export const GetAdminStatsResultSchema = z.object({ stats: AdminStatsSchema }).strict();
export type GetAdminStatsResult = z.infer<typeof GetAdminStatsResultSchema>;
