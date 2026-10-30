import type { SystemRole } from './unions.js';
import { CAPTAIN_TEAM_ROLES } from './unions.js';

export const AUDIT_EVENT_TYPE_KEYS = [
  'user.accountRegistered',
  'user.displayNameChanged',
  'user.abandonedRegistrationDeleted',
  'user.signedIn',
  'user.passwordResetCompleted',
  'user.accountBanned',
  'user.accountUnbanned',
  'admin.systemRoleGranted',
  'admin.systemRoleRevoked',
  'admin.systemRoleClaimSynced',
  'appConfig.updated',
  'landingPage.updated',
  'league.created',
  'league.updated',
  'league.statusChanged',
  'league.modeSwitched',
  'waiverTemplate.created',
  'waiverTemplate.versionPublished',
  'waiverTemplate.retired',
  'waiverTemplate.deleted',
  'gameLocation.created',
  'gameLocation.updated',
  'gameLocation.deleted',
  'picture.added',
  'picture.replaced',
  'picture.moved',
  'picture.featuredChanged',
  'picture.removed',
  'award.created',
  'award.badgeReplaced',
  'award.deleted',
  'award.granted',
  'award.revoked',
  'hardwareLoanContract.created',
  'hardwareLoanContract.signed',
  'hardwareLoanContract.returned',
  'hardwareLoanContract.deleted',
  'leagueTeam.created',
  'ghostPlayer.created',
  'teamRoster.syncRetried',
  'teamMembership.roleChanged',
  'leagueTeam.captainChanged',
  'leagueTeam.updated',
  'leagueTeamContact.updated',
  'teamMembership.removed',
  'ghostPlayer.removed',
  'ghostPlayer.linked',
  'ghostPlayer.closedLeagueLinked',
  'leagueTeam.deleted',
  'ghostPlayer.removalStopped',
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
  'signedWaiver.created',
  'scheduleWeek.created',
  'scheduleWeek.updated',
  'sportGame.created',
  'sportGame.updated',
  'sportGame.deleted',
  'sportGame.statEventsRejected',
  'sportGame.absenceChanged',
  'sportGame.memoUpdated',
  'sportGame.jumpBallChanged',
  'sportGame.finalized',
  'sportGame.reopened',
  'sportGame.statsCorrected',
  'sportGame.statsRecalculated',
  'stats.aggregateRecalculated',
  'stats.historicalStatsUpdated',
  'stats.validationRun',
  'stats.validationReportDeleted',
  'stats.unrosteredStatLineResolved',
  'adminNotification.archived',
  'adminNotification.archiveAllRequested',
  'system.manualIntervention',
  'migrationAction.pageRun',
  'migrationAction.writesCommitted',
  'migrationAction.controlRecorded',
  'migrationAction.checkpointRecorded',
  'migrationConsole.cutoverRecorded',
] as const;
export type AuditEventType = (typeof AUDIT_EVENT_TYPE_KEYS)[number];

export const GHOST_LINK_AUDIT_EVENT_TYPE_KEYS = [
  'ghostPlayer.linked',
  'ghostPlayer.closedLeagueLinked',
] as const satisfies readonly AuditEventType[];
export type GhostLinkAuditEventType = (typeof GHOST_LINK_AUDIT_EVENT_TYPE_KEYS)[number];

export const AUDIT_ACTOR_MODE_KEYS = [
  'user',
  'teammateUser',
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
  'teammateUser',
  'system',
] as const satisfies readonly AuditActorMode[];
export type AuditNonAdminActorMode = (typeof AUDIT_NON_ADMIN_ACTOR_MODE_KEYS)[number];

export const AUDIT_SYSTEM_REASON_KEYS = ['trigger', 'scheduledJob', 'migration'] as const;
export type AuditSystemReason = (typeof AUDIT_SYSTEM_REASON_KEYS)[number];

export type CaptainTeamRole = (typeof CAPTAIN_TEAM_ROLES)[number];

export type AuditActor =
  | { uid: string | null; isAdmin: boolean; actorMode: AuditNonAdminActorMode; systemRole?: never }
  | {
      uid: string | null;
      isAdmin: boolean;
      actorMode: AuditAdminActorMode;
      systemRole: SystemRole;
    };

export interface AuditTarget {
  uid: string | null;
  ref: string | null;
}

export const AUDIT_RESULT_KEYS = ['success', 'failure'] as const;
export type AuditResult = (typeof AUDIT_RESULT_KEYS)[number];
