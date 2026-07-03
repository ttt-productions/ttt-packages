// Document path builders — returns tuples of path segments.
//
// Frontend (Web SDK):  doc(db, ...PATH_BUILDERS.userProfile(userId))
// Backend (Admin SDK): db.doc(toPath(PATH_BUILDERS.userProfile(userId)))

import {
  COLLECTIONS,
  USER_SUBCOLLECTIONS,
  WORK_PROJECT_SUBCOLLECTIONS,
  NESTED_SUBCOLLECTIONS,
  SPECIAL_DOCS,
} from './collections.js';
import type { FollowableTargetType } from '../schemas/social.js';

export const PATH_BUILDERS = {
  // ===== USER PATHS =====
  userProfile: (userId: string): [string, string] =>
    [COLLECTIONS.USER_PROFILES, userId],

  userCraftSkill: (userId: string, craftSkillId: string): [string, string, string, string] =>
    [COLLECTIONS.USER_PROFILES, userId, USER_SUBCOLLECTIONS.PROFILE_CRAFT_SKILLS, craftSkillId],

  userPrivateData: (userId: string): [string, string, string, string] =>
    [COLLECTIONS.USER_PROFILES, userId, USER_SUBCOLLECTIONS.PRIVATE_DATA, userId],

  userMetadata: (userId: string): [string, string, string, string] =>
    [COLLECTIONS.USER_PROFILES, userId, USER_SUBCOLLECTIONS.USER_METADATA, SPECIAL_DOCS.NOTIFICATION_SETTINGS],

  // Generic follow edge: top-level `followEdges/{followerUid__targetType__targetId}`.
  // Deterministic ID = O(1) follow-status check + dedupe; a composite index on
  // (targetType, targetId) makes the same collection the reverse follower index.
  followEdge: (followerUid: string, targetType: FollowableTargetType, targetId: string): [string, string] =>
    [COLLECTIONS.FOLLOW_EDGES, `${followerUid}__${targetType}__${targetId}`],

  // Denormalized follower-count doc for a followable target: `followCounters/{targetType__targetId}`.
  // Backend-maintained (incremented in the follow/unfollow transaction); never written by clients.
  followCounter: (targetType: FollowableTargetType, targetId: string): [string, string] =>
    [COLLECTIONS.FOLLOW_COUNTERS, `${targetType}__${targetId}`],

  userLike: (userId: string, postId: string): [string, string, string, string, string, string] =>
    [COLLECTIONS.USER_PROFILES, userId, USER_SUBCOLLECTIONS.USER_LIKES, NESTED_SUBCOLLECTIONS.LIKE_HISTORY, NESTED_SUBCOLLECTIONS.SQUARE_STREETZ_LIKES, postId],

  userAuditionVote: (userId: string, auditionId: string): [string, string, string, string] =>
    [COLLECTIONS.USER_PROFILES, userId, USER_SUBCOLLECTIONS.AUDITION_VOTES, auditionId],

  // ===== WORK PATHS =====
  workProject: (workProjectId: string): [string, string] =>
    [COLLECTIONS.ALL_WORK_PROJECTS, workProjectId],

  publicWorkProject: (workProjectId: string): [string, string] =>
    [COLLECTIONS.PUBLIC_WORK_PROJECTS, workProjectId],

  workProjectTale: (workProjectId: string, taleId: string): [string, string, string, string] =>
    [COLLECTIONS.ALL_WORK_PROJECTS, workProjectId, WORK_PROJECT_SUBCOLLECTIONS.WORK_PROJECT_TALES, taleId],

  taleChapter: (workProjectId: string, taleId: string, chapterId: string): [string, string, string, string, string, string] =>
    [COLLECTIONS.ALL_WORK_PROJECTS, workProjectId, WORK_PROJECT_SUBCOLLECTIONS.WORK_PROJECT_TALES, taleId, NESTED_SUBCOLLECTIONS.TALE_CHAPTERS, chapterId],

  workProjectTune: (workProjectId: string, tuneId: string): [string, string, string, string] =>
    [COLLECTIONS.ALL_WORK_PROJECTS, workProjectId, WORK_PROJECT_SUBCOLLECTIONS.WORK_PROJECT_TUNES, tuneId],

  tuneTrack: (workProjectId: string, tuneId: string, trackId: string): [string, string, string, string, string, string] =>
    [COLLECTIONS.ALL_WORK_PROJECTS, workProjectId, WORK_PROJECT_SUBCOLLECTIONS.WORK_PROJECT_TUNES, tuneId, NESTED_SUBCOLLECTIONS.TUNE_TRACKS, trackId],

  workProjectTelevision: (workProjectId: string, televisionId: string): [string, string, string, string] =>
    [COLLECTIONS.ALL_WORK_PROJECTS, workProjectId, WORK_PROJECT_SUBCOLLECTIONS.WORK_PROJECT_TELEVISION, televisionId],

  televisionEpisode: (workProjectId: string, televisionId: string, episodeId: string): [string, string, string, string, string, string] =>
    [COLLECTIONS.ALL_WORK_PROJECTS, workProjectId, WORK_PROJECT_SUBCOLLECTIONS.WORK_PROJECT_TELEVISION, televisionId, NESTED_SUBCOLLECTIONS.TELEVISION_EPISODES, episodeId],

  workProjectGuildmateUser: (workProjectId: string, uid: string): [string, string, string, string] =>
    [COLLECTIONS.ALL_WORK_PROJECTS, workProjectId, WORK_PROJECT_SUBCOLLECTIONS.GUILDMATE_USERS, uid],

  workProjectPublicGuildmateUser: (workProjectId: string, uid: string): [string, string, string, string] =>
    [COLLECTIONS.ALL_WORK_PROJECTS, workProjectId, WORK_PROJECT_SUBCOLLECTIONS.PUBLIC_GUILDMATE_USERS, uid],

  workFileFolder: (workProjectId: string, workFileFolderId: string): [string, string, string, string] =>
    [COLLECTIONS.ALL_WORK_PROJECTS, workProjectId, WORK_PROJECT_SUBCOLLECTIONS.WORK_FILE_FOLDERS, workFileFolderId],

  workFile: (workProjectId: string, workFileFolderId: string, workFileId: string): [string, string, string, string, string, string] =>
    [COLLECTIONS.ALL_WORK_PROJECTS, workProjectId, WORK_PROJECT_SUBCOLLECTIONS.WORK_FILE_FOLDERS, workFileFolderId, NESTED_SUBCOLLECTIONS.WORK_FILES, workFileId],

  stakeShareAuditEvent: (eventId: string): [string, string] =>
    [COLLECTIONS.STAKE_SHARE_AUDIT_EVENTS, eventId],

  guildChatChannel: (workProjectId: string, guildChatChannelId: string): [string, string, string, string] =>
    [COLLECTIONS.ALL_WORK_PROJECTS, workProjectId, WORK_PROJECT_SUBCOLLECTIONS.GUILD_CHAT_CHANNELS, guildChatChannelId],

  // ===== SQUARE PATHS =====
  activePost: (postId: string): [string, string, string, string] =>
    [COLLECTIONS.SQUARE_STREETZ_FEED, NESTED_SUBCOLLECTIONS.ACTIVE_POSTS, NESTED_SUBCOLLECTIONS.SOCIAL_POSTS, postId],

  trendingPosts: (): [string, string] =>
    [COLLECTIONS.SQUARE_STREETZ_FEED, NESTED_SUBCOLLECTIONS.TRENDING_POSTS],

  // ===== HALL PATHS =====
  thresholdItem: (thresholdItemId: string): [string, string] =>
    [COLLECTIONS.THRESHOLD_ITEMS, thresholdItemId],

  hallItem: (hallItemId: string): [string, string] =>
    [COLLECTIONS.HALL_ITEMS, hallItemId],

  hallItemType: (hallItemId: string, workProjectType: string, itemId: string): [string, string, string, string] =>
    [COLLECTIONS.HALL_ITEMS, hallItemId, workProjectType, itemId],

  // ===== COMMISSION PATHS =====
  commissionListing: (commissionListingId: string): [string, string] =>
    [COLLECTIONS.COMMISSION_LISTINGS, commissionListingId],

  commissionProposal: (commissionListingId: string, commissionProposalId: string): [string, string, string, string] =>
    [COLLECTIONS.COMMISSION_LISTINGS, commissionListingId, NESTED_SUBCOLLECTIONS.COMMISSION_PROPOSALS, commissionProposalId],

  // ===== AUDITION PATHS =====
  audition: (auditionId: string): [string, string] =>
    [COLLECTIONS.AUDITION_BOARD, auditionId],

  auditionEntry: (auditionId: string, auditionEntryId: string): [string, string, string, string] =>
    [COLLECTIONS.AUDITION_BOARD, auditionId, NESTED_SUBCOLLECTIONS.AUDITION_ENTRIES, auditionEntryId],

  // ===== REALM PATHS =====
  workRealm: (workRealmId: string): [string, string] =>
    [COLLECTIONS.WORK_REALMS, workRealmId],

  // ===== ADMIN & SYSTEM PATHS =====
  adminDispatch: (adminDispatchId: string): [string, string] =>
    [COLLECTIONS.PENDING_ADMIN_DISPATCHES, adminDispatchId],

  adminConversationMessage: (adminDispatchId: string, adminDispatchMessageId: string): [string, string, string, string] =>
    [COLLECTIONS.PENDING_ADMIN_DISPATCHES, adminDispatchId, NESTED_SUBCOLLECTIONS.CONVERSATION_MESSAGES, adminDispatchMessageId],

  guildInvite: (guildInviteId: string): [string, string] =>
    [COLLECTIONS.GUILD_INVITE_CONVERSATIONS, guildInviteId],

  contentReport: (reportId: string): [string, string] =>
    [COLLECTIONS.CONTENT_REPORTS, reportId],

  // Fixed-id restricted report-PII subdocs (contentReports/{reportId}/private/{snapshot,narrative}).
  reportPrivateSnapshot: (reportId: string): [string, string, string, string] =>
    [COLLECTIONS.CONTENT_REPORTS, reportId, NESTED_SUBCOLLECTIONS.PRIVATE, SPECIAL_DOCS.REPORT_SNAPSHOT],

  reportPrivateNarrative: (reportId: string): [string, string, string, string] =>
    [COLLECTIONS.CONTENT_REPORTS, reportId, NESTED_SUBCOLLECTIONS.PRIVATE, SPECIAL_DOCS.REPORT_NARRATIVE],

  activeReportGroup: (groupKey: string): [string, string] =>
    [COLLECTIONS.ACTIVE_REPORT_GROUPS, groupKey],

  // Time-sensitive admin-tray "case needs work" pin (activeSafetyCaseAlerts/{caseId}).
  safetyCaseAlert: (caseId: string): [string, string] =>
    [COLLECTIONS.ACTIVE_SAFETY_CASE_ALERTS, caseId],

  contentViolation: (violationId: string): [string, string] =>
    [COLLECTIONS.CONTENT_VIOLATIONS, violationId],

  adminTask: (taskId: string): [string, string] =>
    [COLLECTIONS.ADMIN_TASKS, taskId],

  adminTaskForItem: (taskType: string, itemId: string): [string, string] =>
    [COLLECTIONS.ADMIN_TASKS, `${taskType}-${itemId}`],

  moderationCascadeManifest: (cascadeId: string): [string, string] =>
    [COLLECTIONS.MODERATION_CASCADE_MANIFESTS, cascadeId],

  moderationCascadeChangedDoc: (cascadeId: string, changedDocId: string): [string, string, string, string] =>
    [COLLECTIONS.MODERATION_CASCADE_MANIFESTS, cascadeId, NESTED_SUBCOLLECTIONS.CHANGED_DOCS, changedDocId],

  // ===== UTILITY PATHS =====
  reservedDisplayName: (displayNameUppercase: string): [string, string] =>
    [COLLECTIONS.RESERVED_DISPLAY_NAMES, displayNameUppercase],

  reservedRealmName: (workingTitleUppercase: string): [string, string] =>
    [COLLECTIONS.RESERVED_REALM_NAMES, workingTitleUppercase],

  shortLink: (shortId: string): [string, string] =>
    [COLLECTIONS.SHORT_LINKS, shortId],

  pendingMedia: (docId: string): [string, string] =>
    [COLLECTIONS.PENDING_MEDIA, docId],

  pendingMediaArchive: (docId: string): [string, string] =>
    [COLLECTIONS.PENDING_MEDIA_ARCHIVE, docId],

  mediaAsset: (mediaAssetId: string): [string, string] =>
    [COLLECTIONS.MEDIA_ASSETS, mediaAssetId],

  // Server-only durable activation job (prepare → activate → publish + recovery).
  mediaActivationJob: (jobId: string): [string, string] =>
    [COLLECTIONS.MEDIA_ACTIVATION_JOBS, jobId],

  // ===== NOTIFICATION REDESIGN (ledger + fanout engine) PATHS =====
  notificationDelivery: (deliveryId: string): [string, string] =>
    [COLLECTIONS.NOTIFICATION_DELIVERIES, deliveryId],

  notificationFanoutJob: (jobId: string): [string, string] =>
    [COLLECTIONS.NOTIFICATION_FANOUT_JOBS, jobId],

  // ===== CHAT REALTIME SYNC / PROJECTION / COMMAND PATHS =====
  chatChannelAuthProjection: (authPairKey: string): [string, string] =>
    [COLLECTIONS.CHAT_CHANNEL_AUTH_PROJECTIONS, authPairKey],

  chatScopeDegraded: (scopeKey: string): [string, string] =>
    [COLLECTIONS.CHAT_SCOPE_DEGRADED, scopeKey],

  chatScopeDegradedCause: (scopeKey: string, causeId: string): [string, string, string, string] =>
    [COLLECTIONS.CHAT_SCOPE_DEGRADED, scopeKey, NESTED_SUBCOLLECTIONS.CHAT_SCOPE_DEGRADED_CAUSES, causeId],

  chatSyncEvent: (eventId: string): [string, string] =>
    [COLLECTIONS.CHAT_SYNC_EVENTS, eventId],

  chatSyncFanoutJob: (jobId: string): [string, string] =>
    [COLLECTIONS.CHAT_SYNC_FANOUT_JOBS, jobId],

  chatMessageOutboxCommand: (commandId: string): [string, string] =>
    [COLLECTIONS.CHAT_MESSAGE_OUTBOX, commandId],

  chatAdminActionCommand: (requestId: string): [string, string] =>
    [COLLECTIONS.CHAT_ADMIN_ACTION_COMMANDS, requestId],

  chatHistoryAnonymizationJob: (jobId: string): [string, string] =>
    [COLLECTIONS.CHAT_HISTORY_ANONYMIZATION_JOBS, jobId],

  chatHistoryAnonymizationAffectedChunk: (jobId: string, chunkOrdinal: string): [string, string, string, string] =>
    [COLLECTIONS.CHAT_HISTORY_ANONYMIZATION_JOBS, jobId, NESTED_SUBCOLLECTIONS.CHAT_ANONYMIZATION_AFFECTED_CHUNKS, chunkOrdinal],

  // ===== PAYMENT & PLEDGE PATHS =====
  // Public-safe canonical money record. Stripe IDs live on pledgePaymentProviderRef (server-only).
  pledgePayment: (pledgePaymentId: string): [string, string] =>
    [COLLECTIONS.PLEDGE_PAYMENTS, pledgePaymentId],

  // Server-only Stripe references (session/PI/charge/dispute IDs). One doc per pledge — singular.
  pledgePaymentProviderRef: (pledgePaymentId: string): [string, string] =>
    [COLLECTIONS.PLEDGE_PAYMENT_PROVIDER_REFS, pledgePaymentId],

  // Running-totals singleton — incremented in the Stripe webhook's pledge-record transaction;
  // read (ONE doc) by the public raised-total surfaces instead of a collection-wide aggregation.
  pledgePaymentTotals: (): [string, string] =>
    [COLLECTIONS.PLEDGE_PAYMENT_TOTALS, SPECIAL_DOCS.SUMMARY],

  // Idempotency sentinel, keyed by the Stripe event.id.
  processedStripeEvent: (stripeEventId: string): [string, string] =>
    [COLLECTIONS.PROCESSED_STRIPE_EVENTS, stripeEventId],

  // Independent integrity record from the ledger verification trigger.
  pledgePaymentLedgerEvent: (ledgerId: string): [string, string] =>
    [COLLECTIONS.PLEDGE_PAYMENT_LEDGER_EVENTS, ledgerId],

  // Unrecoverable paid-event repair queue, keyed by the Stripe event.id.
  paymentWebhookQuarantine: (stripeEventId: string): [string, string] =>
    [COLLECTIONS.PAYMENT_WEBHOOK_QUARANTINE, stripeEventId],

  // User-initiated pledge refund request (post-launch), keyed by requestId. No Stripe ids on this
  // doc — those live on pledgePaymentProviderRefs.
  pledgeRefundRequest: (requestId: string): [string, string] =>
    [COLLECTIONS.PLEDGE_REFUND_REQUESTS, requestId],

  // ===== FEEDBACK & CRAFT PATHS =====
  feedbackSubmission: (feedbackType: string): [string, string] =>
    [COLLECTIONS.FEEDBACK_SUBMISSIONS, feedbackType],

  userSuggestion: (feedbackType: string, suggestionId: string): [string, string, string, string] =>
    [COLLECTIONS.FEEDBACK_SUBMISSIONS, feedbackType, NESTED_SUBCOLLECTIONS.USER_SUGGESTIONS, suggestionId],

  feedbackAlias: (aliasId: string): [string, string] =>
    [COLLECTIONS.FEEDBACK_ALIASES, aliasId],

  feedbackDenylist: (deniedWord: string): [string, string] =>
    [COLLECTIONS.FEEDBACK_DENYLIST, deniedWord],

  taggedCraftSkill: (tag: string, compositeId: string): [string, string, string, string] =>
    [COLLECTIONS.CRAFT_SKILLS_BY_TAG, tag, NESTED_SUBCOLLECTIONS.TAGGED_CRAFT_SKILLS, compositeId],

  // ===== SYSTEM DATA PATHS =====
  adminList: (): [string, string] =>
    [COLLECTIONS.SYSTEM_DATA, SPECIAL_DOCS.ADMIN_LIST],

  futurePlans: (): [string, string] =>
    [COLLECTIONS.APP_CONFIG, SPECIAL_DOCS.FUTURE_PLANS],

  profanityList: (): [string, string] =>
    [COLLECTIONS.SYSTEM_DATA, SPECIAL_DOCS.PROFANITY_LIST],

  reservedUsernames: (): [string, string] =>
    [COLLECTIONS.SYSTEM_DATA, SPECIAL_DOCS.RESERVED_USERNAMES],

  blockedFranchiseNames: (): [string, string] =>
    [COLLECTIONS.SYSTEM_DATA, SPECIAL_DOCS.BLOCKED_FRANCHISE_NAMES],

  rulesAndAgreements: (): [string, string] =>
    [COLLECTIONS.APP_CONFIG, SPECIAL_DOCS.RULES_AND_AGREEMENTS],

  appConfig: (): [string, string] =>
    [COLLECTIONS.APP_CONFIG, SPECIAL_DOCS.APP_CONFIG],

  appModeMarker: (): [string, string] =>
    [COLLECTIONS.SYSTEM_DATA, SPECIAL_DOCS.APP_MODE],

  // Backend-only post-commit auth-effect reconcile queue entry, keyed by the affected uid.
  statusReconcileQueueEntry: (uid: string): [string, string] =>
    [COLLECTIONS.STATUS_RECONCILE_QUEUE, uid],

  // ===== TRUST & SAFETY — child-safety case spine (§A1b, §A2) =====
  childSafetyCaseListEntry: (caseId: string): [string, string] =>
    [COLLECTIONS.CHILD_SAFETY_CASE_LIST, caseId],

  childSafetyCase: (caseId: string): [string, string] =>
    [COLLECTIONS.CHILD_SAFETY_CASES, caseId],

  childSafetySourceSignal: (caseId: string, signalId: string): [string, string, string, string] =>
    [COLLECTIONS.CHILD_SAFETY_CASES, caseId, NESTED_SUBCOLLECTIONS.CHILD_SAFETY_SOURCE_SIGNALS, signalId],

  childSafetyDecision: (caseId: string, decisionId: string): [string, string, string, string] =>
    [COLLECTIONS.CHILD_SAFETY_CASES, caseId, NESTED_SUBCOLLECTIONS.CHILD_SAFETY_DECISIONS, decisionId],

  childSafetyDecisionView: (caseId: string, decisionId: string, viewId: string): [string, string, string, string, string, string] =>
    [COLLECTIONS.CHILD_SAFETY_CASES, caseId, NESTED_SUBCOLLECTIONS.CHILD_SAFETY_DECISIONS, decisionId, NESTED_SUBCOLLECTIONS.CHILD_SAFETY_DECISION_VIEWS, viewId],

  childSafetyCaseAccount: (caseId: string, uid: string): [string, string, string, string] =>
    [COLLECTIONS.CHILD_SAFETY_CASES, caseId, NESTED_SUBCOLLECTIONS.CHILD_SAFETY_CASE_ACCOUNTS, uid],

  childSafetyCaseAccountHistory: (caseId: string, uid: string, historyId: string): [string, string, string, string, string, string] =>
    [COLLECTIONS.CHILD_SAFETY_CASES, caseId, NESTED_SUBCOLLECTIONS.CHILD_SAFETY_CASE_ACCOUNTS, uid, NESTED_SUBCOLLECTIONS.CHILD_SAFETY_CASE_ACCOUNT_HISTORY, historyId],

  childSafetyNcmecSubmission: (caseId: string, submissionId: string): [string, string, string, string] =>
    [COLLECTIONS.CHILD_SAFETY_CASES, caseId, NESTED_SUBCOLLECTIONS.CHILD_SAFETY_NCMEC_SUBMISSIONS, submissionId],

  childSafetyNcmecSubmissionFile: (caseId: string, submissionId: string, fileId: string): [string, string, string, string, string, string] =>
    [COLLECTIONS.CHILD_SAFETY_CASES, caseId, NESTED_SUBCOLLECTIONS.CHILD_SAFETY_NCMEC_SUBMISSIONS, submissionId, NESTED_SUBCOLLECTIONS.CHILD_SAFETY_NCMEC_SUBMISSION_FILES, fileId],

  childSafetyLegalProcessEvent: (caseId: string, eventId: string): [string, string, string, string] =>
    [COLLECTIONS.CHILD_SAFETY_CASES, caseId, NESTED_SUBCOLLECTIONS.CHILD_SAFETY_LEGAL_PROCESS, eventId],

  childSafetyOwningAlias: (aliasId: string): [string, string] =>
    [COLLECTIONS.CHILD_SAFETY_OWNING_ALIASES, aliasId],

  // The doc IS the correlation→case row (childSafetyCorrelations/{correlationKey}/cases/{caseId}).
  childSafetyCorrelationCase: (correlationKey: string, caseId: string): [string, string, string, string] =>
    [COLLECTIONS.CHILD_SAFETY_CORRELATIONS, correlationKey, NESTED_SUBCOLLECTIONS.CHILD_SAFETY_CORRELATION_CASES, caseId],

  safetyCaseMergeJob: (mergeJobId: string): [string, string] =>
    [COLLECTIONS.SAFETY_CASE_MERGE_JOBS, mergeJobId],

  // ===== TRUST & SAFETY — holds + resource commands (§A3) =====
  // Composite doc id caseId__resourceKeyHash — a single {holdRefId} segment.
  safetyHoldRef: (holdRefId: string): [string, string] =>
    [COLLECTIONS.SAFETY_HOLD_REFS, holdRefId],

  safetyHoldResource: (resourceKeyHash: string): [string, string] =>
    [COLLECTIONS.SAFETY_HOLD_RESOURCES, resourceKeyHash],

  // Composite doc id resourceKeyHash__commandId — a single {commandDocId} segment.
  safetyResourceCommand: (commandDocId: string): [string, string] =>
    [COLLECTIONS.SAFETY_RESOURCE_COMMANDS, commandDocId],

  safetyResourceCommandAuthorizedRequest: (commandDocId: string, requestId: string): [string, string, string, string] =>
    [COLLECTIONS.SAFETY_RESOURCE_COMMANDS, commandDocId, NESTED_SUBCOLLECTIONS.SAFETY_RESOURCE_COMMAND_AUTHORIZED_REQUESTS, requestId],

  safetyResourceCommandBypassRef: (commandDocId: string, refId: string): [string, string, string, string] =>
    [COLLECTIONS.SAFETY_RESOURCE_COMMANDS, commandDocId, NESTED_SUBCOLLECTIONS.SAFETY_RESOURCE_COMMAND_BYPASS_REFS, refId],

  // ===== TRUST & SAFETY — evidence + provenance (§A4, §A6) =====
  safetyEvidenceManifest: (manifestId: string): [string, string] =>
    [COLLECTIONS.SAFETY_EVIDENCE_MANIFESTS, manifestId],

  safetyEvidenceJob: (jobId: string): [string, string] =>
    [COLLECTIONS.SAFETY_EVIDENCE_JOBS, jobId],

  safetyEvidenceJobItem: (jobId: string, itemId: string): [string, string, string, string] =>
    [COLLECTIONS.SAFETY_EVIDENCE_JOBS, jobId, NESTED_SUBCOLLECTIONS.SAFETY_EVIDENCE_JOB_ITEMS, itemId],

  safetyEvidenceJobDisposition: (jobId: string, locationId: string): [string, string, string, string] =>
    [COLLECTIONS.SAFETY_EVIDENCE_JOBS, jobId, NESTED_SUBCOLLECTIONS.SAFETY_EVIDENCE_JOB_DISPOSITION, locationId],

  eventProvenance: (eventId: string): [string, string] =>
    [COLLECTIONS.EVENT_PROVENANCE, eventId],

  // ===== TRUST & SAFETY — sagas + closure (§A5) =====
  quarantineSagaJob: (caseId: string): [string, string] =>
    [COLLECTIONS.QUARANTINE_SAGA_JOBS, caseId],

  quarantineSagaRelatedAsset: (caseId: string, assetId: string): [string, string, string, string] =>
    [COLLECTIONS.QUARANTINE_SAGA_JOBS, caseId, NESTED_SUBCOLLECTIONS.QUARANTINE_SAGA_RELATED_ASSETS, assetId],

  // Composite doc id caseId__submissionId — a single {ncmecJobId} segment.
  ncmecSubmissionJob: (ncmecJobId: string): [string, string] =>
    [COLLECTIONS.NCMEC_SUBMISSION_JOBS, ncmecJobId],

  // Composite doc id caseId__uid — a single {accountActionCommandId} segment.
  accountActionCommand: (accountActionCommandId: string): [string, string] =>
    [COLLECTIONS.ACCOUNT_ACTION_COMMANDS, accountActionCommandId],

  // ===== TRUST & SAFETY — SLA monitors + heartbeat (§A8) =====
  // Composite doc id {caseId|requestId}__{monitorKind} — a single {monitorId} segment.
  safetySlaMonitor: (monitorId: string): [string, string] =>
    [COLLECTIONS.SAFETY_SLA_MONITORS, monitorId],

  // Singleton: safetyMonitorHeartbeat/global.
  safetyMonitorHeartbeat: (): [string, string] =>
    [COLLECTIONS.SAFETY_MONITOR_HEARTBEAT, SPECIAL_DOCS.SAFETY_MONITOR_HEARTBEAT_GLOBAL],

  // ===== TRUST & SAFETY — age attestation nonces (§A7) =====
  ageAttestationNonce: (nonceHash: string): [string, string] =>
    [COLLECTIONS.AGE_ATTESTATION_NONCES, nonceHash],

  // ===== TRUST & SAFETY — NCII / TAKE IT DOWN (§A11) =====
  nciiAllegation: (allegationId: string): [string, string] =>
    [COLLECTIONS.NCII_ALLEGATIONS, allegationId],

  takeItDownRequest: (requestId: string): [string, string] =>
    [COLLECTIONS.TAKE_IT_DOWN_REQUESTS, requestId],

  // Fixed-id requester PII subdoc (takeItDownRequests/{requestId}/private/requester).
  takeItDownRequesterPrivate: (requestId: string): [string, string, string, string] =>
    [COLLECTIONS.TAKE_IT_DOWN_REQUESTS, requestId, NESTED_SUBCOLLECTIONS.PRIVATE, SPECIAL_DOCS.TAKE_IT_DOWN_REQUESTER],

  takeItDownSubmission: (requestId: string, submissionId: string): [string, string, string, string] =>
    [COLLECTIONS.TAKE_IT_DOWN_REQUESTS, requestId, NESTED_SUBCOLLECTIONS.TAKE_IT_DOWN_SUBMISSIONS, submissionId],

  takeItDownValidityDecision: (requestId: string, decisionId: string): [string, string, string, string] =>
    [COLLECTIONS.TAKE_IT_DOWN_REQUESTS, requestId, NESTED_SUBCOLLECTIONS.TAKE_IT_DOWN_VALIDITY_DECISIONS, decisionId],

  takeItDownRequestAction: (requestId: string, actionId: string): [string, string, string, string] =>
    [COLLECTIONS.TAKE_IT_DOWN_REQUESTS, requestId, NESTED_SUBCOLLECTIONS.TAKE_IT_DOWN_ACTIONS, actionId],

  // Fixed-id public status projection (takeItDownRequests/{requestId}/statusProjection/current).
  takeItDownPublicStatus: (requestId: string): [string, string, string, string] =>
    [COLLECTIONS.TAKE_IT_DOWN_REQUESTS, requestId, NESTED_SUBCOLLECTIONS.TAKE_IT_DOWN_STATUS_PROJECTION, SPECIAL_DOCS.TAKE_IT_DOWN_STATUS_CURRENT],

  takeItDownEvidence: (requestId: string, evidenceId: string): [string, string, string, string] =>
    [COLLECTIONS.TAKE_IT_DOWN_REQUESTS, requestId, NESTED_SUBCOLLECTIONS.TAKE_IT_DOWN_EVIDENCE, evidenceId],

  // [H-01] a retained-but-unrecorded NCII-evidence inventory row (top-level; id is deterministic on
  // bucket+key+generation so a re-fire is idempotent).
  nciiRetainedEvidenceInventory: (inventoryId: string): [string, string] =>
    [COLLECTIONS.NCII_RETAINED_EVIDENCE_INVENTORY, inventoryId],

  // [H-01] dead-letter entry for an inventory row that could not be written to the primary
  // nciiRetainedEvidenceInventory collection (id mirrors the primary row id for traceability).
  nciiInventoryDeadLetter: (inventoryId: string): [string, string] =>
    [COLLECTIONS.NCII_INVENTORY_DEAD_LETTER, inventoryId],

  nciiCase: (caseId: string): [string, string] =>
    [COLLECTIONS.NCII_CASES, caseId],

  nciiCaseAllegationLink: (caseId: string, allegationId: string): [string, string, string, string] =>
    [COLLECTIONS.NCII_CASES, caseId, NESTED_SUBCOLLECTIONS.NCII_CASE_ALLEGATION_LINKS, allegationId],

  nciiCaseRequestLink: (caseId: string, requestId: string): [string, string, string, string] =>
    [COLLECTIONS.NCII_CASES, caseId, NESTED_SUBCOLLECTIONS.NCII_CASE_REQUEST_LINKS, requestId],

  nciiCaseRemovalAction: (caseId: string, actionId: string): [string, string, string, string] =>
    [COLLECTIONS.NCII_CASES, caseId, NESTED_SUBCOLLECTIONS.NCII_CASE_REMOVAL_ACTIONS, actionId],

  nciiBlockedHash: (caseId: string, hashId: string): [string, string, string, string] =>
    [COLLECTIONS.NCII_CASES, caseId, NESTED_SUBCOLLECTIONS.NCII_CASE_BLOCKED_HASHES, hashId],

  nciiTemporaryHold: (holdId: string): [string, string] =>
    [COLLECTIONS.NCII_TEMPORARY_HOLDS, holdId],

  nciiRemovalJob: (jobId: string): [string, string] =>
    [COLLECTIONS.NCII_REMOVAL_JOBS, jobId],

  nciiRemovalTarget: (jobId: string, targetKeyHash: string): [string, string, string, string] =>
    [COLLECTIONS.NCII_REMOVAL_JOBS, jobId, NESTED_SUBCOLLECTIONS.NCII_REMOVAL_TARGETS, targetKeyHash],

  // ===== TRUST & SAFETY — _serverData (server-only) singletons (§A7, §A11) =====
  // Moved from _config (public) to _serverData (Rule 32 — Cloud-Functions-only readers).
  agePolicyConfig: (): [string, string] =>
    [COLLECTIONS.SERVER_DATA, SPECIAL_DOCS.AGE_POLICY],

  nciiPolicyConfig: (): [string, string] =>
    [COLLECTIONS.SERVER_DATA, SPECIAL_DOCS.NCII_POLICY],

  privilegedReviewerSecurityConfig: (): [string, string] =>
    [COLLECTIONS.SERVER_DATA, SPECIAL_DOCS.PRIVILEGED_REVIEWER_SECURITY],
} as const;
