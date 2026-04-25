// Document path builders — returns tuples of path segments.
//
// Frontend (Web SDK):  doc(db, ...PATH_BUILDERS.userProfile(userId))
// Backend (Admin SDK): db.doc(toPath(PATH_BUILDERS.userProfile(userId)))

import {
  COLLECTIONS,
  USER_SUBCOLLECTIONS,
  PROJECT_SUBCOLLECTIONS,
  NESTED_SUBCOLLECTIONS,
  SPECIAL_DOCS,
} from './collections.js';

export const PATH_BUILDERS = {
  // ===== USER PATHS =====
  userProfile: (userId: string): [string, string] =>
    [COLLECTIONS.USER_PROFILES, userId],

  userSkill: (userId: string, skillId: string): [string, string, string, string] =>
    [COLLECTIONS.USER_PROFILES, userId, USER_SUBCOLLECTIONS.PROFILE_SKILLS, skillId],

  userPrivateData: (userId: string): [string, string, string, string] =>
    [COLLECTIONS.USER_PROFILES, userId, USER_SUBCOLLECTIONS.PRIVATE_DATA, userId],

  userMetadata: (userId: string): [string, string, string, string] =>
    [COLLECTIONS.USER_PROFILES, userId, USER_SUBCOLLECTIONS.USER_METADATA, SPECIAL_DOCS.NOTIFICATION_SETTINGS],

  userFollow: (userId: string, followDocId: string): [string, string, string, string] =>
    [COLLECTIONS.USER_PROFILES, userId, USER_SUBCOLLECTIONS.USER_FOLLOWS, followDocId],

  followedUser: (userId: string, followedUserId: string): [string, string, string, string, string, string] =>
    [COLLECTIONS.USER_PROFILES, userId, USER_SUBCOLLECTIONS.USER_FOLLOWS, NESTED_SUBCOLLECTIONS.FOLLOW_HISTORY, NESTED_SUBCOLLECTIONS.FOLLOWED_USERS, followedUserId],

  userLike: (userId: string, postId: string): [string, string, string, string, string, string] =>
    [COLLECTIONS.USER_PROFILES, userId, USER_SUBCOLLECTIONS.USER_LIKES, NESTED_SUBCOLLECTIONS.LIKE_HISTORY, NESTED_SUBCOLLECTIONS.STREETZ_LIKES, postId],

  userDonation: (userId: string, donationId: string): [string, string, string, string] =>
    [COLLECTIONS.USER_PROFILES, userId, USER_SUBCOLLECTIONS.USER_DONATIONS, donationId],

  userOpportunityVote: (userId: string, opportunityId: string): [string, string, string, string] =>
    [COLLECTIONS.USER_PROFILES, userId, USER_SUBCOLLECTIONS.OPPORTUNITY_VOTES, opportunityId],

  // ===== PROJECT PATHS =====
  project: (projectId: string): [string, string] =>
    [COLLECTIONS.ALL_PROJECTS, projectId],

  projectPublicData: (projectId: string, publicId: string): [string, string, string, string] =>
    [COLLECTIONS.ALL_PROJECTS, projectId, PROJECT_SUBCOLLECTIONS.PUBLIC_DATA, publicId],

  projectPost: (projectId: string, postId: string): [string, string, string, string] =>
    [COLLECTIONS.ALL_PROJECTS, projectId, PROJECT_SUBCOLLECTIONS.PROJECT_POSTS, postId],

  projectTale: (projectId: string, taleId: string): [string, string, string, string] =>
    [COLLECTIONS.ALL_PROJECTS, projectId, PROJECT_SUBCOLLECTIONS.PROJECT_TALES, taleId],

  taleChapter: (projectId: string, taleId: string, chapterId: string): [string, string, string, string, string, string] =>
    [COLLECTIONS.ALL_PROJECTS, projectId, PROJECT_SUBCOLLECTIONS.PROJECT_TALES, taleId, NESTED_SUBCOLLECTIONS.TALE_CHAPTERS, chapterId],

  projectTune: (projectId: string, tuneId: string): [string, string, string, string] =>
    [COLLECTIONS.ALL_PROJECTS, projectId, PROJECT_SUBCOLLECTIONS.PROJECT_TUNES, tuneId],

  tuneSong: (projectId: string, tuneId: string, songId: string): [string, string, string, string, string, string] =>
    [COLLECTIONS.ALL_PROJECTS, projectId, PROJECT_SUBCOLLECTIONS.PROJECT_TUNES, tuneId, NESTED_SUBCOLLECTIONS.TUNE_SONGS, songId],

  projectTelevision: (projectId: string, televisionId: string): [string, string, string, string] =>
    [COLLECTIONS.ALL_PROJECTS, projectId, PROJECT_SUBCOLLECTIONS.PROJECT_TELEVISION, televisionId],

  tvShow: (projectId: string, televisionId: string, showId: string): [string, string, string, string, string, string] =>
    [COLLECTIONS.ALL_PROJECTS, projectId, PROJECT_SUBCOLLECTIONS.PROJECT_TELEVISION, televisionId, NESTED_SUBCOLLECTIONS.TV_SHOWS, showId],

  projectShare: (projectId: string, shareId: string): [string, string, string, string] =>
    [COLLECTIONS.ALL_PROJECTS, projectId, PROJECT_SUBCOLLECTIONS.SHARE_HISTORY, shareId],

  chatChannel: (projectId: string, channelId: string): [string, string, string, string] =>
    [COLLECTIONS.ALL_PROJECTS, projectId, PROJECT_SUBCOLLECTIONS.CHAT_CHANNELS, channelId],

  channelMessage: (projectId: string, channelId: string, messageId: string): [string, string, string, string, string, string] =>
    [COLLECTIONS.ALL_PROJECTS, projectId, PROJECT_SUBCOLLECTIONS.CHAT_CHANNELS, channelId, NESTED_SUBCOLLECTIONS.CHANNEL_MESSAGES, messageId],

  // ===== STREETZ PATHS =====
  activePost: (postId: string): [string, string, string, string] =>
    [COLLECTIONS.STREETZ_FEED, NESTED_SUBCOLLECTIONS.ACTIVE_POSTS, NESTED_SUBCOLLECTIONS.SOCIAL_POSTS, postId],

  trendingPosts: (): [string, string] =>
    [COLLECTIONS.STREETZ_FEED, NESTED_SUBCOLLECTIONS.TRENDING_POSTS],

  // ===== LIBRARY PATHS =====
  pendingLibraryItem: (libraryId: string): [string, string, string, string] =>
    [COLLECTIONS.CONTENT_LIBRARY, NESTED_SUBCOLLECTIONS.PENDING_ITEMS, NESTED_SUBCOLLECTIONS.LIBRARY_ITEMS, libraryId],

  publishedLibraryItem: (libraryId: string): [string, string, string, string] =>
    [COLLECTIONS.CONTENT_LIBRARY, NESTED_SUBCOLLECTIONS.PUBLISHED_ITEMS, NESTED_SUBCOLLECTIONS.LIBRARY_ITEMS, libraryId],

  publishedLibraryItemType: (libraryId: string, projectType: string, itemId: string): [string, string, string, string, string, string] =>
    [COLLECTIONS.CONTENT_LIBRARY, NESTED_SUBCOLLECTIONS.PUBLISHED_ITEMS, NESTED_SUBCOLLECTIONS.LIBRARY_ITEMS, libraryId, projectType, itemId],

  // ===== JOB PATHS =====
  jobListing: (jobId: string): [string, string] =>
    [COLLECTIONS.JOB_LISTINGS, jobId],

  jobApplication: (jobId: string, replyId: string): [string, string, string, string] =>
    [COLLECTIONS.JOB_LISTINGS, jobId, NESTED_SUBCOLLECTIONS.APPLICATION_REPLIES, replyId],

  // ===== OPPORTUNITY PATHS =====
  opportunity: (opportunityId: string): [string, string] =>
    [COLLECTIONS.OPPORTUNITY_BOARD, opportunityId],

  opportunityReply: (opportunityId: string, replyId: string): [string, string, string, string] =>
    [COLLECTIONS.OPPORTUNITY_BOARD, opportunityId, NESTED_SUBCOLLECTIONS.SUBMITTED_REPLIES, replyId],

  // ===== UNIVERSE PATHS =====
  universe: (universeId: string): [string, string] =>
    [COLLECTIONS.STORY_UNIVERSES, universeId],

  // ===== ADMIN & SYSTEM PATHS =====
  adminMessage: (messageId: string): [string, string] =>
    [COLLECTIONS.PENDING_ADMIN_MESSAGES, messageId],

  adminConversationMessage: (messageId: string, individualMessageId: string): [string, string, string, string] =>
    [COLLECTIONS.PENDING_ADMIN_MESSAGES, messageId, NESTED_SUBCOLLECTIONS.CONVERSATION_MESSAGES, individualMessageId],

  projectInvite: (inviteId: string): [string, string] =>
    [COLLECTIONS.PROJECT_INVITE_CONVERSATIONS, inviteId],

  inviteMessage: (inviteId: string, messageId: string): [string, string, string, string] =>
    [COLLECTIONS.PROJECT_INVITE_CONVERSATIONS, inviteId, NESTED_SUBCOLLECTIONS.INVITE_MESSAGES, messageId],

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

  // ===== UTILITY PATHS =====
  reservedDisplayName: (displayNameUppercase: string): [string, string] =>
    [COLLECTIONS.RESERVED_DISPLAY_NAMES, displayNameUppercase],

  shortLink: (shortId: string): [string, string] =>
    [COLLECTIONS.SHORT_LINKS, shortId],

  pendingMedia: (docId: string): [string, string] =>
    [COLLECTIONS.PENDING_MEDIA, docId],

  notificationQueue: (notificationId: string): [string, string] =>
    [COLLECTIONS.NOTIFICATION_QUEUE, notificationId],

  donationsSummary: (): [string, string] =>
    [COLLECTIONS.DONATIONS_SUMMARY, SPECIAL_DOCS.SUMMARY],

  recentDonation: (donationId: string): [string, string] =>
    [COLLECTIONS.RECENT_DONATIONS, donationId],

  archivedDonation: (donationId: string): [string, string] =>
    [COLLECTIONS.ARCHIVED_DONATIONS, donationId],

  // ===== FEEDBACK & SKILLS PATHS =====
  feedbackSubmission: (feedbackType: string): [string, string] =>
    [COLLECTIONS.FEEDBACK_SUBMISSIONS, feedbackType],

  userSuggestion: (feedbackType: string, suggestionId: string): [string, string, string, string] =>
    [COLLECTIONS.FEEDBACK_SUBMISSIONS, feedbackType, NESTED_SUBCOLLECTIONS.USER_SUGGESTIONS, suggestionId],

  feedbackAlias: (aliasId: string): [string, string] =>
    [COLLECTIONS.FEEDBACK_ALIASES, aliasId],

  feedbackDenylist: (deniedWord: string): [string, string] =>
    [COLLECTIONS.FEEDBACK_DENYLIST, deniedWord],

  taggedSkill: (tag: string, compositeId: string): [string, string, string, string] =>
    [COLLECTIONS.SKILLS_BY_TAG, tag, NESTED_SUBCOLLECTIONS.TAGGED_SKILLS, compositeId],

  // ===== SYSTEM DATA PATHS =====
  adminList: (): [string, string] =>
    [COLLECTIONS.SYSTEM_DATA, SPECIAL_DOCS.ADMIN_LIST],

  futurePlans: (): [string, string] =>
    [COLLECTIONS.SYSTEM_DATA, SPECIAL_DOCS.FUTURE_PLANS],

  rulesAndAgreements: (): [string, string] =>
    [COLLECTIONS.SYSTEM_DATA, SPECIAL_DOCS.RULES_AND_AGREEMENTS],
} as const;
