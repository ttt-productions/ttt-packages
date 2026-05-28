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
  | 'workProject.memberGuildStandingChanged'
  | 'workProject.memberTradeProfessionsChanged'
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
  | 'system.profanityListSynced'
  | 'system.profanityListSyncSkipped'
  | 'system.orphanUploadsCleanedUp'
  | 'admin.profanityListUpdated'
  // social
  | 'social.squareStreetzPostLiked'
  | 'social.squareStreetzPostUnliked'
  | 'social.userFollowed'
  | 'social.userUnfollowed'
  // chat
  | 'chat.guildChatChannelCreated'
  | 'chat.guildChatChannelUpdated'
  | 'chat.guildChatChannelArchived'
  | 'chat.guildChatMessageSent'
  | 'chat.adminThreadStarted'
  | 'chat.attachmentTimedOut';

/**
 * TTT actor shape: the uid performing an audited action, plus whether they
 * held an admin claim at the time.
 */
export type TTTAuditActor = { uid: string | null; isAdmin: boolean };

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

