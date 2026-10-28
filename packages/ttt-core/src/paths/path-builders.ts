import {
  COLLECTIONS,
  USER_SUBCOLLECTIONS,
  WORK_PROJECT_SUBCOLLECTIONS,
  WORK_REALM_SUBCOLLECTIONS,
  NESTED_SUBCOLLECTIONS,
  SPECIAL_DOCS,
  HALL_ITEM_SUBCOLLECTION_BY_WORK_TYPE,
  type HallItemSubcollection,
} from './collections.js';
import {
  accountActionCommandDocId,
  adminTaskForItemDocId,
  childSafetyCaseAccountHistoryDocId,
  childSafetyDecisionDocId,
  followCounterDocId,
  followEdgeDocId,
  ncmecSubmissionJobDocId,
  nciiCaseClosureEventDocId,
  notificationFanoutJobDocId,
  safetyHoldRefDocId,
  safetySlaMonitorDocId,
  taggedCraftSkillDocId,
  thresholdItemDocId,
  type CaseLifecycleTransition,
  type ChildSafetyDecisionIdParts,
} from './compound-ids.js';
import type { AccountActionSource } from '../doc-schemas/safety/sagas.js';
import type { SafetySlaMonitorKind } from '../doc-schemas/safety/monitors.js';
import type { NotificationType } from '../schemas/notification.js';
import type { FollowableTargetType } from '../schemas/social.js';
import type { WorkProjectType } from '../types/content.js';
import type { PublicDocumentId } from '../constants/public-documents.js';
import type { SweepStateName } from '../constants/scheduled-jobs.js';

export const publicDocumentVersionDocId = (version: number): string => {
  if (!Number.isInteger(version) || version < 1) {
    throw new Error(`public document versions are whole numbers from 1 (got ${version})`);
  }
  return `v${version}`;
};

export const PATH_BUILDERS = {
  userProfile: (userId: string): [string, string] => [COLLECTIONS.USER_PROFILES, userId],

  publicUser: (uid: string): [string, string] => [COLLECTIONS.PUBLIC_USERS, uid],

  accountDeletionRequest: (uid: string): [string, string] => [
    COLLECTIONS.ACCOUNT_DELETION_REQUESTS,
    uid,
  ],

  userMentionHistoryEntry: (userId: string, entryId: string): [string, string, string, string] => [
    COLLECTIONS.USER_PROFILES,
    userId,
    USER_SUBCOLLECTIONS.MENTION_HISTORY,
    entryId,
  ],

  userCraftSkill: (userId: string, craftSkillId: string): [string, string, string, string] => [
    COLLECTIONS.USER_PROFILES,
    userId,
    USER_SUBCOLLECTIONS.PROFILE_CRAFT_SKILLS,
    craftSkillId,
  ],

  userPrivateData: (userId: string): [string, string, string, string] => [
    COLLECTIONS.USER_PROFILES,
    userId,
    USER_SUBCOLLECTIONS.PRIVATE_DATA,
    userId,
  ],

  hallLibraryPreferences: (userId: string): [string, string, string, string] => [
    COLLECTIONS.USER_PROFILES,
    userId,
    USER_SUBCOLLECTIONS.PRIVATE_DATA,
    SPECIAL_DOCS.HALL_LIBRARY_PREFERENCES,
  ],

  followEdge: (
    followerUid: string,
    targetType: FollowableTargetType,
    targetId: string,
  ): [string, string] => [
    COLLECTIONS.FOLLOW_EDGES,
    followEdgeDocId(followerUid, targetType, targetId),
  ],

  followCounter: (targetType: FollowableTargetType, targetId: string): [string, string] => [
    COLLECTIONS.FOLLOW_COUNTERS,
    followCounterDocId(targetType, targetId),
  ],

  userLike: (userId: string, postId: string): [string, string, string, string, string, string] => [
    COLLECTIONS.USER_PROFILES,
    userId,
    USER_SUBCOLLECTIONS.USER_LIKES,
    NESTED_SUBCOLLECTIONS.LIKE_HISTORY,
    NESTED_SUBCOLLECTIONS.SQUARE_STREETZ_LIKES,
    postId,
  ],

  userAuditionVote: (userId: string, auditionId: string): [string, string, string, string] => [
    COLLECTIONS.USER_PROFILES,
    userId,
    USER_SUBCOLLECTIONS.AUDITION_VOTES,
    auditionId,
  ],

  userNotificationHistoryEntry: (
    userId: string,
    notificationId: string,
  ): [string, string, string, string] => [
    COLLECTIONS.USER_PROFILES,
    userId,
    USER_SUBCOLLECTIONS.NOTIFICATION_HISTORY,
    notificationId,
  ],

  userNotificationHistory: (userId: string): [string, string, string] => [
    COLLECTIONS.USER_PROFILES,
    userId,
    USER_SUBCOLLECTIONS.NOTIFICATION_HISTORY,
  ],

  activeUserNotification: (notificationId: string): [string, string] => [
    COLLECTIONS.ACTIVE_USER_NOTIFICATIONS,
    notificationId,
  ],

  activeAdminNotification: (notificationId: string): [string, string] => [
    COLLECTIONS.ACTIVE_ADMIN_NOTIFICATIONS,
    notificationId,
  ],

  workProject: (workProjectId: string): [string, string] => [
    COLLECTIONS.ALL_WORK_PROJECTS,
    workProjectId,
  ],

  publicWorkProject: (workProjectId: string): [string, string] => [
    COLLECTIONS.PUBLIC_WORK_PROJECTS,
    workProjectId,
  ],

  hallSubmissionReservation: (workProjectId: string): [string, string, string, string] => [
    COLLECTIONS.ALL_WORK_PROJECTS,
    workProjectId,
    WORK_PROJECT_SUBCOLLECTIONS.HALL_SUBMISSION_RESERVATION,
    SPECIAL_DOCS.HALL_SUBMISSION_RESERVATION,
  ],

  workProjectTale: (workProjectId: string, taleId: string): [string, string, string, string] => [
    COLLECTIONS.ALL_WORK_PROJECTS,
    workProjectId,
    WORK_PROJECT_SUBCOLLECTIONS.WORK_PROJECT_TALES,
    taleId,
  ],

  taleChapter: (
    workProjectId: string,
    taleId: string,
    chapterId: string,
  ): [string, string, string, string, string, string] => [
    COLLECTIONS.ALL_WORK_PROJECTS,
    workProjectId,
    WORK_PROJECT_SUBCOLLECTIONS.WORK_PROJECT_TALES,
    taleId,
    NESTED_SUBCOLLECTIONS.TALE_CHAPTERS,
    chapterId,
  ],

  taleChapters: (
    workProjectId: string,
    taleId: string,
  ): [string, string, string, string, string] => [
    COLLECTIONS.ALL_WORK_PROJECTS,
    workProjectId,
    WORK_PROJECT_SUBCOLLECTIONS.WORK_PROJECT_TALES,
    taleId,
    NESTED_SUBCOLLECTIONS.TALE_CHAPTERS,
  ],

  workProjectTune: (workProjectId: string, tuneId: string): [string, string, string, string] => [
    COLLECTIONS.ALL_WORK_PROJECTS,
    workProjectId,
    WORK_PROJECT_SUBCOLLECTIONS.WORK_PROJECT_TUNES,
    tuneId,
  ],

  tuneTrack: (
    workProjectId: string,
    tuneId: string,
    trackId: string,
  ): [string, string, string, string, string, string] => [
    COLLECTIONS.ALL_WORK_PROJECTS,
    workProjectId,
    WORK_PROJECT_SUBCOLLECTIONS.WORK_PROJECT_TUNES,
    tuneId,
    NESTED_SUBCOLLECTIONS.TUNE_TRACKS,
    trackId,
  ],

  workProjectTelevision: (
    workProjectId: string,
    televisionId: string,
  ): [string, string, string, string] => [
    COLLECTIONS.ALL_WORK_PROJECTS,
    workProjectId,
    WORK_PROJECT_SUBCOLLECTIONS.WORK_PROJECT_TELEVISION,
    televisionId,
  ],

  televisionEpisode: (
    workProjectId: string,
    televisionId: string,
    episodeId: string,
  ): [string, string, string, string, string, string] => [
    COLLECTIONS.ALL_WORK_PROJECTS,
    workProjectId,
    WORK_PROJECT_SUBCOLLECTIONS.WORK_PROJECT_TELEVISION,
    televisionId,
    NESTED_SUBCOLLECTIONS.TELEVISION_EPISODES,
    episodeId,
  ],

  televisionEpisodes: (
    workProjectId: string,
    televisionId: string,
  ): [string, string, string, string, string] => [
    COLLECTIONS.ALL_WORK_PROJECTS,
    workProjectId,
    WORK_PROJECT_SUBCOLLECTIONS.WORK_PROJECT_TELEVISION,
    televisionId,
    NESTED_SUBCOLLECTIONS.TELEVISION_EPISODES,
  ],

  workProjectGuildmateUser: (
    workProjectId: string,
    uid: string,
  ): [string, string, string, string] => [
    COLLECTIONS.ALL_WORK_PROJECTS,
    workProjectId,
    WORK_PROJECT_SUBCOLLECTIONS.GUILDMATE_USERS,
    uid,
  ],

  workProjectPublicGuildmateUser: (
    workProjectId: string,
    uid: string,
  ): [string, string, string, string] => [
    COLLECTIONS.ALL_WORK_PROJECTS,
    workProjectId,
    WORK_PROJECT_SUBCOLLECTIONS.PUBLIC_GUILDMATE_USERS,
    uid,
  ],

  workFileFolder: (
    workProjectId: string,
    workFileFolderId: string,
  ): [string, string, string, string] => [
    COLLECTIONS.ALL_WORK_PROJECTS,
    workProjectId,
    WORK_PROJECT_SUBCOLLECTIONS.WORK_FILE_FOLDERS,
    workFileFolderId,
  ],

  workFile: (
    workProjectId: string,
    workFileFolderId: string,
    workFileId: string,
  ): [string, string, string, string, string, string] => [
    COLLECTIONS.ALL_WORK_PROJECTS,
    workProjectId,
    WORK_PROJECT_SUBCOLLECTIONS.WORK_FILE_FOLDERS,
    workFileFolderId,
    NESTED_SUBCOLLECTIONS.WORK_FILES,
    workFileId,
  ],

  stakeShareAuditEvent: (eventId: string): [string, string] => [
    COLLECTIONS.STAKE_SHARE_AUDIT_EVENTS,
    eventId,
  ],

  guildChatChannel: (
    workProjectId: string,
    guildChatChannelId: string,
  ): [string, string, string, string] => [
    COLLECTIONS.ALL_WORK_PROJECTS,
    workProjectId,
    WORK_PROJECT_SUBCOLLECTIONS.GUILD_CHAT_CHANNELS,
    guildChatChannelId,
  ],

  activePost: (postId: string): [string, string, string, string] => [
    COLLECTIONS.SQUARE_STREETZ_FEED,
    NESTED_SUBCOLLECTIONS.ACTIVE_POSTS,
    NESTED_SUBCOLLECTIONS.SOCIAL_POSTS,
    postId,
  ],

  trendingPosts: (): [string, string] => [
    COLLECTIONS.SQUARE_STREETZ_FEED,
    NESTED_SUBCOLLECTIONS.TRENDING_POSTS,
  ],

  squareAnnouncementJob: (jobId: string): [string, string] => [
    COLLECTIONS.SQUARE_ANNOUNCEMENT_JOBS,
    jobId,
  ],

  thresholdItem: (workProjectId: string, itemId: string): [string, string] => [
    COLLECTIONS.THRESHOLD_ITEMS,
    thresholdItemDocId(workProjectId, itemId),
  ],

  hallItem: (hallItemId: string): [string, string] => [COLLECTIONS.HALL_ITEMS, hallItemId],

  hallItemType: (
    hallItemId: string,
    subcollection: HallItemSubcollection,
    itemId: string,
  ): [string, string, string, string] => [
    COLLECTIONS.HALL_ITEMS,
    hallItemId,
    subcollection,
    itemId,
  ],

  hallItemSubItem: (
    hallItemId: string,
    workProjectType: WorkProjectType,
    itemId: string,
  ): [string, string, string, string] => [
    COLLECTIONS.HALL_ITEMS,
    hallItemId,
    HALL_ITEM_SUBCOLLECTION_BY_WORK_TYPE[workProjectType],
    itemId,
  ],

  hallItemSubItems: (
    hallItemId: string,
    subcollection: HallItemSubcollection,
  ): [string, string, string] => [COLLECTIONS.HALL_ITEMS, hallItemId, subcollection],

  hallContentChangeRequest: (changeRequestId: string): [string, string] => [
    COLLECTIONS.HALL_CONTENT_CHANGE_REQUESTS,
    changeRequestId,
  ],

  hallContentChangeRequestLock: (targetKey: string): [string, string] => [
    COLLECTIONS.HALL_CONTENT_CHANGE_REQUEST_LOCKS,
    targetKey,
  ],

  commissionListing: (commissionListingId: string): [string, string] => [
    COLLECTIONS.COMMISSION_LISTINGS,
    commissionListingId,
  ],

  commissionProposal: (
    commissionListingId: string,
    commissionProposalId: string,
  ): [string, string, string, string] => [
    COLLECTIONS.COMMISSION_LISTINGS,
    commissionListingId,
    NESTED_SUBCOLLECTIONS.COMMISSION_PROPOSALS,
    commissionProposalId,
  ],

  audition: (auditionId: string): [string, string] => [COLLECTIONS.AUDITION_BOARD, auditionId],

  auditionEntry: (
    auditionId: string,
    auditionEntryId: string,
  ): [string, string, string, string] => [
    COLLECTIONS.AUDITION_BOARD,
    auditionId,
    NESTED_SUBCOLLECTIONS.AUDITION_ENTRIES,
    auditionEntryId,
  ],

  workRealm: (workRealmId: string): [string, string] => [COLLECTIONS.WORK_REALMS, workRealmId],

  realmFileFolder: (
    workRealmId: string,
    realmFileFolderId: string,
  ): [string, string, string, string] => [
    COLLECTIONS.WORK_REALMS,
    workRealmId,
    WORK_REALM_SUBCOLLECTIONS.REALM_FILE_FOLDERS,
    realmFileFolderId,
  ],

  adminDispatch: (adminDispatchId: string): [string, string] => [
    COLLECTIONS.PENDING_ADMIN_DISPATCHES,
    adminDispatchId,
  ],

  adminConversationMessage: (
    adminDispatchId: string,
    adminDispatchMessageId: string,
  ): [string, string, string, string] => [
    COLLECTIONS.PENDING_ADMIN_DISPATCHES,
    adminDispatchId,
    NESTED_SUBCOLLECTIONS.CONVERSATION_MESSAGES,
    adminDispatchMessageId,
  ],

  guildInvite: (guildInviteId: string): [string, string] => [
    COLLECTIONS.GUILD_INVITE_CONVERSATIONS,
    guildInviteId,
  ],

  guildInviteConversationFile: (
    guildInviteId: string,
    conversationFileId: string,
  ): [string, string, string, string] => [
    COLLECTIONS.GUILD_INVITE_CONVERSATIONS,
    guildInviteId,
    NESTED_SUBCOLLECTIONS.CONVERSATION_FILES,
    conversationFileId,
  ],

  adminDispatchConversationFile: (
    adminDispatchId: string,
    conversationFileId: string,
  ): [string, string, string, string] => [
    COLLECTIONS.PENDING_ADMIN_DISPATCHES,
    adminDispatchId,
    NESTED_SUBCOLLECTIONS.CONVERSATION_FILES,
    conversationFileId,
  ],

  adminDispatchReadMarker: (
    adminDispatchId: string,
    uid: string,
  ): [string, string, string, string] => [
    COLLECTIONS.PENDING_ADMIN_DISPATCHES,
    adminDispatchId,
    NESTED_SUBCOLLECTIONS.DISPATCH_READ_MARKERS,
    uid,
  ],

  contentReport: (reportId: string): [string, string] => [COLLECTIONS.CONTENT_REPORTS, reportId],

  reportPublicProjection: (reportId: string): [string, string, string, string] => [
    COLLECTIONS.CONTENT_REPORTS,
    reportId,
    NESTED_SUBCOLLECTIONS.REPORT_PUBLIC_PROJECTION,
    reportId,
  ],

  reportPrivateSnapshot: (reportId: string): [string, string, string, string] => [
    COLLECTIONS.CONTENT_REPORTS,
    reportId,
    NESTED_SUBCOLLECTIONS.PRIVATE,
    SPECIAL_DOCS.REPORT_SNAPSHOT,
  ],

  reportPrivateNarrative: (reportId: string): [string, string, string, string] => [
    COLLECTIONS.CONTENT_REPORTS,
    reportId,
    NESTED_SUBCOLLECTIONS.PRIVATE,
    SPECIAL_DOCS.REPORT_NARRATIVE,
  ],

  reportPrivateEscalationNarrative: (reportId: string): [string, string, string, string] => [
    COLLECTIONS.CONTENT_REPORTS,
    reportId,
    NESTED_SUBCOLLECTIONS.PRIVATE,
    SPECIAL_DOCS.REPORT_NARRATIVE_ESCALATION,
  ],

  activeReportGroup: (groupKey: string): [string, string] => [
    COLLECTIONS.ACTIVE_REPORT_GROUPS,
    groupKey,
  ],

  reportGroupCountedReport: (
    groupKey: string,
    reportId: string,
  ): [string, string, string, string] => [
    COLLECTIONS.ACTIVE_REPORT_GROUPS,
    groupKey,
    NESTED_SUBCOLLECTIONS.REPORT_GROUP_COUNTED_REPORTS,
    reportId,
  ],

  safetyCaseAlert: (caseId: string): [string, string] => [
    COLLECTIONS.ACTIVE_SAFETY_CASE_ALERTS,
    caseId,
  ],

  contentViolation: (violationId: string): [string, string] => [
    COLLECTIONS.CONTENT_VIOLATIONS,
    violationId,
  ],

  adminTask: (taskId: string): [string, string] => [COLLECTIONS.ADMIN_TASKS, taskId],

  adminTaskForItem: (taskType: string, itemId: string): [string, string] => [
    COLLECTIONS.ADMIN_TASKS,
    adminTaskForItemDocId(taskType, itemId),
  ],

  moderationCascadeManifest: (cascadeId: string): [string, string] => [
    COLLECTIONS.MODERATION_CASCADE_MANIFESTS,
    cascadeId,
  ],

  moderationCascadeChangedDoc: (
    cascadeId: string,
    changedDocId: string,
  ): [string, string, string, string] => [
    COLLECTIONS.MODERATION_CASCADE_MANIFESTS,
    cascadeId,
    NESTED_SUBCOLLECTIONS.CHANGED_DOCS,
    changedDocId,
  ],

  reservedDisplayName: (displayNameUppercase: string): [string, string] => [
    COLLECTIONS.RESERVED_DISPLAY_NAMES,
    displayNameUppercase,
  ],

  reservedRealmName: (workingTitleUppercase: string): [string, string] => [
    COLLECTIONS.RESERVED_REALM_NAMES,
    workingTitleUppercase,
  ],

  shortLink: (shortId: string): [string, string] => [COLLECTIONS.SHORT_LINKS, shortId],

  pendingMedia: (docId: string): [string, string] => [COLLECTIONS.PENDING_MEDIA, docId],

  pendingMediaArchive: (docId: string): [string, string] => [
    COLLECTIONS.PENDING_MEDIA_ARCHIVE,
    docId,
  ],

  mediaAsset: (mediaAssetId: string): [string, string] => [COLLECTIONS.MEDIA_ASSETS, mediaAssetId],

  mediaActivationJob: (jobId: string): [string, string] => [
    COLLECTIONS.MEDIA_ACTIVATION_JOBS,
    jobId,
  ],

  mediaCopyIntent: (newAssetId: string): [string, string] => [
    COLLECTIONS.MEDIA_COPY_INTENTS,
    newAssetId,
  ],

  notificationDelivery: (deliveryId: string): [string, string] => [
    COLLECTIONS.NOTIFICATION_DELIVERIES,
    deliveryId,
  ],

  notificationFanoutJob: (
    eventId: string,
    notificationType: NotificationType,
  ): [string, string] => [
    COLLECTIONS.NOTIFICATION_FANOUT_JOBS,
    notificationFanoutJobDocId(eventId, notificationType),
  ],

  chatChannelAuthProjection: (authPairKey: string): [string, string] => [
    COLLECTIONS.CHAT_CHANNEL_AUTH_PROJECTIONS,
    authPairKey,
  ],

  chatScopeDegraded: (scopeKey: string): [string, string] => [
    COLLECTIONS.CHAT_SCOPE_DEGRADED,
    scopeKey,
  ],

  chatScopeDegradedCause: (scopeKey: string, causeId: string): [string, string, string, string] => [
    COLLECTIONS.CHAT_SCOPE_DEGRADED,
    scopeKey,
    NESTED_SUBCOLLECTIONS.CHAT_SCOPE_DEGRADED_CAUSES,
    causeId,
  ],

  chatSyncEvent: (eventId: string): [string, string] => [COLLECTIONS.CHAT_SYNC_EVENTS, eventId],

  chatSyncFanoutJob: (jobId: string): [string, string] => [
    COLLECTIONS.CHAT_SYNC_FANOUT_JOBS,
    jobId,
  ],

  chatMessageOutboxCommand: (commandId: string): [string, string] => [
    COLLECTIONS.CHAT_MESSAGE_OUTBOX,
    commandId,
  ],

  chatAdminActionCommand: (requestId: string): [string, string] => [
    COLLECTIONS.CHAT_ADMIN_ACTION_COMMANDS,
    requestId,
  ],

  chatHistoryAnonymizationJob: (jobId: string): [string, string] => [
    COLLECTIONS.CHAT_HISTORY_ANONYMIZATION_JOBS,
    jobId,
  ],

  chatParkedDelivery: (deliveryId: string): [string, string] => [
    COLLECTIONS.CHAT_PARKED_DELIVERIES,
    deliveryId,
  ],

  chatHistoryAnonymizationAffectedChunk: (
    jobId: string,
    chunkOrdinal: string,
  ): [string, string, string, string] => [
    COLLECTIONS.CHAT_HISTORY_ANONYMIZATION_JOBS,
    jobId,
    NESTED_SUBCOLLECTIONS.CHAT_ANONYMIZATION_AFFECTED_CHUNKS,
    chunkOrdinal,
  ],

  pledgePayment: (pledgePaymentId: string): [string, string] => [
    COLLECTIONS.PLEDGE_PAYMENTS,
    pledgePaymentId,
  ],

  pledgePaymentProviderRef: (pledgePaymentId: string): [string, string] => [
    COLLECTIONS.PLEDGE_PAYMENT_PROVIDER_REFS,
    pledgePaymentId,
  ],

  pledgePaymentTotals: (): [string, string] => [
    COLLECTIONS.PLEDGE_PAYMENT_TOTALS,
    SPECIAL_DOCS.SUMMARY,
  ],

  processedStripeEvent: (stripeEventId: string): [string, string] => [
    COLLECTIONS.PROCESSED_STRIPE_EVENTS,
    stripeEventId,
  ],

  pledgePaymentLedgerEvent: (ledgerId: string): [string, string] => [
    COLLECTIONS.PLEDGE_PAYMENT_LEDGER_EVENTS,
    ledgerId,
  ],

  paymentWebhookQuarantine: (stripeEventId: string): [string, string] => [
    COLLECTIONS.PAYMENT_WEBHOOK_QUARANTINE,
    stripeEventId,
  ],

  pledgeRefundRequest: (requestId: string): [string, string] => [
    COLLECTIONS.PLEDGE_REFUND_REQUESTS,
    requestId,
  ],

  feedbackSubmission: (feedbackType: string): [string, string] => [
    COLLECTIONS.FEEDBACK_SUBMISSIONS,
    feedbackType,
  ],

  userSuggestion: (
    feedbackType: string,
    suggestionId: string,
  ): [string, string, string, string] => [
    COLLECTIONS.FEEDBACK_SUBMISSIONS,
    feedbackType,
    NESTED_SUBCOLLECTIONS.USER_SUGGESTIONS,
    suggestionId,
  ],

  feedbackAlias: (aliasId: string): [string, string, string, string] => [
    COLLECTIONS.SERVER_DATA,
    SPECIAL_DOCS.FEEDBACK_LISTS,
    NESTED_SUBCOLLECTIONS.FEEDBACK_ALIASES,
    aliasId,
  ],

  feedbackDenylist: (deniedWord: string): [string, string, string, string] => [
    COLLECTIONS.SERVER_DATA,
    SPECIAL_DOCS.FEEDBACK_LISTS,
    NESTED_SUBCOLLECTIONS.FEEDBACK_DENYLIST,
    deniedWord,
  ],

  taggedCraftSkill: (
    tag: string,
    craftSkillId: string,
    ownerUid: string,
  ): [string, string, string, string] => [
    COLLECTIONS.CRAFT_SKILLS_BY_TAG,
    tag,
    NESTED_SUBCOLLECTIONS.TAGGED_CRAFT_SKILLS,
    taggedCraftSkillDocId(craftSkillId, ownerUid),
  ],

  adminList: (): [string, string] => [COLLECTIONS.SYSTEM_DATA, SPECIAL_DOCS.ADMIN_LIST],

  futurePlans: (): [string, string] => [COLLECTIONS.APP_CONFIG, SPECIAL_DOCS.FUTURE_PLANS],

  profanityList: (): [string, string] => [COLLECTIONS.SYSTEM_DATA, SPECIAL_DOCS.PROFANITY_LIST],

  reservedUsernames: (): [string, string] => [
    COLLECTIONS.SYSTEM_DATA,
    SPECIAL_DOCS.RESERVED_USERNAMES,
  ],

  blockedFranchiseNames: (): [string, string] => [
    COLLECTIONS.SYSTEM_DATA,
    SPECIAL_DOCS.BLOCKED_FRANCHISE_NAMES,
  ],

  rulesAndAgreements: (): [string, string] => [
    COLLECTIONS.APP_CONFIG,
    SPECIAL_DOCS.RULES_AND_AGREEMENTS,
  ],

  termsPage: (): [string, string] => [COLLECTIONS.APP_CONFIG, SPECIAL_DOCS.TERMS_PAGE],

  privacyPage: (): [string, string] => [COLLECTIONS.APP_CONFIG, SPECIAL_DOCS.PRIVACY_PAGE],

  takeItDownPageCopy: (): [string, string] => [
    COLLECTIONS.APP_CONFIG,
    SPECIAL_DOCS.TAKE_IT_DOWN_PAGE_COPY,
  ],

  dmcaPolicy: (): [string, string] => [COLLECTIONS.APP_CONFIG, SPECIAL_DOCS.DMCA_POLICY],

  publicDocumentProjection: (documentId: PublicDocumentId): [string, string] => [
    COLLECTIONS.APP_CONFIG,
    documentId,
  ],

  publicDocumentVersion: (
    documentId: PublicDocumentId,
    version: number,
  ): [string, string, string, string] => [
    COLLECTIONS.PUBLIC_DOCUMENTS,
    documentId,
    NESTED_SUBCOLLECTIONS.PUBLIC_DOCUMENT_VERSIONS,
    publicDocumentVersionDocId(version),
  ],

  publicDocumentDraft: (documentId: PublicDocumentId): [string, string] => [
    COLLECTIONS.PUBLIC_DOCUMENT_DRAFTS,
    documentId,
  ],

  publicDocumentRelease: (releaseId: string): [string, string] => [
    COLLECTIONS.PUBLIC_DOCUMENT_RELEASES,
    releaseId,
  ],

  appConfig: (): [string, string] => [COLLECTIONS.APP_CONFIG, SPECIAL_DOCS.APP_CONFIG],

  appModeMarker: (): [string, string] => [COLLECTIONS.SYSTEM_DATA, SPECIAL_DOCS.APP_MODE],

  systemVideoSlots: (): [string, string] => [
    COLLECTIONS.SYSTEM_DATA,
    SPECIAL_DOCS.SYSTEM_VIDEO_SLOTS,
  ],

  systemUidSlots: (): [string, string] => [COLLECTIONS.APP_CONFIG, SPECIAL_DOCS.SYSTEM_UID_SLOTS],

  statusReconcileQueueEntry: (uid: string): [string, string] => [
    COLLECTIONS.STATUS_RECONCILE_QUEUE,
    uid,
  ],

  adminDispatchAppealLock: (uid: string): [string, string] => [
    COLLECTIONS.ADMIN_DISPATCH_APPEAL_LOCKS,
    uid,
  ],

  childSafetyCaseListEntry: (caseId: string): [string, string] => [
    COLLECTIONS.CHILD_SAFETY_CASE_LIST,
    caseId,
  ],

  childSafetyCase: (caseId: string): [string, string] => [COLLECTIONS.CHILD_SAFETY_CASES, caseId],

  childSafetySourceSignal: (caseId: string, signalId: string): [string, string, string, string] => [
    COLLECTIONS.CHILD_SAFETY_CASES,
    caseId,
    NESTED_SUBCOLLECTIONS.CHILD_SAFETY_SOURCE_SIGNALS,
    signalId,
  ],

  childSafetySourceSignals: (caseId: string): [string, string, string] => [
    COLLECTIONS.CHILD_SAFETY_CASES,
    caseId,
    NESTED_SUBCOLLECTIONS.CHILD_SAFETY_SOURCE_SIGNALS,
  ],

  childSafetyDecision: (
    caseId: string,
    decision: ChildSafetyDecisionIdParts,
  ): [string, string, string, string] => [
    COLLECTIONS.CHILD_SAFETY_CASES,
    caseId,
    NESTED_SUBCOLLECTIONS.CHILD_SAFETY_DECISIONS,
    childSafetyDecisionDocId(caseId, decision),
  ],

  childSafetyDecisions: (caseId: string): [string, string, string] => [
    COLLECTIONS.CHILD_SAFETY_CASES,
    caseId,
    NESTED_SUBCOLLECTIONS.CHILD_SAFETY_DECISIONS,
  ],

  childSafetyDecisionView: (
    caseId: string,
    decisionId: string,
    viewId: string,
  ): [string, string, string, string, string, string] => [
    COLLECTIONS.CHILD_SAFETY_CASES,
    caseId,
    NESTED_SUBCOLLECTIONS.CHILD_SAFETY_DECISIONS,
    decisionId,
    NESTED_SUBCOLLECTIONS.CHILD_SAFETY_DECISION_VIEWS,
    viewId,
  ],

  childSafetyCaseAccount: (caseId: string, uid: string): [string, string, string, string] => [
    COLLECTIONS.CHILD_SAFETY_CASES,
    caseId,
    NESTED_SUBCOLLECTIONS.CHILD_SAFETY_CASE_ACCOUNTS,
    uid,
  ],

  childSafetyCaseAccounts: (caseId: string): [string, string, string] => [
    COLLECTIONS.CHILD_SAFETY_CASES,
    caseId,
    NESTED_SUBCOLLECTIONS.CHILD_SAFETY_CASE_ACCOUNTS,
  ],

  childSafetyCaseCrossoverItem: (
    caseId: string,
    mediaAssetId: string,
  ): [string, string, string, string] => [
    COLLECTIONS.CHILD_SAFETY_CASES,
    caseId,
    NESTED_SUBCOLLECTIONS.CHILD_SAFETY_CASE_CROSSOVER_ITEMS,
    mediaAssetId,
  ],

  childSafetyCaseCrossoverItems: (caseId: string): [string, string, string] => [
    COLLECTIONS.CHILD_SAFETY_CASES,
    caseId,
    NESTED_SUBCOLLECTIONS.CHILD_SAFETY_CASE_CROSSOVER_ITEMS,
  ],

  childSafetyCaseAccountHistory: (
    caseId: string,
    uid: string,
    at: number,
    source: AccountActionSource,
  ): [string, string, string, string, string, string] => [
    COLLECTIONS.CHILD_SAFETY_CASES,
    caseId,
    NESTED_SUBCOLLECTIONS.CHILD_SAFETY_CASE_ACCOUNTS,
    uid,
    NESTED_SUBCOLLECTIONS.CHILD_SAFETY_CASE_ACCOUNT_HISTORY,
    childSafetyCaseAccountHistoryDocId(at, source),
  ],

  childSafetyNcmecSubmission: (
    caseId: string,
    submissionId: string,
  ): [string, string, string, string] => [
    COLLECTIONS.CHILD_SAFETY_CASES,
    caseId,
    NESTED_SUBCOLLECTIONS.CHILD_SAFETY_NCMEC_SUBMISSIONS,
    submissionId,
  ],

  childSafetyNcmecSubmissionFile: (
    caseId: string,
    submissionId: string,
    fileId: string,
  ): [string, string, string, string, string, string] => [
    COLLECTIONS.CHILD_SAFETY_CASES,
    caseId,
    NESTED_SUBCOLLECTIONS.CHILD_SAFETY_NCMEC_SUBMISSIONS,
    submissionId,
    NESTED_SUBCOLLECTIONS.CHILD_SAFETY_NCMEC_SUBMISSION_FILES,
    fileId,
  ],

  childSafetyNcmecCompletionProof: (
    caseId: string,
    submissionId: string,
  ): [string, string, string, string, string, string] => [
    COLLECTIONS.CHILD_SAFETY_CASES,
    caseId,
    NESTED_SUBCOLLECTIONS.CHILD_SAFETY_NCMEC_SUBMISSIONS,
    submissionId,
    NESTED_SUBCOLLECTIONS.NCMEC_COMPLETION_PROOF,
    SPECIAL_DOCS.RECORD,
  ],

  childSafetyLegalProcessEvent: (
    caseId: string,
    eventId: string,
  ): [string, string, string, string] => [
    COLLECTIONS.CHILD_SAFETY_CASES,
    caseId,
    NESTED_SUBCOLLECTIONS.CHILD_SAFETY_LEGAL_PROCESS,
    eventId,
  ],

  childSafetyPortalReceiptArtifact: (
    caseId: string,
    artifactId: string,
  ): [string, string, string, string] => [
    COLLECTIONS.CHILD_SAFETY_CASES,
    caseId,
    NESTED_SUBCOLLECTIONS.NCMEC_PORTAL_RECEIPT_ARTIFACTS,
    artifactId,
  ],

  childSafetyPortalReceiptArtifacts: (caseId: string): [string, string, string] => [
    COLLECTIONS.CHILD_SAFETY_CASES,
    caseId,
    NESTED_SUBCOLLECTIONS.NCMEC_PORTAL_RECEIPT_ARTIFACTS,
  ],

  childSafetyNcmecPortalCorrection: (
    caseId: string,
    correctionId: string,
  ): [string, string, string, string] => [
    COLLECTIONS.CHILD_SAFETY_CASES,
    caseId,
    NESTED_SUBCOLLECTIONS.NCMEC_PORTAL_CORRECTIONS,
    correctionId,
  ],

  childSafetyNcmecPortalCorrections: (caseId: string): [string, string, string] => [
    COLLECTIONS.CHILD_SAFETY_CASES,
    caseId,
    NESTED_SUBCOLLECTIONS.NCMEC_PORTAL_CORRECTIONS,
  ],

  childSafetyOwningAlias: (aliasId: string): [string, string] => [
    COLLECTIONS.CHILD_SAFETY_OWNING_ALIASES,
    aliasId,
  ],

  safetyHoldRef: (caseId: string, resourceKeyHash: string): [string, string] => [
    COLLECTIONS.SAFETY_HOLD_REFS,
    safetyHoldRefDocId(caseId, resourceKeyHash),
  ],

  safetyHoldResource: (resourceKeyHash: string): [string, string] => [
    COLLECTIONS.SAFETY_HOLD_RESOURCES,
    resourceKeyHash,
  ],

  safetyResourceCommand: (commandDocId: string): [string, string] => [
    COLLECTIONS.SAFETY_RESOURCE_COMMANDS,
    commandDocId,
  ],

  safetyResourceCommandAuthorizedRequest: (
    commandDocId: string,
    requestId: string,
  ): [string, string, string, string] => [
    COLLECTIONS.SAFETY_RESOURCE_COMMANDS,
    commandDocId,
    NESTED_SUBCOLLECTIONS.SAFETY_RESOURCE_COMMAND_AUTHORIZED_REQUESTS,
    requestId,
  ],

  safetyResourceCommandBypassRef: (
    commandDocId: string,
    refId: string,
  ): [string, string, string, string] => [
    COLLECTIONS.SAFETY_RESOURCE_COMMANDS,
    commandDocId,
    NESTED_SUBCOLLECTIONS.SAFETY_RESOURCE_COMMAND_BYPASS_REFS,
    refId,
  ],

  safetyEvidenceManifest: (manifestId: string): [string, string] => [
    COLLECTIONS.SAFETY_EVIDENCE_MANIFESTS,
    manifestId,
  ],

  safetyEvidenceJob: (jobId: string): [string, string] => [COLLECTIONS.SAFETY_EVIDENCE_JOBS, jobId],

  safetyEvidenceJobItem: (jobId: string, itemId: string): [string, string, string, string] => [
    COLLECTIONS.SAFETY_EVIDENCE_JOBS,
    jobId,
    NESTED_SUBCOLLECTIONS.SAFETY_EVIDENCE_JOB_ITEMS,
    itemId,
  ],

  safetyEvidenceJobDisposition: (
    jobId: string,
    locationId: string,
  ): [string, string, string, string] => [
    COLLECTIONS.SAFETY_EVIDENCE_JOBS,
    jobId,
    NESTED_SUBCOLLECTIONS.SAFETY_EVIDENCE_JOB_DISPOSITION,
    locationId,
  ],

  eventProvenance: (eventId: string): [string, string] => [COLLECTIONS.EVENT_PROVENANCE, eventId],

  quarantineSagaJob: (caseId: string): [string, string] => [
    COLLECTIONS.QUARANTINE_SAGA_JOBS,
    caseId,
  ],

  quarantineSagaRelatedAsset: (
    caseId: string,
    assetId: string,
  ): [string, string, string, string] => [
    COLLECTIONS.QUARANTINE_SAGA_JOBS,
    caseId,
    NESTED_SUBCOLLECTIONS.QUARANTINE_SAGA_RELATED_ASSETS,
    assetId,
  ],

  ncmecSubmissionJob: (caseId: string, submissionId: string): [string, string] => [
    COLLECTIONS.NCMEC_SUBMISSION_JOBS,
    ncmecSubmissionJobDocId(caseId, submissionId),
  ],

  accountActionCommand: (
    caseId: string,
    targetUid: string,
    source: AccountActionSource,
  ): [string, string] => [
    COLLECTIONS.ACCOUNT_ACTION_COMMANDS,
    accountActionCommandDocId(caseId, targetUid, source),
  ],

  safetySlaMonitor: (scopeId: string, monitorKind: SafetySlaMonitorKind): [string, string] => [
    COLLECTIONS.SAFETY_SLA_MONITORS,
    safetySlaMonitorDocId(scopeId, monitorKind),
  ],

  safetyMonitorHeartbeat: (): [string, string] => [
    COLLECTIONS.SAFETY_MONITOR_HEARTBEAT,
    SPECIAL_DOCS.SAFETY_MONITOR_HEARTBEAT_GLOBAL,
  ],

  ageAttestationNonce: (nonceHash: string): [string, string] => [
    COLLECTIONS.AGE_ATTESTATION_NONCES,
    nonceHash,
  ],

  operatorStepUp: (uid: string): [string, string] => [COLLECTIONS.OPERATOR_STEP_UP, uid],

  sweepState: (sweepName: SweepStateName): [string, string] => [COLLECTIONS.SWEEP_STATE, sweepName],

  nciiAllegation: (allegationId: string): [string, string] => [
    COLLECTIONS.NCII_ALLEGATIONS,
    allegationId,
  ],

  takeItDownRequest: (requestId: string): [string, string] => [
    COLLECTIONS.TAKE_IT_DOWN_REQUESTS,
    requestId,
  ],

  takeItDownRequesterPrivate: (requestId: string): [string, string, string, string] => [
    COLLECTIONS.TAKE_IT_DOWN_REQUESTS,
    requestId,
    NESTED_SUBCOLLECTIONS.PRIVATE,
    SPECIAL_DOCS.TAKE_IT_DOWN_REQUESTER,
  ],

  takeItDownSubmission: (
    requestId: string,
    submissionId: string,
  ): [string, string, string, string] => [
    COLLECTIONS.TAKE_IT_DOWN_REQUESTS,
    requestId,
    NESTED_SUBCOLLECTIONS.TAKE_IT_DOWN_SUBMISSIONS,
    submissionId,
  ],

  takeItDownSubmissions: (requestId: string): [string, string, string] => [
    COLLECTIONS.TAKE_IT_DOWN_REQUESTS,
    requestId,
    NESTED_SUBCOLLECTIONS.TAKE_IT_DOWN_SUBMISSIONS,
  ],

  takeItDownValidityDecisions: (requestId: string): [string, string, string] => [
    COLLECTIONS.TAKE_IT_DOWN_REQUESTS,
    requestId,
    NESTED_SUBCOLLECTIONS.TAKE_IT_DOWN_VALIDITY_DECISIONS,
  ],

  takeItDownValidityDecision: (
    requestId: string,
    decisionId: string,
  ): [string, string, string, string] => [
    COLLECTIONS.TAKE_IT_DOWN_REQUESTS,
    requestId,
    NESTED_SUBCOLLECTIONS.TAKE_IT_DOWN_VALIDITY_DECISIONS,
    decisionId,
  ],

  takeItDownValidityRationale: (
    requestId: string,
    decisionId: string,
  ): [string, string, string, string, string, string] => [
    COLLECTIONS.TAKE_IT_DOWN_REQUESTS,
    requestId,
    NESTED_SUBCOLLECTIONS.TAKE_IT_DOWN_VALIDITY_DECISIONS,
    decisionId,
    NESTED_SUBCOLLECTIONS.TAKE_IT_DOWN_VALIDITY_RATIONALE,
    SPECIAL_DOCS.RECORD,
  ],

  takeItDownRequestAction: (
    requestId: string,
    actionId: string,
  ): [string, string, string, string] => [
    COLLECTIONS.TAKE_IT_DOWN_REQUESTS,
    requestId,
    NESTED_SUBCOLLECTIONS.TAKE_IT_DOWN_ACTIONS,
    actionId,
  ],

  takeItDownEvidence: (requestId: string, evidenceId: string): [string, string, string, string] => [
    COLLECTIONS.TAKE_IT_DOWN_REQUESTS,
    requestId,
    NESTED_SUBCOLLECTIONS.TAKE_IT_DOWN_EVIDENCE,
    evidenceId,
  ],

  takeItDownEvidenceDisposition: (
    requestId: string,
    evidenceId: string,
  ): [string, string, string, string] => [
    COLLECTIONS.TAKE_IT_DOWN_REQUESTS,
    requestId,
    NESTED_SUBCOLLECTIONS.TAKE_IT_DOWN_EVIDENCE_DISPOSITION,
    evidenceId,
  ],

  nciiRetainedEvidenceInventory: (inventoryId: string): [string, string] => [
    COLLECTIONS.NCII_RETAINED_EVIDENCE_INVENTORY,
    inventoryId,
  ],

  nciiInventoryDeadLetter: (inventoryId: string): [string, string] => [
    COLLECTIONS.NCII_INVENTORY_DEAD_LETTER,
    inventoryId,
  ],

  nciiCase: (caseId: string): [string, string] => [COLLECTIONS.NCII_CASES, caseId],

  nciiCaseAllegationLink: (
    caseId: string,
    allegationId: string,
  ): [string, string, string, string] => [
    COLLECTIONS.NCII_CASES,
    caseId,
    NESTED_SUBCOLLECTIONS.NCII_CASE_ALLEGATION_LINKS,
    allegationId,
  ],

  nciiCaseAllegationLinks: (caseId: string): [string, string, string] => [
    COLLECTIONS.NCII_CASES,
    caseId,
    NESTED_SUBCOLLECTIONS.NCII_CASE_ALLEGATION_LINKS,
  ],

  nciiCaseRequestLink: (caseId: string, requestId: string): [string, string, string, string] => [
    COLLECTIONS.NCII_CASES,
    caseId,
    NESTED_SUBCOLLECTIONS.NCII_CASE_REQUEST_LINKS,
    requestId,
  ],

  nciiCaseRequestLinks: (caseId: string): [string, string, string] => [
    COLLECTIONS.NCII_CASES,
    caseId,
    NESTED_SUBCOLLECTIONS.NCII_CASE_REQUEST_LINKS,
  ],

  nciiCaseClosureEvent: (
    caseId: string,
    transition: CaseLifecycleTransition,
    revision: number,
  ): [string, string, string, string] => [
    COLLECTIONS.NCII_CASES,
    caseId,
    NESTED_SUBCOLLECTIONS.NCII_CASE_CLOSURE_EVENTS,
    nciiCaseClosureEventDocId(transition, revision),
  ],

  nciiCaseClosureEvents: (caseId: string): [string, string, string] => [
    COLLECTIONS.NCII_CASES,
    caseId,
    NESTED_SUBCOLLECTIONS.NCII_CASE_CLOSURE_EVENTS,
  ],

  nciiCaseRemovalAction: (caseId: string, actionId: string): [string, string, string, string] => [
    COLLECTIONS.NCII_CASES,
    caseId,
    NESTED_SUBCOLLECTIONS.NCII_CASE_REMOVAL_ACTIONS,
    actionId,
  ],

  nciiBlockedHash: (caseId: string, hashId: string): [string, string, string, string] => [
    COLLECTIONS.NCII_CASES,
    caseId,
    NESTED_SUBCOLLECTIONS.NCII_CASE_BLOCKED_HASHES,
    hashId,
  ],

  nciiTemporaryHold: (holdId: string): [string, string] => [
    COLLECTIONS.NCII_TEMPORARY_HOLDS,
    holdId,
  ],

  nciiRemovalJob: (jobId: string): [string, string] => [COLLECTIONS.NCII_REMOVAL_JOBS, jobId],

  nciiRemovalTarget: (jobId: string, targetKeyHash: string): [string, string, string, string] => [
    COLLECTIONS.NCII_REMOVAL_JOBS,
    jobId,
    NESTED_SUBCOLLECTIONS.NCII_REMOVAL_TARGETS,
    targetKeyHash,
  ],

  auditEvent: (eventId: string): [string, string] => [COLLECTIONS.AUDIT_EVENTS, eventId],

  auditEvents: (): [string] => [COLLECTIONS.AUDIT_EVENTS],

  notificationArchiveAllJob: (jobId: string): [string, string] => [
    COLLECTIONS.NOTIFICATION_ARCHIVE_ALL_JOBS,
    jobId,
  ],

  agePolicyConfig: (): [string, string] => [COLLECTIONS.SERVER_DATA, SPECIAL_DOCS.AGE_POLICY],

  nciiPolicyConfig: (): [string, string] => [COLLECTIONS.SERVER_DATA, SPECIAL_DOCS.NCII_POLICY],
} as const;
