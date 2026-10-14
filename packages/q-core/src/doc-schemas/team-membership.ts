// The documents that put a user on a team: the membership itself and the three ways to reach one.
// Every one of them stores user ids only — names resolve from `publicUsers` (ARCH-103).

import { z } from 'zod';
import {
  epochMsSchema,
  teamJoinRequestStatusSchema,
  leagueIdSchema,
  teamIdSchema,
  teamInvitationStatusSchema,
  teamJoinMethodSchema,
  teamMembershipStatusSchema,
  teamRoleSchema,
  userIdSchema,
} from './atoms.js';

// `teamMemberships/{leagueId}_{teamId}_{userId}` — canonical membership and team role. The id is
// load-bearing: rules and callables read a membership by id to decide captain authority.
export const TeamMembershipSchema = z.object({
  leagueId: leagueIdSchema,
  teamId: teamIdSchema,
  userId: userIdSchema,
  role: teamRoleSchema,
  status: teamMembershipStatusSchema,
  isGhost: z.boolean(),
  joinedVia: teamJoinMethodSchema.optional(),
  // The invite this membership came from, when `joinedVia` is `invite`.
  teamInvitationId: z.string().optional(),
  // The ghost id this real user's membership replaced, when a ghost was linked to them.
  linkedFromGhostUserId: z.string().optional(),
  joinedAt: epochMsSchema,
  updatedAt: epochMsSchema,
});
export type TeamMembership = z.infer<typeof TeamMembershipSchema>;

// `teamInvitations/{inviteId}` — a captain invites a user onto their team.
export const TeamInvitationSchema = z.object({
  leagueId: leagueIdSchema,
  teamId: teamIdSchema,
  invitedUserId: userIdSchema,
  invitedByUserId: userIdSchema,
  message: z.string(),
  status: teamInvitationStatusSchema,
  createdAt: epochMsSchema,
  respondedAt: epochMsSchema.optional(),
});
export type TeamInvitation = z.infer<typeof TeamInvitationSchema>;

// `teamJoinRequests/{requestId}` — a player asks to join a team.
export const TeamJoinRequestSchema = z.object({
  leagueId: leagueIdSchema,
  teamId: teamIdSchema,
  userId: userIdSchema,
  message: z.string(),
  status: teamJoinRequestStatusSchema,
  createdAt: epochMsSchema,
});
export type TeamJoinRequest = z.infer<typeof TeamJoinRequestSchema>;

// `leagueFreeAgents/{leagueId}_{userId}` — a player available for assignment in a league. The
// document exists while the player is available and is deleted when they are placed or withdraw.
export const LeagueFreeAgentSchema = z.object({
  leagueId: leagueIdSchema,
  userId: userIdSchema,
  createdAt: epochMsSchema,
});
export type LeagueFreeAgent = z.infer<typeof LeagueFreeAgentSchema>;
