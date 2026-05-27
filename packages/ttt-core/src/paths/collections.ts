// Firestore collection name constants — canonical source of truth
// Changes to these values require database migration.

/**
 * TOP-LEVEL COLLECTIONS
 */
export const COLLECTIONS = {
  // Core entities
  USER_PROFILES: 'userProfiles',
  PUBLIC_USERS: 'publicUsers',
  ALL_PROJECTS: 'allWorkProjects',
  STORY_UNIVERSES: 'workRealms',

  // Content & Social
  STREETZ_FEED: 'squareStreetzFeed',
  THRESHOLD_ITEMS: 'thresholdItems',
  HALL_ITEMS: 'hallItems',
  JOB_LISTINGS: 'commissionListings',
  OPPORTUNITY_BOARD: 'auditionBoard',

  // System & Utility
  RESERVED_DISPLAY_NAMES: 'reservedDisplayNames',
  DONATIONS_SUMMARY: 'donationsSummary',
  CONTENT_REPORTS: 'contentReports',
  PENDING_MEDIA: 'pendingMedia',
  PENDING_MEDIA_ARCHIVE: 'pendingMediaArchive',
  PENDING_ADMIN_MESSAGES: 'pendingAdminDispatches',
  ACTIVE_REPORT_GROUPS: 'activeReportGroups',
  CONTENT_VIOLATIONS: 'contentViolations',
  ADMIN_TASKS: 'adminTasks',
  ADMIN_ACTIVITY_LOG: 'adminActivityLog',
  SHORT_LINKS: 'shortLinks',
  NOTIFICATION_QUEUE: 'notificationQueue',
  PROJECT_INVITE_CONVERSATIONS: 'projectInviteConversations',
  SHARE_AUDIT_EVENTS: 'shareAuditEvents',

  // Notification system
  ACTIVE_USER_NOTIFICATIONS: 'activeUserNotifications',
  ACTIVE_ADMIN_NOTIFICATIONS: 'activeAdminNotifications',
  ADMIN_NOTIFICATION_HISTORY: 'adminNotificationHistory',
  PENDING_NOTIFICATIONS: 'pendingNotifications',

  // Feedback & Metadata
  FEEDBACK_SUBMISSIONS: 'feedbackSubmissions',
  FEEDBACK_ALIASES: 'feedbackAliases',
  FEEDBACK_DENYLIST: 'feedbackDenylist',
  SKILLS_BY_TAG: 'craft-skillsByTag',
  SYSTEM_DATA: '_systemData',
  APP_CONFIG: '_config',
  RECENT_DONATIONS: 'recentDonations',
  ARCHIVED_DONATIONS: 'archivedDonations',
} as const;

/**
 * USER PROFILE SUBCOLLECTIONS
 * Nested under userProfiles/{userId}/
 */
export const USER_SUBCOLLECTIONS = {
  PROFILE_SKILLS: 'profileCraftSkills',
  PRIVATE_DATA: 'privateData',
  USER_METADATA: 'userMetadata',
  USER_FOLLOWS: 'userFollows',
  USER_LIKES: 'userLikes',
  USER_DONATIONS: 'userPledgePayments',
  CHECKED_OUT_ITEMS: 'checkedOutItems',
  MENTION_HISTORY: 'mentionHistory',
  OPPORTUNITY_VOTES: 'auditionVotes',
} as const;

/**
 * PROJECT SUBCOLLECTIONS
 * Nested under allWorkProjects/{projectId}/
 */
export const PROJECT_SUBCOLLECTIONS = {
  PUBLIC_DATA: 'publicData',
  PROJECT_TALES: 'projectTales',
  PROJECT_TUNES: 'projectTunes',
  PROJECT_TELEVISION: 'projectTelevision',
  MEMBERS: 'members',
  FILES: 'files',
  CHAT_CHANNELS: 'guildChatChannels',
} as const;

/**
 * DEEPLY NESTED SUBCOLLECTIONS
 * Third level and beyond
 */
export const NESTED_SUBCOLLECTIONS = {
  // Content subcollections
  TALE_CHAPTERS: 'taleChapters',
  TUNE_SONGS: 'tuneTracks',
  TV_SHOWS: 'televisionEpisodes',

  // Communication
  CHANNEL_MESSAGES: 'guildChatMessages',
  CONVERSATION_MESSAGES: 'conversationMessages',
  INVITE_MESSAGES: 'inviteMessages',

  // SquareStreetz & Social
  SOCIAL_POSTS: 'socialPosts',
  ACTIVE_POSTS: 'activePosts',
  TRENDING_POSTS: 'trendingPosts',

  // Jobs & Opportunities
  APPLICATION_REPLIES: 'applicationReplies',
  SUBMITTED_REPLIES: 'submittedReplies',

  // User history
  FOLLOW_HISTORY: 'followHistory',
  FOLLOWED_USERS: 'followedUsers',
  LIKE_HISTORY: 'likeHistory',
  STREETZ_LIKES: 'squareStreetzLikes',

  // Skills & Feedback
  TAGGED_SKILLS: 'taggedCraftSkills',
  USER_SUGGESTIONS: 'userSuggestions',
} as const;

/**
 * SPECIAL DOCUMENT PATHS
 * Static document IDs for singleton documents
 */
export const SPECIAL_DOCS = {
  ADMIN_LIST: 'adminList',
  APP_CONFIG: 'app',
  FUTURE_PLANS: 'futurePlans',
  NOTIFICATION_SETTINGS: 'notificationSettings',
  PROFANITY_LIST: 'profanityList',
  RULES_AND_AGREEMENTS: 'rulesAndAgreements',
  SUMMARY: 'summary',
} as const;
