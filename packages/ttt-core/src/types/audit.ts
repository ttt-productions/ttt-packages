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
  | 'admin.roleGranted'
  | 'admin.roleRevoked'
  | 'admin.roleSyncedFromDirectEdit'
  | 'admin.contentAppealReviewed'
  | 'admin.violationDecisionAccepted'
  | 'admin.libraryItemReviewed'
  | 'admin.futurePlansUpdated'
  | 'admin.rulesAndAgreementsUpdated'
  // workProject
  | 'workProject.newProjectCreated'
  | 'workProject.memberRoleChanged'
  | 'workProject.memberProfessionsChanged'
  | 'workProject.publicDetailsUpdated'
  | 'workProject.fileDeleted'
  | 'workProject.userInvited'
  | 'workProject.inviteAccepted'
  | 'workProject.inviteDeclined'
  | 'workProject.inviteCancelled'
  | 'workProject.inviteSharesUpdated'
  | 'workProject.jobListingCreated'
  | 'workProject.jobApplicationCreated'
  | 'workProject.jobApplicantAccepted'
  | 'workProject.jobClosed'
  | 'workProject.jobDeleted'
  | 'workProject.jobApplicantSaveToggled'
  | 'workProject.jobApplicantRejected'
  | 'workProject.sharesChanged'
  | 'workProject.shares.created'
  | 'workProject.shares.increased'
  | 'workProject.shares.anomaly'
  // craft-skills
  | 'craftSkill.userSkillDeleted'
  // content
  | 'content.itemReported'
  | 'content.violationRecorded'
  | 'content.libraryItemSubmitted'
  | 'content.libraryItemPublished'
  | 'content.appealSubmitted'
  | 'content.violationAccepted'
  // content (workProject content)
  | 'content.taleDetailsUpdated'
  | 'content.taleCategoriesUpdated'
  | 'content.chapterCreated'
  | 'content.chapterDetailsUpdated'
  | 'content.tuneDetailsUpdated'
  | 'content.tuneCategoriesUpdated'
  | 'content.songCreated'
  | 'content.songDetailsUpdated'
  | 'content.televisionDetailsUpdated'
  | 'content.televisionCategoriesUpdated'
  | 'content.showCreated'
  | 'content.showDetailsUpdated'
  // money
  | 'payment.sessionCreated'
  | 'payment.donationCompleted'
  | 'payment.donationAbandoned'
  | 'payment.donationFailed'
  // admin task lifecycle
  | 'admin.taskCheckedOut'
  | 'admin.taskCheckedIn'
  | 'admin.taskReleased'
  | 'admin.taskAutoReleased'
  | 'admin.taskDeferredLater'
  // audition
  | 'workProject.opportunityCreated'
  | 'admin.opportunityCreated'
  | 'audition.replyCreated'
  | 'audition.closedByUser'
  // system
  | 'system.manualIntervention'
  | 'system.appConfigUpdated'
  | 'system.donationsArchived'
  | 'system.pendingMediaArchived'
  | 'system.profanityListSynced'
  | 'system.profanityListSyncSkipped'
  | 'system.orphanUploadsCleanedUp'
  | 'admin.profanityListUpdated'
  // social
  | 'social.streetzPostLiked'
  | 'social.streetzPostUnliked'
  | 'social.userFollowed'
  | 'social.userUnfollowed'
  // chat
  | 'chat.channelCreated'
  | 'chat.channelUpdated'
  | 'chat.channelArchived'
  | 'chat.messageSent'
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
