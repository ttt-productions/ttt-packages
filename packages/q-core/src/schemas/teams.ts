// Callable contracts for teams and team membership. The acting user is always `request.auth.uid` —
// never an input field (ARCH-106). The entry, never a field of the payload, decides the authority
// (BACKEND-004); an admin entry's schema adds only what its authority needs.

import { z } from 'zod';
import {
  leagueJoinWarningActedOnSchema,
  leagueJoinWarningFindingSchema,
} from '../utils/league-join-warning.js';
import { documentIdSegmentSchema, membershipRosterSyncStatusSchema } from '../doc-schemas/atoms.js';
import { buildGhostUserIdForRequest, isGhostUserId } from '../ids/minted-ids.js';
import { isDocumentIdSegment } from '../paths/utils.js';
import { GHOST_LINK_MEMBERSHIP_OUTCOME_KEYS } from '../types/stats.js';
import { MEMBER_ASSIGNABLE_TEAM_ROLES } from '../types/unions.js';
import {
  contactPhoneSchema,
  countSchema,
  displayNameSchema,
  gameIdSchema,
  leagueIdSchema,
  teamIconSchema,
  teamIdSchema,
  teamNameSchema,
  teamRoleSchema,
  teamTypeSchema,
  userIdSchema,
} from './atoms.js';

// ---------------------------------------------------------------------------------------------
// Team creation — `createLeagueTeam` (the creator becomes captain) and `adminCreateLeagueTeam`
// (an admin creates the team with a newly minted ghost captain). Both write the team's contact
// phone; `teamType` is read only in a Competitive/Recreational league, which requires it.
// ---------------------------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------------------------
// Ghost add — one core behind two doors. The team page door (`createTeamGhostPlayer` /
// `adminCreateTeamGhostPlayer`) needs authority over the team; the game page door
// (`createGameGhostPlayer` / `adminCreateGameGhostPlayer`) needs scoring authority over the game
// and adds to one of its two teams. The ghost id is derived by the server from the add's
// `requestId`, which the client mints once when the add starts and re-sends on every retry, so a
// retry after an unknown outcome is recognised as the same add (`buildGhostUserIdForRequest`).
// ---------------------------------------------------------------------------------------------

// One document-id segment (ARCH-106), short enough that the ghost id derived from it is one too.
export const ghostCreateRequestIdSchema = documentIdSegmentSchema.refine(
  (requestId) => isDocumentIdSegment(buildGhostUserIdForRequest(requestId)),
  'Not a ghost add request id.',
);

export const CreateTeamGhostPlayerInputSchema = z
  .object({ teamId: teamIdSchema, displayName: displayNameSchema, requestId: ghostCreateRequestIdSchema })
  .strict();
export type CreateTeamGhostPlayerInput = z.infer<typeof CreateTeamGhostPlayerInputSchema>;

export const CreateGameGhostPlayerInputSchema = z
  .object({
    gameId: gameIdSchema,
    teamId: teamIdSchema,
    displayName: displayNameSchema,
    requestId: ghostCreateRequestIdSchema,
  })
  .strict();
export type CreateGameGhostPlayerInput = z.infer<typeof CreateGameGhostPlayerInputSchema>;

// `rosterSyncStatus` is where the new membership's roster work stood when the call returned: the
// membership is committed either way, and `pending` finishes in the background.
export const CreateGhostPlayerResultSchema = z
  .object({
    leagueId: leagueIdSchema,
    teamId: teamIdSchema,
    ghostUserId: userIdSchema,
    rosterSyncStatus: membershipRosterSyncStatusSchema,
  })
  .strict();
export type CreateGhostPlayerResult = z.infer<typeof CreateGhostPlayerResultSchema>;

// ---------------------------------------------------------------------------------------------
// The join warning — `getLeagueJoinWarning` (the person, or a captain or co-captain of the target
// team) and `adminGetLeagueJoinWarning` (an admin, about anyone).
// ---------------------------------------------------------------------------------------------

// `targetTeamId` is the team the door acts for; a free-agent signup and a team being created have
// none. `actedOn` is the item the door answers, which the warning leaves out.
export const GetLeagueJoinWarningInputSchema = z
  .object({
    leagueId: leagueIdSchema,
    userId: userIdSchema,
    targetTeamId: teamIdSchema.optional(),
    actedOn: leagueJoinWarningActedOnSchema.optional(),
  })
  .strict();
export type GetLeagueJoinWarningInput = z.infer<typeof GetLeagueJoinWarningInputSchema>;

export const GetLeagueJoinWarningResultSchema = z
  .object({
    leagueId: leagueIdSchema,
    userId: userIdSchema,
    findings: z.array(leagueJoinWarningFindingSchema),
  })
  .strict();
export type GetLeagueJoinWarningResult = z.infer<typeof GetLeagueJoinWarningResultSchema>;

// ---------------------------------------------------------------------------------------------
// Roster reconciliation recovery — an admin puts a team's failed roster obligations back to work.
// ---------------------------------------------------------------------------------------------

export const AdminRetryLeagueTeamRosterSyncInputSchema = z.object({ teamId: teamIdSchema }).strict();
export type AdminRetryLeagueTeamRosterSyncInput = z.infer<typeof AdminRetryLeagueTeamRosterSyncInputSchema>;

export const AdminRetryLeagueTeamRosterSyncResultSchema = z
  .object({
    teamId: teamIdSchema,
    // Failed obligations put back to pending.
    retried: countSchema,
    // Of those and any already pending, how many the call itself finished.
    reconciled: countSchema,
    // Failed obligations left as they are because they fail their schema, by document id; a
    // damaged document's id is reported as stored, so it is not held to the membership id format.
    damagedTeamMembershipIds: z.array(z.string().min(1)),
  })
  .strict();
export type AdminRetryLeagueTeamRosterSyncResult = z.infer<typeof AdminRetryLeagueTeamRosterSyncResultSchema>;

// ---------------------------------------------------------------------------------------------
// Linking a ghost to a real account — `linkGhostPlayerToUser` in a league that is not closed, and
// `adminLinkClosedLeagueGhostPlayer` in a closed one. Both are admin-only and act on one team. A link
// takes no reason: the admin chooses the account and confirms, and the link's audit event records
// who linked which ghost to whom and what moved (BACKEND-212). The ghost and the account are
// ids the core checks itself, so a ghost id named as the account, or a real id named as the ghost,
// is refused with a failure record rather than at the parse. Every name the link records is read
// server-side, never sent.
// ---------------------------------------------------------------------------------------------

export const LinkGhostPlayerInputSchema = z
  .object({
    teamId: teamIdSchema,
    ghostUserId: userIdSchema,
    userId: userIdSchema,
  })
  .strict();
export type LinkGhostPlayerInput = z.infer<typeof LinkGhostPlayerInputSchema>;

// `complete` is false when the call ran out of time part-way: the link stays under way, and the same
// call by the same account continues it. `membershipOutcome` is present once it is complete.
// `publicUserDeleted` is false when something else still names the ghost.
export const LinkGhostPlayerResultSchema = z
  .object({
    leagueId: leagueIdSchema,
    teamId: teamIdSchema,
    ghostUserId: userIdSchema,
    userId: userIdSchema,
    complete: z.boolean(),
    gamesMoved: countSchema,
    membershipOutcome: z.enum(GHOST_LINK_MEMBERSHIP_OUTCOME_KEYS).optional(),
    publicUserDeleted: z.boolean(),
  })
  .strict();
export type LinkGhostPlayerResult = z.infer<typeof LinkGhostPlayerResultSchema>;

export const AdminLinkClosedLeagueGhostPlayerInputSchema = LinkGhostPlayerInputSchema;
export type AdminLinkClosedLeagueGhostPlayerInput = LinkGhostPlayerInput;
export const AdminLinkClosedLeagueGhostPlayerResultSchema = LinkGhostPlayerResultSchema;
export type AdminLinkClosedLeagueGhostPlayerResult = LinkGhostPlayerResult;

// ---------------------------------------------------------------------------------------------
// Managing a team's members. A role change and a removal each have a member entry — the team's
// captain or a co-captain, read from their membership — and an admin entry; changing the captain,
// renaming the team, changing its type, setting its contact phone, and deleting it are admin-only.
// Every target is named by id and read server-side; nothing here names who is acting (ARCH-106).
// ---------------------------------------------------------------------------------------------

/** A ghost id, refused for any other id, so a removal input cannot name a real account. */
export const ghostUserIdSchema = userIdSchema.refine(isGhostUserId, 'Not a ghost player.');

// `updateTeamMembershipRole` (the captain) / `adminUpdateTeamMembershipRole`: promote a player to
// co-captain, or demote a co-captain to player.
export const UpdateTeamMembershipRoleInputSchema = z
  .object({ teamId: teamIdSchema, userId: userIdSchema, role: z.enum(MEMBER_ASSIGNABLE_TEAM_ROLES) })
  .strict();
export type UpdateTeamMembershipRoleInput = z.infer<typeof UpdateTeamMembershipRoleInputSchema>;

// `changed` is false when the member already held the role: nothing was written or recorded.
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

// `deleteTeamMembership` (the captain or a co-captain) / `adminDeleteTeamMembership`: remove a real
// player from the team. A ghost is removed through its own action, below.
export const DeleteTeamMembershipInputSchema = z
  .object({
    teamId: teamIdSchema,
    userId: userIdSchema.refine((userId) => !isGhostUserId(userId), 'A ghost player is removed as a ghost player.'),
  })
  .strict();
export type DeleteTeamMembershipInput = z.infer<typeof DeleteTeamMembershipInputSchema>;

// `deleted` is false when the person held no membership on the team: nothing was written. The
// membership is gone either way; `rosterSyncStatus` is where its roster work stood on return.
export const DeleteTeamMembershipResultSchema = z
  .object({
    leagueId: leagueIdSchema,
    teamId: teamIdSchema,
    userId: userIdSchema,
    deleted: z.boolean(),
    rosterSyncStatus: membershipRosterSyncStatusSchema,
  })
  .strict();
export type DeleteTeamMembershipResult = z.infer<typeof DeleteTeamMembershipResultSchema>;

// `deleteTeamGhostPlayer` (the captain or a co-captain) / `adminDeleteTeamGhostPlayer`: remove a ghost
// that has never played, completely. A never-played ghost holds no stat, so its removal is not a
// repair and takes no reason; its audit event still records who removed what (BACKEND-212).
export const DeleteTeamGhostPlayerInputSchema = z
  .object({ teamId: teamIdSchema, ghostUserId: ghostUserIdSchema })
  .strict();
export type DeleteTeamGhostPlayerInput = z.infer<typeof DeleteTeamGhostPlayerInputSchema>;

// `complete` is false when the call ran out of time part-way: the ghost's games stay held and the
// same call finishes the removal. `finishedGameEntriesRemoved` is the whole removal's count so far,
// never one call's share, so a later response replaces an earlier one. `publicUserDeleted` is false
// when something else still names the ghost, so its name stays until that reference goes.
export const DeleteTeamGhostPlayerResultSchema = z
  .object({
    leagueId: leagueIdSchema,
    teamId: teamIdSchema,
    ghostUserId: userIdSchema,
    complete: z.boolean(),
    finishedGameEntriesRemoved: countSchema,
    publicUserDeleted: z.boolean(),
  })
  .strict();
export type DeleteTeamGhostPlayerResult = z.infer<typeof DeleteTeamGhostPlayerResultSchema>;

// `adminUpdateLeagueTeamCaptain`: make a member of the team its captain. Every other captain the team
// holds becomes a player.
export const AdminUpdateLeagueTeamCaptainInputSchema = z
  .object({ teamId: teamIdSchema, captainUserId: userIdSchema })
  .strict();
export type AdminUpdateLeagueTeamCaptainInput = z.infer<typeof AdminUpdateLeagueTeamCaptainInputSchema>;

export const AdminUpdateLeagueTeamCaptainResultSchema = z
  .object({
    leagueId: leagueIdSchema,
    teamId: teamIdSchema,
    captainUserId: userIdSchema,
    demotedUserIds: z.array(userIdSchema),
    changed: z.boolean(),
  })
  .strict();
export type AdminUpdateLeagueTeamCaptainResult = z.infer<typeof AdminUpdateLeagueTeamCaptainResultSchema>;

// `adminUpdateLeagueTeamName`: rename a team. The name lives on the team alone; nothing copies it.
export const AdminUpdateLeagueTeamNameInputSchema = z
  .object({ teamId: teamIdSchema, name: teamNameSchema })
  .strict();
export type AdminUpdateLeagueTeamNameInput = z.infer<typeof AdminUpdateLeagueTeamNameInputSchema>;

// `adminUpdateLeagueTeamType`: change a team's type in a league that sorts its teams by type.
export const AdminUpdateLeagueTeamTypeInputSchema = z
  .object({ teamId: teamIdSchema, teamType: teamTypeSchema })
  .strict();
export type AdminUpdateLeagueTeamTypeInput = z.infer<typeof AdminUpdateLeagueTeamTypeInputSchema>;

// The answer to either edit: `changed` is false when the team already held the value.
export const AdminUpdateLeagueTeamResultSchema = z
  .object({ leagueId: leagueIdSchema, teamId: teamIdSchema, changed: z.boolean() })
  .strict();
export type AdminUpdateLeagueTeamResult = z.infer<typeof AdminUpdateLeagueTeamResultSchema>;

// `adminUpdateLeagueTeamContact`: set the team's contact phone on its admin-only contact document.
export const AdminUpdateLeagueTeamContactInputSchema = z
  .object({ teamId: teamIdSchema, contactPhone: contactPhoneSchema })
  .strict();
export type AdminUpdateLeagueTeamContactInput = z.infer<typeof AdminUpdateLeagueTeamContactInputSchema>;

export const AdminUpdateLeagueTeamContactResultSchema = AdminUpdateLeagueTeamResultSchema;
export type AdminUpdateLeagueTeamContactResult = AdminUpdateLeagueTeamResult;

// `adminDeleteLeagueTeam`: delete a team that has never played, with everything that is only its.
// A never-played team holds no stat, so its deletion is not a repair and takes no reason; its audit
// event still records who deleted what (BACKEND-212).
export const AdminDeleteLeagueTeamInputSchema = z.object({ teamId: teamIdSchema }).strict();
export type AdminDeleteLeagueTeamInput = z.infer<typeof AdminDeleteLeagueTeamInputSchema>;

// `complete` is false when the call ran out of time part-way: what is left stays, the team still
// stands, and the same call finishes the deletion. `remainingGameCount` is the team's games still to
// delete when it stopped.
export const AdminDeleteLeagueTeamResultSchema = z
  .object({
    teamId: teamIdSchema,
    complete: z.boolean(),
    remainingGameCount: countSchema,
  })
  .strict();
export type AdminDeleteLeagueTeamResult = z.infer<typeof AdminDeleteLeagueTeamResultSchema>;
