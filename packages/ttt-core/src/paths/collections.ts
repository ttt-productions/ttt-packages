// Firestore collection name constants — canonical source of truth
// Changes to these values require database migration.

/**
 * TOP-LEVEL COLLECTIONS
 */
export const COLLECTIONS = {
  // Core entities
  USER_PROFILES: 'userProfiles',
  PUBLIC_USERS: 'publicUsers',
  ALL_WORK_PROJECTS: 'allWorkProjects',
  PUBLIC_WORK_PROJECTS: 'publicWorkProjects',
  WORK_REALMS: 'workRealms',

  // Content & Social
  SQUARE_STREETZ_FEED: 'squareStreetzFeed',
  THRESHOLD_ITEMS: 'thresholdItems',
  HALL_ITEMS: 'hallItems',
  COMMISSION_LISTINGS: 'commissionListings',
  AUDITION_BOARD: 'auditionBoard',
  FOLLOW_EDGES: 'followEdges',
  FOLLOW_COUNTERS: 'followCounters',

  // System & Utility
  RESERVED_DISPLAY_NAMES: 'reservedDisplayNames',
  CONTENT_REPORTS: 'contentReports',
  PENDING_MEDIA: 'pendingMedia',
  PENDING_MEDIA_ARCHIVE: 'pendingMediaArchive',
  MEDIA_ASSETS: 'mediaAssets',
  MEDIA_ACTIVATION_JOBS: 'mediaActivationJobs',
  PENDING_ADMIN_DISPATCHES: 'pendingAdminDispatches',
  ACTIVE_REPORT_GROUPS: 'activeReportGroups',
  CONTENT_VIOLATIONS: 'contentViolations',
  ADMIN_TASKS: 'adminTasks',
  ADMIN_ACTIVITY_LOG: 'adminActivityLog',
  SHORT_LINKS: 'shortLinks',
  GUILD_INVITE_CONVERSATIONS: 'guildInviteConversations',
  STAKE_SHARE_AUDIT_EVENTS: 'stakeShareAuditEvents',
  MODERATION_CASCADE_MANIFESTS: 'moderationCascadeManifests',

  // Notification system
  ACTIVE_USER_NOTIFICATIONS: 'activeUserNotifications',
  ACTIVE_ADMIN_NOTIFICATIONS: 'activeAdminNotifications',
  ADMIN_NOTIFICATION_HISTORY: 'adminNotificationHistory',
  PENDING_NOTIFICATIONS: 'pendingNotifications',
  // Cloud-Functions-only fan-out job queue (admin SDK writes; no client access).
  FOLLOWER_RELEASE_JOBS: 'followerReleaseJobs',

  // Feedback & Metadata
  FEEDBACK_SUBMISSIONS: 'feedbackSubmissions',
  FEEDBACK_ALIASES: 'feedbackAliases',
  FEEDBACK_DENYLIST: 'feedbackDenylist',
  CRAFT_SKILLS_BY_TAG: 'craftSkillsByTag',
  SYSTEM_DATA: '_systemData',
  APP_CONFIG: '_config',

  // Payments & pledge ledger
  PLEDGE_PAYMENTS: 'pledgePayments',
  PLEDGE_PAYMENT_PROVIDER_REFS: 'pledgePaymentProviderRefs',
  PROCESSED_STRIPE_EVENTS: 'processedStripeEvents',
  PLEDGE_PAYMENT_LEDGER_EVENTS: 'pledgePaymentLedgerEvents',
  PAYMENT_WEBHOOK_QUARANTINE: 'paymentWebhookQuarantine',
} as const;

/**
 * USER PROFILE SUBCOLLECTIONS
 * Nested under userProfiles/{userId}/
 */
export const USER_SUBCOLLECTIONS = {
  PROFILE_CRAFT_SKILLS: 'profileCraftSkills',
  PRIVATE_DATA: 'privateData',
  USER_METADATA: 'userMetadata',
  USER_LIKES: 'userLikes',
  CHECKED_OUT_ITEMS: 'checkedOutItems',
  MENTION_HISTORY: 'mentionHistory',
  AUDITION_VOTES: 'auditionVotes',
} as const;

/**
 * WORKPROJECT SUBCOLLECTIONS
 * Nested under allWorkProjects/{workProjectId}/
 */
export const WORK_PROJECT_SUBCOLLECTIONS = {
  WORK_PROJECT_TALES: 'workProjectTales',
  WORK_PROJECT_TUNES: 'workProjectTunes',
  WORK_PROJECT_TELEVISION: 'workProjectTelevision',
  GUILDMATE_USERS: 'guildmateUsers',
  PUBLIC_GUILDMATE_USERS: 'publicGuildmateUsers',
  WORK_ASSETS: 'workAssets',
  GUILD_CHAT_CHANNELS: 'guildChatChannels',
} as const;

/**
 * DEEPLY NESTED SUBCOLLECTIONS
 * Third level and beyond
 */
export const NESTED_SUBCOLLECTIONS = {
  // Content subcollections
  TALE_CHAPTERS: 'taleChapters',
  TUNE_TRACKS: 'tuneTracks',
  TELEVISION_EPISODES: 'televisionEpisodes',

  // Communication
  GUILD_CHAT_MESSAGES: 'guildChatMessages',
  CONVERSATION_MESSAGES: 'conversationMessages',
  INVITE_MESSAGES: 'inviteMessages',

  // SquareStreetz & Social
  SOCIAL_POSTS: 'socialPosts',
  ACTIVE_POSTS: 'activePosts',
  TRENDING_POSTS: 'trendingPosts',

  // Commissions & Auditions
  COMMISSION_PROPOSALS: 'commissionProposals',
  AUDITION_ENTRIES: 'auditionEntries',

  // User history
  LIKE_HISTORY: 'likeHistory',
  SQUARE_STREETZ_LIKES: 'squareStreetzLikes',

  // Craft Skills & Feedback
  TAGGED_CRAFT_SKILLS: 'taggedCraftSkills',
  USER_SUGGESTIONS: 'userSuggestions',

  // Moderation
  CHANGED_DOCS: 'changedDocs',
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
  RESERVED_USERNAMES: 'reservedUsernames',
  RULES_AND_AGREEMENTS: 'rulesAndAgreements',
  SUMMARY: 'summary',
} as const;
