// Changing any of these values requires a database migration.

import type { WorkProjectType } from '../types/content.js';
import type { HallSubItemType } from '../doc-schemas/content.js';

export const COLLECTIONS = {
  USER_PROFILES: 'userProfiles',
  PUBLIC_USERS: 'publicUsers',
  ALL_WORK_PROJECTS: 'allWorkProjects',
  PUBLIC_WORK_PROJECTS: 'publicWorkProjects',
  WORK_REALMS: 'workRealms',

  SQUARE_STREETZ_FEED: 'squareStreetzFeed',
  THRESHOLD_ITEMS: 'thresholdItems',
  HALL_ITEMS: 'hallItems',
  HALL_CONTENT_CHANGE_REQUESTS: 'hallContentChangeRequests',
  COMMISSION_LISTINGS: 'commissionListings',
  AUDITION_BOARD: 'auditionBoard',
  FOLLOW_EDGES: 'followEdges',
  FOLLOW_COUNTERS: 'followCounters',

  RESERVED_DISPLAY_NAMES: 'reservedDisplayNames',
  RESERVED_REALM_NAMES: 'reservedRealmNames',
  ACCOUNT_DELETION_REQUESTS: 'accountDeletionRequests',
  CONTENT_REPORTS: 'contentReports',
  PENDING_MEDIA: 'pendingMedia',
  PENDING_MEDIA_ARCHIVE: 'pendingMediaArchive',
  MEDIA_ASSETS: 'mediaAssets',
  MEDIA_ACTIVATION_JOBS: 'mediaActivationJobs',
  MEDIA_COPY_INTENTS: 'mediaCopyIntents',
  PENDING_ADMIN_DISPATCHES: 'pendingAdminDispatches',
  ACTIVE_REPORT_GROUPS: 'activeReportGroups',
  CONTENT_VIOLATIONS: 'contentViolations',
  ADMIN_TASKS: 'adminTasks',
  SHORT_LINKS: 'shortLinks',
  GUILD_INVITE_CONVERSATIONS: 'guildInviteConversations',
  STAKE_SHARE_AUDIT_EVENTS: 'stakeShareAuditEvents',
  MODERATION_CASCADE_MANIFESTS: 'moderationCascadeManifests',
  AUDIT_EVENTS: 'auditEvents',

  ACTIVE_USER_NOTIFICATIONS: 'activeUserNotifications',
  ACTIVE_ADMIN_NOTIFICATIONS: 'activeAdminNotifications',
  ADMIN_NOTIFICATION_HISTORY: 'adminNotificationHistory',
  PENDING_NOTIFICATIONS: 'pendingNotifications',

  NOTIFICATION_DELIVERIES: 'notificationDeliveries',
  NOTIFICATION_FANOUT_JOBS: 'notificationFanoutJobs',
  NOTIFICATION_ARCHIVE_ALL_JOBS: 'notificationArchiveAllJobs',

  CHAT_CHANNEL_AUTH_PROJECTIONS: 'chatChannelAuthProjections',
  CHAT_SCOPE_DEGRADED: 'chatScopeDegraded',
  CHAT_SYNC_EVENTS: 'chatSyncEvents',
  CHAT_SYNC_FANOUT_JOBS: 'chatSyncFanoutJobs',
  CHAT_MESSAGE_OUTBOX: 'chatMessageOutbox',
  CHAT_ADMIN_ACTION_COMMANDS: 'chatAdminActionCommands',
  CHAT_HISTORY_ANONYMIZATION_JOBS: 'chatHistoryAnonymizationJobs',
  CHAT_PARKED_DELIVERIES: 'chatParkedDeliveries',

  SQUARE_ANNOUNCEMENT_JOBS: 'squareAnnouncementJobs',

  FEEDBACK_SUBMISSIONS: 'feedbackSubmissions',
  CRAFT_SKILLS_BY_TAG: 'craftSkillsByTag',
  SYSTEM_DATA: '_systemData',
  APP_CONFIG: '_appConfig',
  SERVER_DATA: '_serverData',

  PLEDGE_PAYMENTS: 'pledgePayments',
  PLEDGE_PAYMENT_PROVIDER_REFS: 'pledgePaymentProviderRefs',
  PROCESSED_STRIPE_EVENTS: 'processedStripeEvents',
  PLEDGE_PAYMENT_LEDGER_EVENTS: 'pledgePaymentLedgerEvents',
  PAYMENT_WEBHOOK_QUARANTINE: 'paymentWebhookQuarantine',
  PLEDGE_PAYMENT_TOTALS: 'pledgePaymentTotals',
  PLEDGE_REFUND_REQUESTS: 'pledgeRefundRequests',

  CHILD_SAFETY_CASE_LIST: 'childSafetyCaseList',
  CHILD_SAFETY_CASES: 'childSafetyCases',
  CHILD_SAFETY_OWNING_ALIASES: 'childSafetyOwningAliases',

  ACTIVE_SAFETY_CASE_ALERTS: 'activeSafetyCaseAlerts',

  SAFETY_HOLD_REFS: 'safetyHoldRefs',
  SAFETY_HOLD_RESOURCES: 'safetyHoldResources',
  SAFETY_RESOURCE_COMMANDS: 'safetyResourceCommands',

  SAFETY_EVIDENCE_MANIFESTS: 'safetyEvidenceManifests',
  SAFETY_EVIDENCE_JOBS: 'safetyEvidenceJobs',
  EVENT_PROVENANCE: 'eventProvenance',

  QUARANTINE_SAGA_JOBS: 'quarantineSagaJobs',
  NCMEC_SUBMISSION_JOBS: 'ncmecSubmissionJobs',
  ACCOUNT_ACTION_COMMANDS: 'accountActionCommands',

  SAFETY_SLA_MONITORS: 'safetySlaMonitors',
  SAFETY_MONITOR_HEARTBEAT: 'safetyMonitorHeartbeat',

  AGE_ATTESTATION_NONCES: 'ageAttestationNonces',

  NCII_ALLEGATIONS: 'nciiAllegations',
  TAKE_IT_DOWN_REQUESTS: 'takeItDownRequests',
  NCII_CASES: 'nciiCases',
  NCII_TEMPORARY_HOLDS: 'nciiTemporaryHolds',
  NCII_REMOVAL_JOBS: 'nciiRemovalJobs',
  NCII_RETAINED_EVIDENCE_INVENTORY: 'nciiRetainedEvidenceInventory',
  NCII_INVENTORY_DEAD_LETTER: 'nciiInventoryDeadLetter',

  STATUS_RECONCILE_QUEUE: 'statusReconcileQueue',
  HALL_CONTENT_CHANGE_REQUEST_LOCKS: 'hallContentChangeRequestLocks',
  ADMIN_DISPATCH_APPEAL_LOCKS: 'adminDispatchAppealLocks',

  OPERATOR_STEP_UP: 'operatorStepUp',

  SWEEP_STATE: 'sweepState',

  PUBLIC_DOCUMENTS: 'publicDocuments',
  PUBLIC_DOCUMENT_DRAFTS: 'publicDocumentDrafts',
  PUBLIC_DOCUMENT_RELEASES: 'publicDocumentReleases',
} as const;

export const USER_SUBCOLLECTIONS = {
  PROFILE_CRAFT_SKILLS: 'profileCraftSkills',
  PRIVATE_DATA: 'privateData',
  USER_LIKES: 'userLikes',
  MENTION_HISTORY: 'mentionHistory',
  AUDITION_VOTES: 'auditionVotes',
  NOTIFICATION_HISTORY: 'notificationHistory',
} as const;

export const WORK_PROJECT_SUBCOLLECTIONS = {
  WORK_PROJECT_TALES: 'workProjectTales',
  WORK_PROJECT_TUNES: 'workProjectTunes',
  WORK_PROJECT_TELEVISION: 'workProjectTelevision',
  GUILDMATE_USERS: 'guildmateUsers',
  PUBLIC_GUILDMATE_USERS: 'publicGuildmateUsers',
  WORK_FILE_FOLDERS: 'workFileFolders',
  GUILD_CHAT_CHANNELS: 'guildChatChannels',
  HALL_SUBMISSION_RESERVATION: 'hallSubmissionReservation',
} as const;

export const WORK_REALM_SUBCOLLECTIONS = {
  REALM_FILE_FOLDERS: 'realmFileFolders',
} as const;

// Map a work type through HALL_ITEM_SUBCOLLECTION_BY_WORK_TYPE: `workProjectType.toLowerCase()`
// names a collection that does not exist.
export const HALL_ITEM_SUBCOLLECTIONS = {
  TALES: 'hallItemTales',
  TUNES: 'hallItemTunes',
  TELEVISION: 'hallItemTelevision',
} as const;

export type HallItemSubcollection =
  (typeof HALL_ITEM_SUBCOLLECTIONS)[keyof typeof HALL_ITEM_SUBCOLLECTIONS];

export const HALL_ITEM_SUBCOLLECTION_BY_WORK_TYPE: Record<WorkProjectType, HallItemSubcollection> =
  {
    Tales: HALL_ITEM_SUBCOLLECTIONS.TALES,
    Tunes: HALL_ITEM_SUBCOLLECTIONS.TUNES,
    Television: HALL_ITEM_SUBCOLLECTIONS.TELEVISION,
  };

// Typed against HallSubItemType, not read off its schema, so this paths module never loads zod at
// runtime.
export const HALL_SUB_ITEM_TYPE_BY_WORK_TYPE: Record<WorkProjectType, HallSubItemType> = {
  Tales: 'chapter',
  Tunes: 'track',
  Television: 'episode',
};

export const NESTED_SUBCOLLECTIONS = {
  TALE_CHAPTERS: 'taleChapters',
  TUNE_TRACKS: 'tuneTracks',
  TELEVISION_EPISODES: 'televisionEpisodes',

  WORK_FILES: 'workFiles',

  CONVERSATION_MESSAGES: 'conversationMessages',

  CONVERSATION_FILES: 'conversationFiles',

  DISPATCH_READ_MARKERS: 'dispatchReadMarkers',

  SOCIAL_POSTS: 'socialPosts',
  ACTIVE_POSTS: 'activePosts',
  TRENDING_POSTS: 'trendingPosts',

  COMMISSION_PROPOSALS: 'commissionProposals',
  AUDITION_ENTRIES: 'auditionEntries',

  LIKE_HISTORY: 'likeHistory',
  SQUARE_STREETZ_LIKES: 'squareStreetzLikes',

  TAGGED_CRAFT_SKILLS: 'taggedCraftSkills',
  USER_SUGGESTIONS: 'userSuggestions',

  CHANGED_DOCS: 'changedDocs',

  REPORT_PUBLIC_PROJECTION: 'publicProjection',
  REPORT_GROUP_COUNTED_REPORTS: 'reportGroupCountedReports',
  PRIVATE: 'privateDetails',

  CHAT_SCOPE_DEGRADED_CAUSES: 'chatScopeDegradedCauses',
  CHAT_ANONYMIZATION_AFFECTED_CHUNKS: 'affectedChunks',

  CHILD_SAFETY_SOURCE_SIGNALS: 'sourceSignals',
  CHILD_SAFETY_DECISIONS: 'childSafetyDecisions',
  CHILD_SAFETY_DECISION_VIEWS: 'childSafetyDecisionViews',
  CHILD_SAFETY_CASE_ACCOUNTS: 'childSafetyCaseAccounts',
  CHILD_SAFETY_CASE_ACCOUNT_HISTORY: 'childSafetyCaseAccountHistory',
  CHILD_SAFETY_CASE_CROSSOVER_ITEMS: 'childSafetyCaseCrossoverItems',
  CHILD_SAFETY_NCMEC_SUBMISSIONS: 'ncmecSubmissions',
  CHILD_SAFETY_NCMEC_SUBMISSION_FILES: 'ncmecSubmissionFiles',
  CHILD_SAFETY_LEGAL_PROCESS: 'legalProcess',
  NCMEC_PORTAL_RECEIPT_ARTIFACTS: 'portalReceiptArtifacts',
  NCMEC_PORTAL_CORRECTIONS: 'ncmecPortalCorrections',
  NCMEC_COMPLETION_PROOF: 'ncmecCompletionProof',

  SAFETY_RESOURCE_COMMAND_AUTHORIZED_REQUESTS: 'authorizedRequests',
  SAFETY_RESOURCE_COMMAND_BYPASS_REFS: 'bypassRefs',

  SAFETY_EVIDENCE_JOB_ITEMS: 'safetyEvidenceJobItems',
  SAFETY_EVIDENCE_JOB_DISPOSITION: 'safetyEvidenceJobDisposition',

  QUARANTINE_SAGA_RELATED_ASSETS: 'relatedAssets',

  TAKE_IT_DOWN_SUBMISSIONS: 'takeItDownSubmissions',
  TAKE_IT_DOWN_VALIDITY_DECISIONS: 'validityDecisions',
  TAKE_IT_DOWN_ACTIONS: 'takeItDownActions',
  TAKE_IT_DOWN_EVIDENCE: 'takeItDownEvidence',
  TAKE_IT_DOWN_EVIDENCE_DISPOSITION: 'takeItDownEvidenceDisposition',
  TAKE_IT_DOWN_VALIDITY_RATIONALE: 'takeItDownValidityRationale',

  NCII_CASE_ALLEGATION_LINKS: 'allegationLinks',
  NCII_CASE_REQUEST_LINKS: 'requestLinks',
  NCII_CASE_REMOVAL_ACTIONS: 'removalActions',
  NCII_CASE_BLOCKED_HASHES: 'blockedHashes',
  NCII_CASE_CLOSURE_EVENTS: 'closureEvents',

  NCII_REMOVAL_TARGETS: 'nciiRemovalTargets',

  FEEDBACK_ALIASES: 'feedbackAliases',
  FEEDBACK_DENYLIST: 'feedbackDenylist',

  PUBLIC_DOCUMENT_VERSIONS: 'publicDocumentVersions',
} as const;

export const SPECIAL_DOCS = {
  ADMIN_LIST: 'adminList',
  APP_CONFIG: 'app',
  APP_MODE: 'appMode',
  SYSTEM_VIDEO_SLOTS: 'systemVideoSlots',
  SYSTEM_UID_SLOTS: 'systemUidSlots',
  FUTURE_PLANS: 'futurePlans',
  HALL_LIBRARY_PREFERENCES: 'hallLibraryPreferences',
  PROFANITY_LIST: 'profanityList',
  RESERVED_USERNAMES: 'reservedUsernames',
  BLOCKED_FRANCHISE_NAMES: 'blockedFranchiseNames',
  RULES_AND_AGREEMENTS: 'rulesAndAgreements',
  TERMS_PAGE: 'termsOfService',
  PRIVACY_PAGE: 'privacyPolicy',
  TAKE_IT_DOWN_PAGE_COPY: 'takeItDownPageCopy',
  DMCA_POLICY: 'dmcaPolicy',
  SUMMARY: 'summary',

  SAFETY_MONITOR_HEARTBEAT_GLOBAL: 'global',

  AGE_POLICY: 'agePolicy',
  NCII_POLICY: 'nciiPolicy',
  PRIVILEGED_REVIEWER_SECURITY: 'privilegedReviewerSecurity',

  FEEDBACK_LISTS: 'feedbackLists',

  TAKE_IT_DOWN_REQUESTER: 'requester',

  RECORD: 'record',

  HALL_SUBMISSION_RESERVATION: 'reservation',

  REPORT_SNAPSHOT: 'snapshot',
  REPORT_NARRATIVE: 'narrative',
  REPORT_NARRATIVE_ESCALATION: 'narrativeEscalation',
} as const;
