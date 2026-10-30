import { z } from 'zod';
import {
  epochMsSchema,
  leagueIdSchema,
  membershipRosterSyncStatusSchema,
  teamIdSchema,
  userIdSchema,
} from '../doc-schemas/atoms.js';
import {
  teamInvitationIdSchema,
  teamInvitationMessageSchema,
  teamJoinRequestIdSchema,
  teamJoinRequestMessageSchema,
} from './atoms.js';

export const CreateTeamInvitationInputSchema = z
  .object({
    teamId: teamIdSchema,
    invitedUserId: userIdSchema,
    message: teamInvitationMessageSchema,
  })
  .strict();
export type CreateTeamInvitationInput = z.infer<typeof CreateTeamInvitationInputSchema>;

export const TeamInvitationTargetInputSchema = z
  .object({ teamInvitationId: teamInvitationIdSchema })
  .strict();
export type TeamInvitationTargetInput = z.infer<typeof TeamInvitationTargetInputSchema>;

export const TeamInvitationResultSchema = z
  .object({
    leagueId: leagueIdSchema,
    teamId: teamIdSchema,
    teamInvitationId: teamInvitationIdSchema,
    invitedUserId: userIdSchema,
  })
  .strict();
export type TeamInvitationResult = z.infer<typeof TeamInvitationResultSchema>;

export const AcceptTeamInvitationResultSchema = TeamInvitationResultSchema.extend({
  rosterSyncStatus: membershipRosterSyncStatusSchema,
}).strict();
export type AcceptTeamInvitationResult = z.infer<typeof AcceptTeamInvitationResultSchema>;

export const CreateTeamJoinRequestInputSchema = z
  .object({ teamId: teamIdSchema, message: teamJoinRequestMessageSchema })
  .strict();
export type CreateTeamJoinRequestInput = z.infer<typeof CreateTeamJoinRequestInputSchema>;

export const TeamJoinRequestTargetInputSchema = z
  .object({ teamJoinRequestId: teamJoinRequestIdSchema })
  .strict();
export type TeamJoinRequestTargetInput = z.infer<typeof TeamJoinRequestTargetInputSchema>;

export const TeamJoinRequestResultSchema = z
  .object({
    leagueId: leagueIdSchema,
    teamId: teamIdSchema,
    teamJoinRequestId: teamJoinRequestIdSchema,
    userId: userIdSchema,
  })
  .strict();
export type TeamJoinRequestResult = z.infer<typeof TeamJoinRequestResultSchema>;

export const AcceptTeamJoinRequestResultSchema = TeamJoinRequestResultSchema.extend({
  rosterSyncStatus: membershipRosterSyncStatusSchema,
}).strict();
export type AcceptTeamJoinRequestResult = z.infer<typeof AcceptTeamJoinRequestResultSchema>;

export const LeagueFreeAgentInputSchema = z.object({ leagueId: leagueIdSchema }).strict();
export type LeagueFreeAgentInput = z.infer<typeof LeagueFreeAgentInputSchema>;

export const CreateLeagueFreeAgentResultSchema = z
  .object({ leagueId: leagueIdSchema, userId: userIdSchema, createdAt: epochMsSchema })
  .strict();
export type CreateLeagueFreeAgentResult = z.infer<typeof CreateLeagueFreeAgentResultSchema>;

export const DeleteLeagueFreeAgentResultSchema = z
  .object({ leagueId: leagueIdSchema, userId: userIdSchema, deleted: z.boolean() })
  .strict();
export type DeleteLeagueFreeAgentResult = z.infer<typeof DeleteLeagueFreeAgentResultSchema>;

export const AdminAssignLeagueFreeAgentInputSchema = z
  .object({ leagueId: leagueIdSchema, userId: userIdSchema, teamId: teamIdSchema })
  .strict();
export type AdminAssignLeagueFreeAgentInput = z.infer<typeof AdminAssignLeagueFreeAgentInputSchema>;

export const AdminAssignLeagueFreeAgentResultSchema = z
  .object({
    leagueId: leagueIdSchema,
    teamId: teamIdSchema,
    userId: userIdSchema,
    rosterSyncStatus: membershipRosterSyncStatusSchema,
  })
  .strict();
export type AdminAssignLeagueFreeAgentResult = z.infer<
  typeof AdminAssignLeagueFreeAgentResultSchema
>;
