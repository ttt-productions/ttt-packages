// Callable contracts for the ways onto a team: an invitation the team sends, a join request the
// player sends, and a free-agent signup an admin answers by placing the player. Every door that
// makes a membership ends in the membership core. The acting user is always `request.auth.uid` —
// never an input field (RULE-STD-ARCH-106) — and the entry, never a field of the payload, decides the
// authority (RULE-STD-BACKEND-004): each action is its own callable, never a choice made by a payload field
// (RULE-STD-BACKEND-305).

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

// ---------------------------------------------------------------------------------------------
// Invitations — sent and withdrawn by the team's captain or a co-captain (`createTeamInvitation`,
// `cancelTeamInvitation`) or by an admin (`adminCreateTeamInvitation`, `adminCancelTeamInvitation`);
// accepted or declined by the invitee alone (`acceptTeamInvitation`, `rejectTeamInvitation`).
// ---------------------------------------------------------------------------------------------

export const CreateTeamInvitationInputSchema = z
  .object({
    teamId: teamIdSchema,
    invitedUserId: userIdSchema,
    message: teamInvitationMessageSchema,
  })
  .strict();
export type CreateTeamInvitationInput = z.infer<typeof CreateTeamInvitationInputSchema>;

// Names the invitation a cancel, an acceptance, or a decline acts on.
export const TeamInvitationTargetInputSchema = z
  .object({ teamInvitationId: teamInvitationIdSchema })
  .strict();
export type TeamInvitationTargetInput = z.infer<typeof TeamInvitationTargetInputSchema>;

// What sending, cancelling, and declining answer with: the invitation and the ids a client names in
// its domain event.
export const TeamInvitationResultSchema = z
  .object({
    leagueId: leagueIdSchema,
    teamId: teamIdSchema,
    teamInvitationId: teamInvitationIdSchema,
    invitedUserId: userIdSchema,
  })
  .strict();
export type TeamInvitationResult = z.infer<typeof TeamInvitationResultSchema>;

// `rosterSyncStatus` is where the new membership's roster work stood when the call returned: the
// membership is committed either way, and `pending` finishes in the background.
export const AcceptTeamInvitationResultSchema = TeamInvitationResultSchema.extend({
  rosterSyncStatus: membershipRosterSyncStatusSchema,
}).strict();
export type AcceptTeamInvitationResult = z.infer<typeof AcceptTeamInvitationResultSchema>;

// ---------------------------------------------------------------------------------------------
// Join requests — sent and withdrawn by the player (`createTeamJoinRequest`,
// `cancelTeamJoinRequest`); accepted or rejected by the team's captain or a co-captain
// (`acceptTeamJoinRequest`, `rejectTeamJoinRequest`) or by an admin (`adminAcceptTeamJoinRequest`,
// `adminRejectTeamJoinRequest`).
// ---------------------------------------------------------------------------------------------

export const CreateTeamJoinRequestInputSchema = z
  .object({ teamId: teamIdSchema, message: teamJoinRequestMessageSchema })
  .strict();
export type CreateTeamJoinRequestInput = z.infer<typeof CreateTeamJoinRequestInputSchema>;

// Names the join request a cancel, an acceptance, or a rejection acts on.
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

// ---------------------------------------------------------------------------------------------
// Free agents — a player signs up in a league (`createLeagueFreeAgent`) or withdraws
// (`deleteLeagueFreeAgent`); an admin places a signed-up player on a team
// (`adminAssignLeagueFreeAgent`).
// ---------------------------------------------------------------------------------------------

// The league a player signs up in, or withdraws from. The player is the caller.
export const LeagueFreeAgentInputSchema = z.object({ leagueId: leagueIdSchema }).strict();
export type LeagueFreeAgentInput = z.infer<typeof LeagueFreeAgentInputSchema>;

// `createdAt` is the signup's own moment: a repeated signup answers the one already on record.
export const CreateLeagueFreeAgentResultSchema = z
  .object({ leagueId: leagueIdSchema, userId: userIdSchema, createdAt: epochMsSchema })
  .strict();
export type CreateLeagueFreeAgentResult = z.infer<typeof CreateLeagueFreeAgentResultSchema>;

// `deleted` is false when no signup was on record — a repeated withdrawal changes nothing.
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
