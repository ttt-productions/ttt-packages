import { z } from 'zod';
import { countSchema, epochMsSchema } from '../doc-schemas/atoms.js';

export const leagueStartYearSchema = z.string().regex(/^\d{4}$/);

export const AdminStatsSchema = z
  .object({
    totalUsers: countSchema,
    totalTeams: countSchema,
    totalLeagues: countSchema,
    activeLeagues: countSchema,
    upcomingLeagues: countSchema,
    totalGamesPlayed: countSchema,
    activeFreeAgents: countSchema,
    teamsByYear: z.record(leagueStartYearSchema, countSchema),
    updatedAt: epochMsSchema,
  })
  .strict();
export type AdminStats = z.infer<typeof AdminStatsSchema>;

export const GetAdminStatsInputSchema = z.object({}).strict().nullish();
export type GetAdminStatsInput = z.infer<typeof GetAdminStatsInputSchema>;
export const GetAdminStatsResultSchema = z.object({ stats: AdminStatsSchema }).strict();
export type GetAdminStatsResult = z.infer<typeof GetAdminStatsResultSchema>;
