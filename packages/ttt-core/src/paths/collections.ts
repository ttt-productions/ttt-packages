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
  RESERVED_REALM_NAMES: 'reservedRealmNames',
  ACCOUNT_DELETION_REQUESTS: 'accountDeletionRequests',
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

  // Notification redesign — delivery ledger + unified fanout engine (Admin-SDK-only).
  NOTIFICATION_DELIVERIES: 'notificationDeliveries',
  NOTIFICATION_FANOUT_JOBS: 'notificationFanoutJobs',

  // Chat realtime sync / projection / command collections (Admin-SDK-only).
  CHAT_CHANNEL_AUTH_PROJECTIONS: 'chatChannelAuthProjections',
  CHAT_SCOPE_DEGRADED: 'chatScopeDegraded',
  CHAT_SYNC_EVENTS: 'chatSyncEvents',
  CHAT_SYNC_FANOUT_JOBS: 'chatSyncFanoutJobs',
  CHAT_MESSAGE_OUTBOX: 'chatMessageOutbox',
  CHAT_ADMIN_ACTION_COMMANDS: 'chatAdminActionCommands',
  CHAT_HISTORY_ANONYMIZATION_JOBS: 'chatHistoryAnonymizationJobs',

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

  // Trust & Safety — child-safety case spine (§A1b, §A2)
  CHILD_SAFETY_CASE_LIST: 'childSafetyCaseList',
  CHILD_SAFETY_CASES: 'childSafetyCases',
  CHILD_SAFETY_OWNING_ALIASES: 'childSafetyOwningAliases',
  CHILD_SAFETY_CORRELATIONS: 'childSafetyCorrelations',
  SAFETY_CASE_MERGE_JOBS: 'safetyCaseMergeJobs',

  // Trust & Safety — time-sensitive admin-tray "case needs work" pins (admin-readable
  // projection; the 5th notification-tray tab reads it, the Safety Case Console owns detail).
  ACTIVE_SAFETY_CASE_ALERTS: 'activeSafetyCaseAlerts',

  // Trust & Safety — holds + resource commands (§A3)
  SAFETY_HOLD_REFS: 'safetyHoldRefs',
  SAFETY_HOLD_RESOURCES: 'safetyHoldResources',
  SAFETY_RESOURCE_COMMANDS: 'safetyResourceCommands',

  // Trust & Safety — evidence + provenance (§A4, §A6)
  SAFETY_EVIDENCE_MANIFESTS: 'safetyEvidenceManifests',
  SAFETY_EVIDENCE_JOBS: 'safetyEvidenceJobs',
  EVENT_PROVENANCE: 'eventProvenance',

  // Trust & Safety — sagas + closure (§A5)
  QUARANTINE_SAGA_JOBS: 'quarantineSagaJobs',
  NCMEC_SUBMISSION_JOBS: 'ncmecSubmissionJobs',
  ACCOUNT_ACTION_COMMANDS: 'accountActionCommands',

  // Trust & Safety — SLA monitors + heartbeat (§A8)
  SAFETY_SLA_MONITORS: 'safetySlaMonitors',
  SAFETY_MONITOR_HEARTBEAT: 'safetyMonitorHeartbeat',

  // Trust & Safety — age attestation nonces (§A7)
  AGE_ATTESTATION_NONCES: 'ageAttestationNonces',

  // Trust & Safety — NCII / TAKE IT DOWN (§A11)
  NCII_ALLEGATIONS: 'nciiAllegations',
  TAKE_IT_DOWN_REQUESTS: 'takeItDownRequests',
  NCII_CASES: 'nciiCases',
  NCII_TEMPORARY_HOLDS: 'nciiTemporaryHolds',
  NCII_REMOVAL_JOBS: 'nciiRemovalJobs',
  // [H-01] durable operator-visible inventory of NCII-evidence objects RETAINED but never recorded
  // as evidence (orphan / oversized / spoof / unknown-reference). Never auto-deleted.
  NCII_RETAINED_EVIDENCE_INVENTORY: 'nciiRetainedEvidenceInventory',
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
  WORK_FILE_FOLDERS: 'workFileFolders',
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

  // Work-project file folders (S7): files nested under each folder.
  WORK_FILES: 'workFiles',

  // Communication — guild channel + invite messages are REALTIME-ONLY (chat Worker
  // Durable Object, never Firestore); only admin-support conversationMessages persist here.
  CONVERSATION_MESSAGES: 'conversationMessages',

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

  // Trust & Safety — report spine (§A1): the public, reporter-identity-free projection
  // is a deterministic child of the protected report root
  // (contentReports/{reportId}/publicProjection/{reportId}).
  REPORT_PUBLIC_PROJECTION: 'publicProjection',
  // Restricted reporter/requester PII subcollection ('private'), shared by the report
  // spine (contentReports/{reportId}/private/{snapshot,narrative}) and TAKE IT DOWN
  // (takeItDownRequests/{requestId}/private/requester). Admin-read-only / server-only.
  PRIVATE: 'private',

  // Chat degraded-scope causes (chatScopeDegraded/{scopeKey}/causes/{causeId}).
  CHAT_SCOPE_DEGRADED_CAUSES: 'causes',
  // Anonymization affected-chunk set (chatHistoryAnonymizationJobs/{jobId}/affectedChunks/{chunkOrdinal}).
  CHAT_ANONYMIZATION_AFFECTED_CHUNKS: 'affectedChunks',

  // Trust & Safety — child-safety correlation→case rows (childSafetyCorrelations/{key}/cases/{caseId}).
  CHILD_SAFETY_CORRELATION_CASES: 'cases',
  // Trust & Safety — child-safety case append-only detail (NEVER arrays).
  CHILD_SAFETY_SOURCE_SIGNALS: 'sourceSignals',
  CHILD_SAFETY_DECISIONS: 'decisions',
  CHILD_SAFETY_DECISION_VIEWS: 'views',
  CHILD_SAFETY_CASE_ACCOUNTS: 'accounts',
  CHILD_SAFETY_CASE_ACCOUNT_HISTORY: 'history',
  CHILD_SAFETY_NCMEC_SUBMISSIONS: 'ncmecSubmissions',
  CHILD_SAFETY_NCMEC_SUBMISSION_FILES: 'files',
  CHILD_SAFETY_LEGAL_PROCESS: 'legalProcess',

  // Trust & Safety — resource-command subcollections (§A3).
  SAFETY_RESOURCE_COMMAND_AUTHORIZED_REQUESTS: 'authorizedRequests',
  SAFETY_RESOURCE_COMMAND_BYPASS_REFS: 'bypassRefs',

  // Trust & Safety — evidence-job subcollections (§A4).
  SAFETY_EVIDENCE_JOB_ITEMS: 'items',
  SAFETY_EVIDENCE_JOB_DISPOSITION: 'disposition',

  // Trust & Safety — quarantine-saga subcollection (§A5).
  QUARANTINE_SAGA_RELATED_ASSETS: 'relatedAssets',

  // Trust & Safety — TAKE IT DOWN request subcollections (§A11). The 'private'
  // subcollection uses the shared generic `PRIVATE` constant above.
  TAKE_IT_DOWN_SUBMISSIONS: 'submissions',
  TAKE_IT_DOWN_VALIDITY_DECISIONS: 'validityDecisions',
  TAKE_IT_DOWN_ACTIONS: 'actions',
  TAKE_IT_DOWN_STATUS_PROJECTION: 'statusProjection',
  TAKE_IT_DOWN_EVIDENCE: 'evidence',

  // Trust & Safety — NCII case subcollections (§A11).
  NCII_CASE_ALLEGATION_LINKS: 'allegationLinks',
  NCII_CASE_REQUEST_LINKS: 'requestLinks',
  NCII_CASE_REMOVAL_ACTIONS: 'removalActions',
  NCII_CASE_BLOCKED_HASHES: 'blockedHashes',

  // Trust & Safety — NCII removal-job targets (§A11).
  NCII_REMOVAL_TARGETS: 'targets',
} as const;

/**
 * SPECIAL DOCUMENT PATHS
 * Static document IDs for singleton documents
 */
export const SPECIAL_DOCS = {
  ADMIN_LIST: 'adminList',
  APP_CONFIG: 'app',
  // Charter→full app-mode marker doc (_systemData/appMode) that recordAppModeFlip writes.
  APP_MODE: 'appMode',
  FUTURE_PLANS: 'futurePlans',
  NOTIFICATION_SETTINGS: 'notificationSettings',
  PROFANITY_LIST: 'profanityList',
  RESERVED_USERNAMES: 'reservedUsernames',
  BLOCKED_FRANCHISE_NAMES: 'blockedFranchiseNames',
  RULES_AND_AGREEMENTS: 'rulesAndAgreements',
  SUMMARY: 'summary',

  // Trust & Safety — singleton global SLA-monitor heartbeat (safetyMonitorHeartbeat/global).
  SAFETY_MONITOR_HEARTBEAT_GLOBAL: 'global',

  // Trust & Safety — _config singletons (§A7, §A11).
  AGE_POLICY: 'agePolicy',
  NCII_POLICY: 'nciiPolicy',
  PRIVILEGED_REVIEWER_SECURITY: 'privilegedReviewerSecurity',

  // Trust & Safety — fixed-id TAKE IT DOWN request subdocs (§A11).
  TAKE_IT_DOWN_REQUESTER: 'requester', // takeItDownRequests/{requestId}/private/requester
  TAKE_IT_DOWN_STATUS_CURRENT: 'current', // takeItDownRequests/{requestId}/statusProjection/current

  // Trust & Safety — fixed-id report-spine private subdocs (§A1).
  REPORT_SNAPSHOT: 'snapshot', // contentReports/{reportId}/private/snapshot
  REPORT_NARRATIVE: 'narrative', // contentReports/{reportId}/private/narrative
} as const;
