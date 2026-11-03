import { z } from 'zod';
import {
  leagueJoinWarningActedOnSchema,
  leagueJoinWarningFindingSchema,
} from '../utils/league-join-warning.js';
import {
  countSchema,
  documentIdSegmentSchema,
  gameIdSchema,
  leagueIdSchema,
  teamIconSchema,
  teamIdSchema,
  teamRoleSchema,
  teamTypeSchema,
  userIdSchema,
} from '../doc-schemas/atoms.js';
import { buildGhostUserIdForRequest, isGhostUserId } from '../ids/minted-ids.js';
import { isDocumentIdSegment } from '../paths/utils.js';
import { GHOST_LINK_MEMBERSHIP_OUTCOME_KEYS, GHOST_REMOVAL_REFUSAL_KEYS } from '../types/stats.js';
import { MEMBER_ASSIGNABLE_TEAM_ROLES } from '../types/unions.js';
import { contactPhoneSchema, displayNameSchema, teamNameSchema } from './atoms.js';

const teamCreationFields = {
  leagueId: leagueIdSchema,
  name: teamNameSchema,
  icon: teamIconSchema,
  teamType: teamTypeSchema.optional(),
  contactPhone: contactPhoneSchema,
};

export const CreateLeagueTeamInputSchema = z.object(teamCreationFields).strict();
export type CreateLeagueTeamInput = z.infer<typeof CreateLeagueTeamInputSchema>;

export const AdminCreateLeagueTeamInputSchema = z
  .object({ ...teamCreationFields, captainDisplayName: displayNameSchema })
  .strict();
export type AdminCreateLeagueTeamInput = z.infer<typeof AdminCreateLeagueTeamInputSchema>;

export const CreateLeagueTeamResultSchema = z
  .object({ leagueId: leagueIdSchema, teamId: teamIdSchema, captainUserId: userIdSchema })
  .strict();
export type CreateLeagueTeamResult = z.infer<typeof CreateLeagueTeamResultSchema>;

export const ghostCreateRequestIdSchema = documentIdSegmentSchema.refine(
  (requestId) => isDocumentIdSegment(buildGhostUserIdForRequest(requestId)),
  'Not a ghost add request id.',
);

export const CreateGhostPlayerInputSchema = z
  .object({
    teamId: teamIdSchema,
    displayName: displayNameSchema,
    requestId: ghostCreateRequestIdSchema,
  })
  .strict();
export type CreateGhostPlayerInput = z.infer<typeof CreateGhostPlayerInputSchema>;

export const CreateGhostPlayerGameRosterInputSchema = z
  .object({
    gameId: gameIdSchema,
    teamId: teamIdSchema,
    displayName: displayNameSchema,
    requestId: ghostCreateRequestIdSchema,
  })
  .strict();
export type CreateGhostPlayerGameRosterInput = z.infer<
  typeof CreateGhostPlayerGameRosterInputSchema
>;

export const CreateGhostPlayerResultSchema = z
  .object({
    leagueId: leagueIdSchema,
    teamId: teamIdSchema,
    ghostUserId: userIdSchema,
  })
  .strict();
export type CreateGhostPlayerResult = z.infer<typeof CreateGhostPlayerResultSchema>;

export const GetSportLeagueJoinWarningInputSchema = z
  .object({
    leagueId: leagueIdSchema,
    userId: userIdSchema,
    targetTeamId: teamIdSchema.optional(),
    actedOn: leagueJoinWarningActedOnSchema.optional(),
  })
  .strict();
export type GetSportLeagueJoinWarningInput = z.infer<typeof GetSportLeagueJoinWarningInputSchema>;

export const GetSportLeagueJoinWarningResultSchema = z
  .object({
    leagueId: leagueIdSchema,
    userId: userIdSchema,
    findings: z.array(leagueJoinWarningFindingSchema),
  })
  .strict();
export type GetSportLeagueJoinWarningResult = z.infer<typeof GetSportLeagueJoinWarningResultSchema>;

export const LinkGhostPlayerInputSchema = z
  .object({
    teamId: teamIdSchema,
    ghostUserId: userIdSchema,
    userId: userIdSchema,
  })
  .strict();
export type LinkGhostPlayerInput = z.infer<typeof LinkGhostPlayerInputSchema>;

export const LinkGhostPlayerResultSchema = z
  .object({
    leagueId: leagueIdSchema,
    teamId: teamIdSchema,
    ghostUserId: userIdSchema,
    userId: userIdSchema,
    membershipOutcome: z.enum(GHOST_LINK_MEMBERSHIP_OUTCOME_KEYS),
    publicUserDeleted: z.boolean(),
  })
  .strict();
export type LinkGhostPlayerResult = z.infer<typeof LinkGhostPlayerResultSchema>;

export const AdminUpdateGhostPlayerLinkClosedLeagueInputSchema = LinkGhostPlayerInputSchema;
export type AdminUpdateGhostPlayerLinkClosedLeagueInput = LinkGhostPlayerInput;
export const AdminUpdateGhostPlayerLinkClosedLeagueResultSchema = LinkGhostPlayerResultSchema;
export type AdminUpdateGhostPlayerLinkClosedLeagueResult = LinkGhostPlayerResult;

export const ghostUserIdSchema = userIdSchema.refine(isGhostUserId, 'Not a ghost player.');

export const UpdateTeamMembershipRoleInputSchema = z
  .object({
    teamId: teamIdSchema,
    userId: userIdSchema,
    role: z.enum(MEMBER_ASSIGNABLE_TEAM_ROLES),
  })
  .strict();
export type UpdateTeamMembershipRoleInput = z.infer<typeof UpdateTeamMembershipRoleInputSchema>;

export const UpdateTeamMembershipRoleResultSchema = z
  .object({
    leagueId: leagueIdSchema,
    teamId: teamIdSchema,
    userId: userIdSchema,
    role: teamRoleSchema,
    changed: z.boolean(),
  })
  .strict();
export type UpdateTeamMembershipRoleResult = z.infer<typeof UpdateTeamMembershipRoleResultSchema>;

export const DeleteTeamMembershipInputSchema = z
  .object({
    teamId: teamIdSchema,
    userId: userIdSchema.refine(
      (userId) => !isGhostUserId(userId),
      'A ghost player is removed as a ghost player.',
    ),
  })
  .strict();
export type DeleteTeamMembershipInput = z.infer<typeof DeleteTeamMembershipInputSchema>;

export const DeleteTeamMembershipResultSchema = z
  .object({
    leagueId: leagueIdSchema,
    teamId: teamIdSchema,
    userId: userIdSchema,
    deleted: z.boolean(),
  })
  .strict();
export type DeleteTeamMembershipResult = z.infer<typeof DeleteTeamMembershipResultSchema>;

export const DeleteGhostPlayerInputSchema = z
  .object({ teamId: teamIdSchema, ghostUserId: ghostUserIdSchema })
  .strict();
export type DeleteGhostPlayerInput = z.infer<typeof DeleteGhostPlayerInputSchema>;

export const DeleteGhostPlayerResultSchema = z
  .object({
    leagueId: leagueIdSchema,
    teamId: teamIdSchema,
    ghostUserId: userIdSchema,
    finishedGameEntriesRemoved: countSchema,
    publicUserDeleted: z.boolean(),
  })
  .strict();
export type DeleteGhostPlayerResult = z.infer<typeof DeleteGhostPlayerResultSchema>;

export const GhostRemovalRefusalDetailsSchema = z
  .object({ reason: z.enum(GHOST_REMOVAL_REFUSAL_KEYS) })
  .strict();
export type GhostRemovalRefusalDetails = z.infer<typeof GhostRemovalRefusalDetailsSchema>;

export const AdminUpdateLeagueTeamCaptainInputSchema = z
  .object({ teamId: teamIdSchema, captainUserId: userIdSchema })
  .strict();
export type AdminUpdateLeagueTeamCaptainInput = z.infer<
  typeof AdminUpdateLeagueTeamCaptainInputSchema
>;

export const AdminUpdateLeagueTeamCaptainResultSchema = z
  .object({
    leagueId: leagueIdSchema,
    teamId: teamIdSchema,
    captainUserId: userIdSchema,
    demotedUserIds: z.array(userIdSchema),
    changed: z.boolean(),
  })
  .strict();
export type AdminUpdateLeagueTeamCaptainResult = z.infer<
  typeof AdminUpdateLeagueTeamCaptainResultSchema
>;

export const AdminUpdateLeagueTeamNameInputSchema = z
  .object({ teamId: teamIdSchema, name: teamNameSchema })
  .strict();
export type AdminUpdateLeagueTeamNameInput = z.infer<typeof AdminUpdateLeagueTeamNameInputSchema>;

export const AdminUpdateLeagueTeamTypeInputSchema = z
  .object({ teamId: teamIdSchema, teamType: teamTypeSchema })
  .strict();
export type AdminUpdateLeagueTeamTypeInput = z.infer<typeof AdminUpdateLeagueTeamTypeInputSchema>;

export const AdminUpdateLeagueTeamResultSchema = z
  .object({ leagueId: leagueIdSchema, teamId: teamIdSchema, changed: z.boolean() })
  .strict();
export type AdminUpdateLeagueTeamResult = z.infer<typeof AdminUpdateLeagueTeamResultSchema>;

export const AdminUpdateLeagueTeamContactInputSchema = z
  .object({ teamId: teamIdSchema, contactPhone: contactPhoneSchema })
  .strict();
export type AdminUpdateLeagueTeamContactInput = z.infer<
  typeof AdminUpdateLeagueTeamContactInputSchema
>;

export const AdminUpdateLeagueTeamContactResultSchema = AdminUpdateLeagueTeamResultSchema;
export type AdminUpdateLeagueTeamContactResult = AdminUpdateLeagueTeamResult;

export const AdminDeleteLeagueTeamInputSchema = z.object({ teamId: teamIdSchema }).strict();
export type AdminDeleteLeagueTeamInput = z.infer<typeof AdminDeleteLeagueTeamInputSchema>;

export const AdminDeleteLeagueTeamResultSchema = z.object({ teamId: teamIdSchema }).strict();
export type AdminDeleteLeagueTeamResult = z.infer<typeof AdminDeleteLeagueTeamResultSchema>;

export const LEAGUE_TEAM_DELETE_REFUSAL_KEYS = ['teamHasPlayed'] as const;
export type LeagueTeamDeleteRefusal = (typeof LEAGUE_TEAM_DELETE_REFUSAL_KEYS)[number];
export const LeagueTeamDeleteRefusalDetailsSchema = z
  .object({ reason: z.enum(LEAGUE_TEAM_DELETE_REFUSAL_KEYS) })
  .strict();
export type LeagueTeamDeleteRefusalDetails = z.infer<typeof LeagueTeamDeleteRefusalDetailsSchema>;
