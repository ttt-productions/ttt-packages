import { z } from 'zod';
import {
  TEAM_INVITATION_MESSAGE_INPUT,
  TEAM_JOIN_REQUEST_MESSAGE_INPUT,
} from '../constants/text-fields.js';
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
import { textFieldSchema } from '../schemas/text-field.js';

export const TeamMembershipSchema = z.object({
  leagueId: leagueIdSchema,
  teamId: teamIdSchema,
  userId: userIdSchema,
  role: teamRoleSchema,
  status: teamMembershipStatusSchema,
  isGhost: z.boolean(),
  joinedVia: teamJoinMethodSchema.optional(),
  teamInvitationId: z.string().optional(),
  teamJoinRequestId: z.string().optional(),
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
  message: textFieldSchema(TEAM_INVITATION_MESSAGE_INPUT),
  status: teamInvitationStatusSchema,
  createdAt: epochMsSchema,
});
export type TeamInvitation = z.infer<typeof TeamInvitationSchema>;

export const TeamJoinRequestSchema = z.object({
  leagueId: leagueIdSchema,
  teamId: teamIdSchema,
  userId: userIdSchema,
  message: textFieldSchema(TEAM_JOIN_REQUEST_MESSAGE_INPUT),
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
