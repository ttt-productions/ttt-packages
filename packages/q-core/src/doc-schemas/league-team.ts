import { z } from 'zod';
import { CONTACT_PHONE_INPUT, TEAM_NAME_INPUT } from '../constants/text-fields.js';
import {
  countSchema,
  epochMsSchema,
  leagueIdSchema,
  teamIconSchema,
  teamTypeSchema,
  userIdSchema,
} from './atoms.js';
import { textFieldSchema } from '../schemas/text-field.js';
import type { LeagueType } from '../types/sports.js';
import { SPORT_LINE_SCHEMAS } from './aggregate-stats.js';
import { GallerySummarySchema } from './gallery.js';

const leagueTeamBaseShape = {
  name: textFieldSchema(TEAM_NAME_INPUT),
  icon: teamIconSchema,
  leagueId: leagueIdSchema,
  teamType: teamTypeSchema.optional(),
  createdByUserId: userIdSchema,
  pictures: GallerySummarySchema.optional(),
  // Only its changing matters: the write fence between membership changes and roster seeding
  // (RULE-STD-BACKEND-116).
  membershipRevision: countSchema.optional(),
  // Only its changing matters: the write fence between competing invitations, join requests, and
  // membership doors (RULE-STD-BACKEND-116).
  joinRevision: countSchema.optional(),
  // Only its changing matters: the write fence between game creation and the team's deletion
  // (RULE-STD-BACKEND-116).
  scheduleRevision: countSchema.optional(),
  createdAt: epochMsSchema,
  updatedAt: epochMsSchema,
} as const;

function leagueTeamOf<L extends LeagueType>(leagueType: L) {
  return z.object({
    ...leagueTeamBaseShape,
    leagueType: z.literal(leagueType),
    seasonStats: SPORT_LINE_SCHEMAS[leagueType].teamSeason.optional(),
    playerSeasonStats: z
      .record(userIdSchema, SPORT_LINE_SCHEMAS[leagueType].membershipRow)
      .optional(),
  });
}

export const BasketballLeagueTeamSchema = leagueTeamOf('Basketball');
export type BasketballLeagueTeam = z.infer<typeof BasketballLeagueTeamSchema>;

export const CurlingLeagueTeamSchema = leagueTeamOf('Curling');
export type CurlingLeagueTeam = z.infer<typeof CurlingLeagueTeamSchema>;

export const FootballLeagueTeamSchema = leagueTeamOf('Football');
export type FootballLeagueTeam = z.infer<typeof FootballLeagueTeamSchema>;

export const LeagueTeamSchema = z.discriminatedUnion('leagueType', [
  BasketballLeagueTeamSchema,
  CurlingLeagueTeamSchema,
  FootballLeagueTeamSchema,
]);
export type LeagueTeam = z.infer<typeof LeagueTeamSchema>;

export const LeagueTeamContactSchema = z.object({
  leagueId: leagueIdSchema,
  contactPhone: textFieldSchema(CONTACT_PHONE_INPUT),
  updatedAt: epochMsSchema,
});
export type LeagueTeamContact = z.infer<typeof LeagueTeamContactSchema>;
