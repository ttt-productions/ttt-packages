import { z } from 'zod';
import { countSchema, epochMsSchema } from '../doc-schemas/atoms.js';

export const leagueStartYearSchema = z.string().regex(/^\d{4}$/);

export const SiteCountsSchema = z
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
export type SiteCounts = z.infer<typeof SiteCountsSchema>;

export const AdminGetSiteCountsInputSchema = z.object({}).strict().nullish();
export type AdminGetSiteCountsInput = z.infer<typeof AdminGetSiteCountsInputSchema>;
export const AdminGetSiteCountsResultSchema = z.object({ stats: SiteCountsSchema }).strict();
export type AdminGetSiteCountsResult = z.infer<typeof AdminGetSiteCountsResultSchema>;
