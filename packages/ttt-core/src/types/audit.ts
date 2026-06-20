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
  | 'user.accountSuspended'
  | 'user.accountBanned'
  | 'user.accountUnbanned'
  | 'user.displayNameResetForced'
  | 'user.displayNameChanged'
  | 'user.nonUsArtisanInterestRecorded'
  // account deletion / GDPR erasure (N3)
  | 'account.deletionRequested'
  | 'account.deletionCancelled'
  | 'account.erasureCompleted'
  | 'account.erasureParkedOnHold'
  | 'account.erasureSuperseded'
  // admin actions
  | 'admin.systemRoleGranted'
  | 'admin.systemRoleRevoked'
  | 'admin.systemRoleSyncedFromDirectEdit'
  | 'admin.contentAppealReviewed'
  | 'admin.violationDecisionAccepted'
  | 'admin.thresholdItemReviewed'
  | 'admin.futurePlansUpdated'
  | 'admin.rulesAndAgreementsUpdated'
  // admin launch-seed actions (Ready for Launch tab)
  | 'admin.reservedUsernamesSeeded'
  | 'admin.blockedFranchiseNamesSeeded'
  | 'admin.rulesAndAgreementsSeeded'
  | 'admin.futurePlansSeeded'
  // trademark-assist (advisory check at approval) + parody/real-people disclaimer baked at approval
  | 'admin.trademarkChecked'
  | 'content.parodyDisclaimerApplied'
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
  | 'craftSkill.hidden'
  | 'craftSkill.restored'
  | 'craftSkill.removed'
  // content
  | 'content.itemReported'
  | 'content.violationRecorded'
  | 'content.thresholdItemSubmitted'
  | 'content.hallItemPublished'
  | 'content.appealSubmitted'
  | 'content.violationAccepted'
  | 'content.hidden'
  | 'content.restored'
  | 'content.removed'
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
  | 'payment.pledgePaymentQuarantined'
  // money — independent ledger-integrity trigger (mirrors workProject.stakeShares.*)
  | 'payment.pledgeLedger.recorded'
  | 'payment.pledgeLedger.anomaly'
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
  // records (never controls) a charter↔full APP_MODE flip after deploy — written
  // by the idempotent recordAppModeFlip admin callable
  | 'admin.appModeFlipRecorded'
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
  | 'chat.adminThreadStarted'
  | 'chat.adminThreadStatusChanged'
  | 'chat.attachmentTimedOut'
  // chat moderation (DO-owned hide/delete via chatAdminActionCommands) — append-only,
  // deterministic ids hash('chat-moderation-{requested,applied,failed}', requestId, …).
  | 'chat.moderationActionRequested'
  | 'chat.moderationActionApplied'
  | 'chat.moderationActionFailed'
  // case-bound admin context read (read-on-demand, REVIEW-ONLY) — audits the request
  // AND outcome; one event per read keyed deterministically by the read's requestId.
  | 'chat.moderationContextRead'
  // notification (admin-only). Actor mode is always adminReview / adminOverride.
  // Payload shapes: NotificationBroadcastSentAuditMetadata /
  // NotificationAdminArchivedAuditMetadata in ../schemas/notification.ts.
  | 'notification.broadcastSent'
  | 'notification.adminArchived'
  // workProject
  | 'workProject.released'
  | 'workProject.hidden'
  | 'workProject.restored'
  | 'workProject.moderationPlaceholderApplied'
  | 'workProject.moderationRetitleCleared'
  | 'workRealm.created'
  | 'workRealm.released'
  | 'workRealm.detailsUpdated'
  | 'workRealm.hidden'
  | 'workRealm.restored'
  | 'workRealm.moderationPlaceholderApplied'
  | 'workRealm.moderationRetitleCleared'
  // trust & safety — child safety / CSAM
  | 'report.childSafetyCaseOpened'
  | 'report.nciiCaseOpened'
  | 'childSafety.reportDispositionSet'
  | 'childSafety.caseMerged'
  | 'childSafety.holdPlaced'
  | 'childSafety.holdReleased'
  | 'childSafety.accountActionApplied'
  | 'childSafety.accountActionReverted'
  | 'childSafety.evidenceManifestCreated'
  | 'childSafety.evidenceDisposed'
  | 'childSafety.quarantineCompleted'
  | 'childSafety.ncmecSubmissionCompleted'
  | 'childSafety.legalProcessRecorded'
  | 'childSafety.falsePositiveCorrected'
  // trust & safety — age / registration
  | 'user.ageAttested'
  | 'user.ageUpgradedToAdult'
  | 'user.ageManuallyCorrected'
  | 'user.orphanAuthDeleted'
  | 'user.accountClosedUnder13'
  | 'user.safetyLocked'
  // trust & safety — NCII / TAKE IT DOWN
  | 'ncii.requestReceived'
  | 'ncii.requestSupplemented'
  | 'ncii.completenessDetermined'
  | 'ncii.validityDecided'
  | 'ncii.tempHoldPlaced'
  | 'ncii.tempHoldReleased'
  | 'ncii.removalCompleted'
  | 'ncii.removalUnableToComplete'
  | 'ncii.evidenceScanValidatedMatch'
  | 'ncii.appealDecided'
  | 'ncii.contentReinstated'
  | 'ncii.hashBlockReversed'
  | 'ncii.uploaderNoticeSent'
  | 'ncii.uploaderNoticeSuppressed'
  | 'ncii.statusTokenRevoked'
  | 'ncii.policyConfigUpdated'
  // trust & safety — operator security
  | 'safety.privilegedReauthPerformed'
  | 'safety.recoveryCodeUsed'
  | 'safety.operatorUnavailableFailsafeTripped'
  | 'safety.deadlineBreachRecorded';

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

