// Firestore collection name constants — canonical source of truth
// Changes to these values require database migration.

/**
 * TOP-LEVEL COLLECTIONS
 */
export const COLLECTIONS = {
  // Core entities
  USER_PROFILES: 'userProfiles',
  ALL_PROJECTS: 'allProjects',
  STORY_UNIVERSES: 'storyUniverses',

  // Content & Social
  STREETZ_FEED: 'streetzFeed',
  CONTENT_LIBRARY: 'contentLibrary',
  JOB_LISTINGS: 'jobListings',
  OPPORTUNITY_BOARD: 'opportunityBoard',

  // System & Utility
  RESERVED_DISPLAY_NAMES: 'reservedDisplayNames',
  DONATIONS_SUMMARY: 'donationsSummary',
  CONTENT_REPORTS: 'contentReports',
  PENDING_MEDIA: 'pendingMedia',
  PENDING_ADMIN_MESSAGES: 'pendingAdminMessages',
  ACTIVE_REPORT_GROUPS: 'activeReportGroups',
  CONTENT_VIOLATIONS: 'contentViolations',
  ADMIN_TASKS: 'adminTasks',
  ADMIN_ACTIVITY_LOG: 'adminActivityLog',
  SHORT_LINKS: 'shortLinks',
  NOTIFICATION_QUEUE: 'notificationQueue',
  PROJECT_INVITE_CONVERSATIONS: 'projectInviteConversations',

  // Notification system
  ACTIVE_USER_NOTIFICATIONS: 'activeUserNotifications',
  ACTIVE_ADMIN_NOTIFICATIONS: 'activeAdminNotifications',
  ADMIN_NOTIFICATION_HISTORY: 'adminNotificationHistory',
  PENDING_NOTIFICATIONS: 'pendingNotifications',

  // Feedback & Metadata
  FEEDBACK_SUBMISSIONS: 'feedbackSubmissions',
  FEEDBACK_ALIASES: 'feedbackAliases',
  FEEDBACK_DENYLIST: 'feedbackDenylist',
  SKILLS_BY_TAG: 'skillsByTag',
  SYSTEM_DATA: 'systemData',
  RECENT_DONATIONS: 'recentDonations',
  ARCHIVED_DONATIONS: 'archivedDonations',
} as const;

/**
 * USER PROFILE SUBCOLLECTIONS
 * Nested under userProfiles/{userId}/
 */
export const USER_SUBCOLLECTIONS = {
  PROFILE_SKILLS: 'profileSkills',
  PRIVATE_DATA: 'privateData',
  USER_METADATA: 'userMetadata',
  USER_FOLLOWS: 'userFollows',
  USER_LIKES: 'userLikes',
  USER_DONATIONS: 'userDonations',
  CHECKED_OUT_ITEMS: 'checkedOutItems',
  MENTION_HISTORY: 'mentionHistory',
  OPPORTUNITY_VOTES: 'opportunityVotes',
} as const;

/**
 * PROJECT SUBCOLLECTIONS
 * Nested under allProjects/{projectId}/
 */
export const PROJECT_SUBCOLLECTIONS = {
  PUBLIC_DATA: 'publicData',
  PROJECT_POSTS: 'projectPosts',
  PROJECT_TALES: 'projectTales',
  PROJECT_TUNES: 'projectTunes',
  PROJECT_TELEVISION: 'projectTelevision',
  SHARE_HISTORY: 'shareHistory',
  CHAT_CHANNELS: 'chatChannels',
} as const;

/**
 * DEEPLY NESTED SUBCOLLECTIONS
 * Third level and beyond
 */
export const NESTED_SUBCOLLECTIONS = {
  // Content subcollections
  TALE_CHAPTERS: 'taleChapters',
  TUNE_SONGS: 'tuneSongs',
  TV_SHOWS: 'tvShows',

  // Communication
  CHANNEL_MESSAGES: 'channelMessages',
  CONVERSATION_MESSAGES: 'conversationMessages',
  INVITE_MESSAGES: 'inviteMessages',

  // Streetz & Social
  SOCIAL_POSTS: 'socialPosts',
  ACTIVE_POSTS: 'activePosts',
  TRENDING_POSTS: 'trendingPosts',

  // Library
  LIBRARY_ITEMS: 'libraryItems',
  PENDING_ITEMS: 'pendingItems',
  PUBLISHED_ITEMS: 'publishedItems',

  // Jobs & Opportunities
  APPLICATION_REPLIES: 'applicationReplies',
  SUBMITTED_REPLIES: 'submittedReplies',

  // User history
  FOLLOW_HISTORY: 'followHistory',
  FOLLOWED_USERS: 'followedUsers',
  LIKE_HISTORY: 'likeHistory',
  STREETZ_LIKES: 'streetzLikes',

  // Skills & Feedback
  TAGGED_SKILLS: 'taggedSkills',
  USER_SUGGESTIONS: 'userSuggestions',
} as const;

/**
 * SPECIAL DOCUMENT PATHS
 * Static document IDs for singleton documents
 */
export const SPECIAL_DOCS = {
  ADMIN_LIST: 'adminList',
  FUTURE_PLANS: 'futurePlans',
  RULES_AND_AGREEMENTS: 'rulesAndAgreements',
  SUMMARY: 'summary',
  NOTIFICATION_SETTINGS: 'notificationSettings',
} as const;
