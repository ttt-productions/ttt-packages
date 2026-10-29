// `leagueTeams/{teamId}` — one team in one league, with its derived season rollups. Who is on the
// team, and who captains it, is `teamMemberships` — never a field here.

import { z } from 'zod';
import { CONTACT_PHONE_INPUT_FORMAT } from '../input-formats/input-formats.js';
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
  name: z.string(),
  icon: teamIconSchema,
  leagueId: leagueIdSchema,
  // Present only in a Competitive/Recreational league.
  teamType: teamTypeSchema.optional(),
  // The account that created the team — the new captain, or the admin who created it for a ghost
  // captain. A creation record, never a membership or an authority.
  createdByUserId: userIdSchema,
  // The team's standings line, absent until its first game is finalized.
  seasonStats: TeamSeasonStatsSchema.optional(),
  // The league player stats: one row per person the team's games credited, keyed by userId (real or
  // ghost). The team's league, the team, and the key are the membership the row belongs to.
  playerSeasonStats: z.record(userIdSchema, PlayerSeasonStatsSchema).optional(),
  // The team's picture gallery summary — absent is an empty gallery. Only the picture core writes
  // it; the team callables and the copy action never do.
  pictures: GallerySummarySchema.optional(),
  // Advanced by every membership change on the team after its creation; absent until the first.
  // Only its changing matters: game creation and a game's team replacement read this document in the
  // transaction that seeds a roster from the team's memberships, so a membership change landing at
  // the same moment conflicts with them instead of missing the new game (RULE-STD-BACKEND-116).
  membershipRevision: countSchema.optional(),
  // Advanced by every invitation and join request a door creates for the team; absent until the
  // first. Only its changing matters: a pending invitation or request between one team and one
  // person is unique, and a membership on the team closes both, but a transaction does not lock a
  // query against an insert — so each creation writes this document, which every competing
  // creation and every membership door also writes, and two racers conflict instead of both passing
  // their checks (RULE-STD-BACKEND-116).
  joinRevision: countSchema.optional(),
  // Advanced by every game creation and every game edit that brings the team in; absent until the
  // first. Only its changing matters: a team's deletion re-reads the team's games in the transaction
  // that deletes the team document, and a query does not lock against an insert — so a game created
  // for the team writes this document, which the deletion also writes, and the two conflict instead of
  // leaving a game naming a deleted team (RULE-STD-BACKEND-116).
  scheduleRevision: countSchema.optional(),
  createdAt: epochMsSchema,
  updatedAt: epochMsSchema,
});
export type LeagueTeam = z.infer<typeof LeagueTeamSchema>;

// `leagueTeamContacts/{teamId}` — how the league reaches the team. Admin read only: the team
// document is public, so the phone lives here, never on it (RULE-STD-BACKEND-105). `leagueId` is what lists a
// league's contacts in one query. Written with the team by team creation.
export const LeagueTeamContactSchema = z.object({
  leagueId: leagueIdSchema,
  // The number as the contact callables kept it, held to the same declaration they parse with.
  contactPhone: textFieldSchema(CONTACT_PHONE_INPUT_FORMAT),
  updatedAt: epochMsSchema,
});
export type LeagueTeamContact = z.infer<typeof LeagueTeamContactSchema>;
