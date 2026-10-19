// The audit vocabulary: the closed event-type union (BACKEND-202) and how an actor was acting
// (BACKEND-205). The document schema is in ../doc-schemas/audit-event.ts.
//
// The union is closed: a new sensitive action adds its event types here, in the same change
// (BACKEND-202).

import type { SystemRole } from './unions.js';
import { CAPTAIN_TEAM_ROLES } from './unions.js';

export const AUDIT_EVENT_TYPE_KEYS = [
  // Accounts
  'user.accountRegistered',
  'user.displayNameChanged',
  // The scheduled sweep deleted a sign-in account that never finished registering (no profile)
  'user.abandonedRegistrationDeleted',
  // Account status — an admin banned an account or lifted its ban
  'user.accountBanned',
  'user.accountUnbanned',
  // Global roles — the policy decision (callable) and the claim propagation (trigger)
  'admin.systemRoleGranted',
  'admin.systemRoleRevoked',
  'admin.systemRoleClaimSynced',
  // App configuration — the operational levers on `_appConfig/app`, and the landing page copy
  'appConfig.updated',
  'landingPage.updated',
  // Leagues — created, settings edited, status moved, mode switched
  'league.created',
  'league.updated',
  'league.statusChanged',
  'league.modeSwitched',
  // Waiver templates — created, a new wording published, retired or deleted
  'waiverTemplate.created',
  'waiverTemplate.versionPublished',
  'waiverTemplate.retired',
  'waiverTemplate.deleted',
  // Game locations
  'gameLocation.created',
  'gameLocation.updated',
  'gameLocation.deleted',
  // Pictures — published to a gallery or a slot by the picture processor (attributed to the admin
  // who uploaded it), and ordered, featured, and removed by the admin picture callables
  'picture.added',
  'picture.replaced',
  'picture.moved',
  'picture.featuredChanged',
  'picture.removed',
  // Awards — an award created by its first badge's publication, its badge replaced, the award
  // deleted once nobody holds it, and an award granted to or revoked from one account
  'award.created',
  'award.badgeReplaced',
  'award.deleted',
  'award.granted',
  'award.revoked',
  // Hardware contracts — a loan created for a referee, signed by them, its equipment returned, and a
  // contract never signed deleted
  'hardwareLoanContract.created',
  'hardwareLoanContract.signed',
  'hardwareLoanContract.returned',
  'hardwareLoanContract.deleted',
  // Teams — created with its captain, a ghost player added, a team's failed roster work retried
  'leagueTeam.created',
  'ghostPlayer.created',
  'teamRoster.syncRetried',
  // Team management — a member promoted to co-captain or demoted to player, the captain changed by
  // an admin, the team's name or type edited by an admin, and its contact phone set by an admin
  'teamMembership.roleChanged',
  'leagueTeam.captainChanged',
  'leagueTeam.updated',
  'leagueTeamContact.updated',
  // Exits — a membership removed, a never-played ghost removed, a ghost linked by either link, and a
  // never-played team deleted; each targets what it deleted, which the migration's live
  // verifications read as proof the product removed it
  'teamMembership.removed',
  'ghostPlayer.removed',
  'ghostPlayer.linked',
  'ghostPlayer.closedLeagueLinked',
  'leagueTeam.deleted',
  // A ghost's removal stopped part-way because the ghost came to have played: the games it held are
  // released, and the finished-game entries it had already taken off are named
  'ghostPlayer.removalStopped',
  // Joining a team — an invitation sent, withdrawn, accepted, or declined; a join request sent,
  // withdrawn, accepted, or rejected; a free-agent signup made, withdrawn, or answered by an admin
  // placing the player on a team
  'teamInvitation.created',
  'teamInvitation.cancelled',
  'teamInvitation.accepted',
  'teamInvitation.rejected',
  'teamJoinRequest.created',
  'teamJoinRequest.cancelled',
  'teamJoinRequest.accepted',
  'teamJoinRequest.rejected',
  'leagueFreeAgent.created',
  'leagueFreeAgent.deleted',
  'leagueFreeAgent.assigned',
  // Signed waivers — a legal record, signed by its subject or witnessed for a ghost
  'signedWaiver.created',
  // Schedules — a week created with its games or its shared fields edited; one game added, edited
  // (moved, rescheduled, or its teams replaced), or deleted with its events and roster
  'scheduleWeek.created',
  'scheduleWeek.updated',
  'sportGame.created',
  'sportGame.updated',
  'sportGame.deleted',
  // Live scoring — a scoring write refused its caller's authority (a click writes no success event:
  // the stat event document is its own record), a roster entry marked absent or present, a
  // scorer's note on one person changed, and the jump-ball possession arrow moved
  'sportGame.statEventsRejected',
  'sportGame.absenceChanged',
  'sportGame.memoUpdated',
  'sportGame.jumpBallChanged',
  // Finalizing — a game finalized, its numbers made permanent in every derived destination, and an
  // admin's reopening of a finalized game, which takes them back out
  'sportGame.finalized',
  'sportGame.reopened',
  // Fix stats — a game's numbers corrected (targets, or the stored numbers kept) or restored from
  // its events; a derived aggregate rebuilt; and a person's pre-Q-Sports baseline written
  'sportGame.statsCorrected',
  'sportGame.statsRecalculated',
  'stats.aggregateRecalculated',
  'stats.historicalStatsUpdated',
  // A stats check ran to its end: its scope, its summary, and its counts by kind.
  'stats.validationRun',
  // An admin deleted a stats check's report: its id, scope, summary, and counts by kind.
  'stats.validationReportDeleted',
  // The migration's placement of a recorded stat line no roster entry or play could place: the
  // admin names the team, and the game's copy places the line there
  'stats.unrosteredStatLineResolved',
  // Admin notifications — a shared card archived, which takes it off every admin's list; and an
  // admin's archive-all decision, recorded once when the job is written, with the request's origin
  'adminNotification.archived',
  'adminNotification.archiveAllRequested',
  // An operator's manual intervention in a durable pipeline — a dead-lettered row put back to work,
  // or a refused attempt at one — with the reason the operator gave
  'system.manualIntervention',
  // The migration console — one page of a cutover action run, with what it read, wrote, and found;
  // the documents an action core wrote and removed, committed in the same batch or transaction as
  // those writes (its action id, operation id, and document ids only — BACKEND-203); a product
  // control's run recorded once its evidence checked; an operator checkpoint recorded with its
  // evidence; and the cutover, after which the product owns every destination
  'migrationAction.pageRun',
  'migrationAction.writesCommitted',
  'migrationAction.controlRecorded',
  'migrationAction.checkpointRecorded',
  'migrationConsole.cutoverRecorded',
] as const;
export type AuditEventType = (typeof AUDIT_EVENT_TYPE_KEYS)[number];

// The two ways a ghost is linked to an account — the normal link and the closed-league link — each
// committing its own event over the one artifact-moving core.
export const GHOST_LINK_AUDIT_EVENT_TYPE_KEYS = [
  'ghostPlayer.linked',
  'ghostPlayer.closedLeagueLinked',
] as const satisfies readonly AuditEventType[];
export type GhostLinkAuditEventType = (typeof GHOST_LINK_AUDIT_EVENT_TYPE_KEYS)[number];

// How the actor was acting for the write — never merely which authorities they happen to hold. It is
// orthogonal to the event type: one event type is produced under several modes, and the mode is what
// tells an ordinary action from an admin override.
//   user          a signed-in account acting on its own behalf
//   teamManager   a captain or co-captain acting through their team's membership permissions
//   adminReview   an admin or referee doing admin work that no team permission covers
//   adminOverride an admin or referee superseding the team permission a normal entry checks
//   system        backend automation with no human caller
export const AUDIT_ACTOR_MODE_KEYS = [
  'user',
  'teamManager',
  'adminReview',
  'adminOverride',
  'system',
] as const;
export type AuditActorMode = (typeof AUDIT_ACTOR_MODE_KEYS)[number];

export const AUDIT_ADMIN_ACTOR_MODE_KEYS = [
  'adminReview',
  'adminOverride',
] as const satisfies readonly AuditActorMode[];
export type AuditAdminActorMode = (typeof AUDIT_ADMIN_ACTOR_MODE_KEYS)[number];

export const AUDIT_NON_ADMIN_ACTOR_MODE_KEYS = [
  'user',
  'teamManager',
  'system',
] as const satisfies readonly AuditActorMode[];
export type AuditNonAdminActorMode = (typeof AUDIT_NON_ADMIN_ACTOR_MODE_KEYS)[number];

export const AUDIT_SYSTEM_REASON_KEYS = ['trigger', 'scheduledJob', 'migration'] as const;
export type AuditSystemReason = (typeof AUDIT_SYSTEM_REASON_KEYS)[number];

export type CaptainTeamRole = (typeof CAPTAIN_TEAM_ROLES)[number];

// `isAdmin` is metadata only: it records that the caller's token carried a global-role claim (admin
// or referee) when they acted, and grants nothing. `systemRole` is required on the admin modes and
// forbidden on the others, so an admin action is never recorded without the authority it used and a
// non-admin action never carries one.
export type AuditActor =
  | { uid: string | null; isAdmin: boolean; actorMode: AuditNonAdminActorMode; systemRole?: never }
  | {
      uid: string | null;
      isAdmin: boolean;
      actorMode: AuditAdminActorMode;
      systemRole: SystemRole;
    };

export interface AuditTarget {
  // The user the action was performed on, when there is one.
  uid: string | null;
  // The slash path of the document the action changed, when there is one.
  ref: string | null;
}

export const AUDIT_RESULT_KEYS = ['success', 'failure'] as const;
export type AuditResult = (typeof AUDIT_RESULT_KEYS)[number];
