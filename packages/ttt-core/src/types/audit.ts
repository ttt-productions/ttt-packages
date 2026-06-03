// TTT audit event catalog. The `AuditEventType` union is the canonical list
// of all sensitive actions the system logs. The `TTTAuditActor` and
// `TTTAuditTarget` shapes describe who performed the action and what was
// affected. `TTTAuditEvent` specializes the generic `AuditEvent` from
// @ttt-productions/audit-core with the TTT-specific shapes.
//
// Backend writers and future native/TV/console readers all consume this
// catalog from here.

import type { AuditEvent } from '@ttt-productions/audit-core';

export type AuditEventType =
  // user status
  | 'artisanCreator.grantedToUser'
  | 'artisanCreator.revokedFromUser'
  | 'user.accountRegistered'
  | 'user.statusChanged'
  | 'user.accountBanned'
  | 'user.accountUnbanned'
  // admin actions
  | 'admin.systemRoleGranted'
  | 'admin.systemRoleRevoked'
  | 'admin.systemRoleSyncedFromDirectEdit'
  | 'admin.contentAppealReviewed'
  | 'admin.violationDecisionAccepted'
  | 'admin.thresholdItemReviewed'
  | 'admin.futurePlansUpdated'
  | 'admin.rulesAndAgreementsUpdated'
  // workProject
  | 'workProject.created'
  | 'workProject.guildmateUserGuildStandingChanged'
  | 'workProject.guildmateUserTradeProfessionsChanged'
  | 'workProject.publicDetailsUpdated'
  | 'workProject.workAssetDeleted'
  | 'workProject.guildInviteSent'
  | 'workProject.guildInviteAccepted'
  | 'workProject.guildInviteDeclined'
  | 'workProject.guildInviteCancelled'
  | 'workProject.guildInviteStakeSharesUpdated'
  | 'workProject.commissionListingCreated'
  | 'workProject.commissionProposalCreated'
  | 'workProject.commissionProposalAccepted'
  | 'workProject.commissionClosed'
  | 'workProject.commissionDeleted'
  | 'workProject.commissionProposalSaveToggled'
  | 'workProject.commissionProposalRejected'
  | 'workProject.stakeSharesChanged'
  | 'workProject.stakeShares.created'
  | 'workProject.stakeShares.increased'
  | 'workProject.stakeShares.anomaly'
  // craft-skills
  | 'craftSkill.userCraftSkillDeleted'
  // content
  | 'content.itemReported'
  | 'content.violationRecorded'
  | 'content.thresholdItemSubmitted'
  | 'content.hallItemPublished'
  | 'content.appealSubmitted'
  | 'content.violationAccepted'
  // content (workProject content)
  | 'content.taleDetailsUpdated'
  | 'content.taleWorkGenresUpdated'
  | 'content.chapterCreated'
  | 'content.chapterDetailsUpdated'
  | 'content.tuneDetailsUpdated'
  | 'content.tuneWorkGenresUpdated'
  | 'content.tuneTrackCreated'
  | 'content.tuneTrackDetailsUpdated'
  | 'content.televisionDetailsUpdated'
  | 'content.televisionWorkGenresUpdated'
  | 'content.televisionEpisodeCreated'
  | 'content.televisionEpisodeDetailsUpdated'
  // money
  | 'payment.sessionCreated'
  | 'payment.pledgePaymentCompleted'
  | 'payment.pledgePaymentAbandoned'
  | 'payment.pledgePaymentFailed'
  // admin task lifecycle
  | 'admin.taskCheckedOut'
  | 'admin.taskCheckedIn'
  | 'admin.taskReleased'
  | 'admin.taskAutoReleased'
  | 'admin.taskDeferredLater'
  // audition
  | 'workProject.auditionCreated'
  | 'admin.auditionCreated'
  | 'audition.entryCreated'
  | 'audition.closedByUser'
  // system
  | 'system.manualIntervention'
  | 'system.appConfigUpdated'
  | 'system.pledgePaymentsArchived'
  | 'system.pendingMediaArchived'
  | 'system.orphanUploadsCleanedUp'
  | 'admin.profanityListSeeded'
  | 'admin.profanityListCurated'
  // social
  | 'social.squareStreetzPostLiked'
  | 'social.squareStreetzPostUnliked'
  | 'social.targetFollowed'
  | 'social.targetUnfollowed'
  // chat
  | 'chat.guildChatChannelCreated'
  | 'chat.guildChatChannelUpdated'
  | 'chat.guildChatChannelArchived'
  | 'chat.guildChatMessageSent'
  | 'chat.adminThreadStarted'
  | 'chat.adminThreadStatusChanged'
  | 'chat.attachmentTimedOut'
  // notification (admin-only). Actor mode is always adminReview / adminOverride.
  // Payload shapes: NotificationBroadcastSentAuditMetadata /
  // NotificationAdminArchivedAuditMetadata in ../schemas/notification.ts.
  | 'notification.broadcastSent'
  | 'notification.adminArchived'
  // workProject
  | 'workProject.released'
  | 'workProject.hidden'
  | 'workProject.restored'
  | 'workRealm.created'
  | 'workRealm.released'
  | 'workRealm.detailsUpdated'
  | 'workRealm.hidden'
  | 'workRealm.restored';

/**
 * How the actor was acting when the audited action was performed. This is
 * orthogonal to the event name — the same event type can be produced by
 * different actor modes (e.g. a normal member vs. an admin override).
 *
 * - 'user'          — authenticated action not tied to project membership
 * - 'projectMember' — acting through normal Work/project (guild standing) permissions
 * - 'adminReview'   — admin queue/support work on admin surfaces (no project-permission concept)
 * - 'adminOverride' — system-admin authority superseding normal user/project permission
 * - 'system'        — backend automation: trigger, scheduled job, migration, media pipeline
 */
export type TTTAuditActorMode =
  | 'user'
  | 'projectMember'
  | 'adminReview'
  | 'adminOverride'
  | 'system';

/** Fields common to every audited actor regardless of mode. `isAdmin` is
 * claim-present metadata only — it records that the caller held an admin
 * claim at the time, NOT that the action was an override. */
export type TTTAuditActorBase = {
  uid: string | null;
  isAdmin: boolean;
};

/** TTT actor shape, discriminated on `actorMode`. The admin system role is
 * REQUIRED on admin modes (adminReview / adminOverride) and FORBIDDEN on
 * non-admin modes (user / projectMember / system) — so an admin action can
 * never be audited without recording full-vs-jr, and a non-admin action can
 * never carry a spurious role. */
export type TTTAuditActor =
  | (TTTAuditActorBase & {
      actorMode: 'user' | 'projectMember' | 'system';
      systemRole?: never;
    })
  | (TTTAuditActorBase & {
      actorMode: 'adminReview' | 'adminOverride';
      systemRole: 'admin' | 'jrAdmin';
    });

/**
 * TTT target shape: the uid the audited action affects (if any), plus the
 * Firestore path of the affected document (if any).
 */
export type TTTAuditTarget = { uid: string | null; ref: string | null };

/**
 * The canonical TTT audit event document shape. Specializes the generic
 * `AuditEvent` from @ttt-productions/audit-core with the TTT event-type
 * union, actor shape, target shape, and a generic metadata bag.
 */
export type TTTAuditEvent = AuditEvent<
  AuditEventType,
  TTTAuditActor,
  TTTAuditTarget,
  Record<string, unknown>
>;

