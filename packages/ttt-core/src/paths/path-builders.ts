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

  workProjectAsset: (workProjectId: string, workAssetId: string): [string, string, string, string] =>
    [COLLECTIONS.ALL_WORK_PROJECTS, workProjectId, WORK_PROJECT_SUBCOLLECTIONS.WORK_ASSETS, workAssetId],

  stakeShareAuditEvent: (eventId: string): [string, string] =>
    [COLLECTIONS.STAKE_SHARE_AUDIT_EVENTS, eventId],

  guildChatChannel: (workProjectId: string, guildChatChannelId: string): [string, string, string, string] =>
    [COLLECTIONS.ALL_WORK_PROJECTS, workProjectId, WORK_PROJECT_SUBCOLLECTIONS.GUILD_CHAT_CHANNELS, guildChatChannelId],

  guildChatMessage: (workProjectId: string, guildChatChannelId: string, guildChatMessageId: string): [string, string, string, string, string, string] =>
    [COLLECTIONS.ALL_WORK_PROJECTS, workProjectId, WORK_PROJECT_SUBCOLLECTIONS.GUILD_CHAT_CHANNELS, guildChatChannelId, NESTED_SUBCOLLECTIONS.GUILD_CHAT_MESSAGES, guildChatMessageId],

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

  inviteMessage: (guildInviteId: string, guildInviteMessageId: string): [string, string, string, string] =>
    [COLLECTIONS.GUILD_INVITE_CONVERSATIONS, guildInviteId, NESTED_SUBCOLLECTIONS.INVITE_MESSAGES, guildInviteMessageId],

  contentReport: (reportId: string): [string, string] =>
    [COLLECTIONS.CONTENT_REPORTS, reportId],

  activeReportGroup: (groupKey: string): [string, string] =>
    [COLLECTIONS.ACTIVE_REPORT_GROUPS, groupKey],

  contentViolation: (violationId: string): [string, string] =>
    [COLLECTIONS.CONTENT_VIOLATIONS, violationId],

  adminTask: (taskId: string): [string, string] =>
    [COLLECTIONS.ADMIN_TASKS, taskId],

  adminTaskForItem: (taskType: string, itemId: string): [string, string] =>
    [COLLECTIONS.ADMIN_TASKS, `${taskType}-${itemId}`],

  adminActivityLog: (logId: string): [string, string] =>
    [COLLECTIONS.ADMIN_ACTIVITY_LOG, logId],

  moderationCascadeManifest: (cascadeId: string): [string, string] =>
    [COLLECTIONS.MODERATION_CASCADE_MANIFESTS, cascadeId],

  moderationCascadeChangedDoc: (cascadeId: string, changedDocId: string): [string, string, string, string] =>
    [COLLECTIONS.MODERATION_CASCADE_MANIFESTS, cascadeId, NESTED_SUBCOLLECTIONS.CHANGED_DOCS, changedDocId],

  // ===== UTILITY PATHS =====
  reservedDisplayName: (displayNameUppercase: string): [string, string] =>
    [COLLECTIONS.RESERVED_DISPLAY_NAMES, displayNameUppercase],

  shortLink: (shortId: string): [string, string] =>
    [COLLECTIONS.SHORT_LINKS, shortId],

  pendingMedia: (docId: string): [string, string] =>
    [COLLECTIONS.PENDING_MEDIA, docId],

  pendingMediaArchive: (docId: string): [string, string] =>
    [COLLECTIONS.PENDING_MEDIA_ARCHIVE, docId],

  // ===== PAYMENT & PLEDGE PATHS =====
  // Public-safe canonical money record. Stripe IDs live on pledgePaymentProviderRef (server-only).
  pledgePayment: (pledgePaymentId: string): [string, string] =>
    [COLLECTIONS.PLEDGE_PAYMENTS, pledgePaymentId],

  // Server-only Stripe references (session/PI/charge/dispute IDs). One doc per pledge — singular.
  pledgePaymentProviderRef: (pledgePaymentId: string): [string, string] =>
    [COLLECTIONS.PLEDGE_PAYMENT_PROVIDER_REFS, pledgePaymentId],

  // Idempotency sentinel, keyed by the Stripe event.id.
  processedStripeEvent: (stripeEventId: string): [string, string] =>
    [COLLECTIONS.PROCESSED_STRIPE_EVENTS, stripeEventId],

  // Independent integrity record from the ledger verification trigger.
  pledgePaymentLedgerEvent: (ledgerId: string): [string, string] =>
    [COLLECTIONS.PLEDGE_PAYMENT_LEDGER_EVENTS, ledgerId],

  // Unrecoverable paid-event repair queue, keyed by the Stripe event.id.
  paymentWebhookQuarantine: (stripeEventId: string): [string, string] =>
    [COLLECTIONS.PAYMENT_WEBHOOK_QUARANTINE, stripeEventId],

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

  rulesAndAgreements: (): [string, string] =>
    [COLLECTIONS.APP_CONFIG, SPECIAL_DOCS.RULES_AND_AGREEMENTS],

  appConfig: (): [string, string] =>
    [COLLECTIONS.APP_CONFIG, SPECIAL_DOCS.APP_CONFIG],
} as const;
