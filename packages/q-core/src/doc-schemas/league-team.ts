import { z } from 'zod';
import {
  CONTACT_PHONE_INPUT_FORMAT,
  TEAM_NAME_INPUT_FORMAT,
} from '../input-formats/input-formats.js';
import {
  countSchema,
  epochMsSchema,
  leagueIdSchema,
  teamIconSchema,
  teamTypeSchema,
  textFieldSchema,
  userIdSchema,
} from './atoms.js';
import { PlayerSeasonStatsSchema, TeamSeasonStatsSchema } from './aggregate-stats.js';
import { GallerySummarySchema } from './gallery.js';

export const LeagueTeamSchema = z.object({
  name: textFieldSchema(TEAM_NAME_INPUT_FORMAT),
  icon: teamIconSchema,
  leagueId: leagueIdSchema,
  teamType: teamTypeSchema.optional(),
  createdByUserId: userIdSchema,
  seasonStats: TeamSeasonStatsSchema.optional(),
  playerSeasonStats: z.record(userIdSchema, PlayerSeasonStatsSchema).optional(),
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
});
export type LeagueTeam = z.infer<typeof LeagueTeamSchema>;

export const LeagueTeamContactSchema = z.object({
  leagueId: leagueIdSchema,
  contactPhone: textFieldSchema(CONTACT_PHONE_INPUT_FORMAT),
  updatedAt: epochMsSchema,
});
export type LeagueTeamContact = z.infer<typeof LeagueTeamContactSchema>;
