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

export const TeamMembershipSchema = z.object({
  leagueId: leagueIdSchema,
  teamId: teamIdSchema,
  userId: userIdSchema,
  role: teamRoleSchema,
  status: teamMembershipStatusSchema,
  isGhost: z.boolean(),
  joinedVia: teamJoinMethodSchema.optional(),
  teamInvitationId: z.string().optional(),
  linkedFromGhostUserId: z.string().optional(),
  joinedAt: epochMsSchema,
  updatedAt: epochMsSchema,
});
export type TeamMembership = z.infer<typeof TeamMembershipSchema>;

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

export const TeamJoinRequestSchema = z.object({
  leagueId: leagueIdSchema,
  teamId: teamIdSchema,
  userId: userIdSchema,
  message: z.string(),
  status: teamJoinRequestStatusSchema,
  createdAt: epochMsSchema,
});
export type TeamJoinRequest = z.infer<typeof TeamJoinRequestSchema>;

export const LeagueFreeAgentSchema = z.object({
  leagueId: leagueIdSchema,
  userId: userIdSchema,
  createdAt: epochMsSchema,
});
export type LeagueFreeAgent = z.infer<typeof LeagueFreeAgentSchema>;
