// Firestore collection registry — the single, authoritative binding from each Firestore
// collection/subcollection path template to its document Zod schema. This is the input to
// the schema-doc generator and the drift-check, and its completeness is CI-enforced
// (registry.test.ts) against the COLLECTIONS / *_SUBCOLLECTIONS name constants, so a new
// collection cannot be added without either a schema or an explicit PENDING entry.
//
// Path templates reuse the segment names from ../paths/collections.ts (and the shapes the
// path-builders produce). `{placeholder}` segments are document/parent IDs.

import type { z } from 'zod';
import {
  FullUserSchema,
  UserPrivateDataSchema,
  CraftSkillSchema,
  CraftSkillReferenceSchema,
} from './user.js';
import { PublicUserSchema } from './publicUser.js';
import {
  FullWorkProjectSchema,
  PublicWorkProjectSchema,
  WorkRealmSchema,
  GuildmateUserSchema,
  PublicGuildmateUserSchema,
  WorkAssetSchema,
} from './work-project.js';
import {
  FullTaleSchema,
  FullChapterSchema,
  FullTuneSchema,
  FullTuneTrackSchema,
  FullTelevisionSchema,
  FullTelevisionEpisodeSchema,
  ThresholdItemSchema,
  PublishedHallItemSchema,
  FuturePlansDocumentSchema,
  RulesAndAgreementsSchema,
} from './content.js';
import {
  SquareStreetzPostSchema,
  MentionHistoryDocumentSchema,
  FollowEdgeSchema,
  FollowCounterSchema,
  SquareStreetzLikeSchema,
  TrendingPostsSchema,
} from './social.js';
import {
  PledgePaymentSchema,
  PledgePaymentProviderRefSchema,
  ProcessedStripeEventSchema,
  PledgePaymentLedgerEventSchema,
  PaymentWebhookQuarantineSchema,
} from './payments.js';
import {
  FullCommissionListingSchema,
  CommissionProposalSchema,
  AuditionSchema,
  AuditionEntrySchema,
  UserAuditionVoteSchema,
} from './commissions.js';
import {
  GuildChatChannelSchema,
  GuildInviteConversationSchema,
  AdminDispatchSchema,
  ChatMessageV1Schema,
} from './messaging.js';
import { AppConfigSchema, AdminListSchema, ProfanityListSchema, ReservedUsernamesSchema } from './system.js';
import {
  ContentViolationSchema,
  ModerationCascadeManifestSchema,
  ModerationCascadeChangedDocSchema,
} from './moderation.js';
import {
  AdminTaskDocSchema,
  ReportSchema,
  ReportGroupSchema,
  ActivityLogEntrySchema,
} from './report-docs.js';
import { TTTAuditEventSchema } from './audit.js';
import {
  NotificationDocSchema,
  NotificationHistoryDocSchema,
  PendingNotificationSchema,
  FollowerReleaseJobSchema,
  NotificationBroadcastJobSchema,
} from './notifications.js';
import { PendingMediaSchema, ArchivedPendingMediaSchema } from '../media/pending-media.js';
import { MediaAssetSchema } from './media-assets.js';
import {
  ReservedDisplayNameSchema,
  StakeShareAuditEventSchema,
  ShortLinkSchema,
  FeedbackAliasSchema,
  UserSuggestionSchema,
} from './operational.js';

export const COLLECTION_SCHEMAS = {
  // ===== Users =====
  'userProfiles/{userId}': FullUserSchema,
  'userProfiles/{userId}/privateData/{userId}': UserPrivateDataSchema,
  'userProfiles/{userId}/profileCraftSkills/{craftSkillId}': CraftSkillSchema,
  'userProfiles/{userId}/auditionVotes/{auditionId}': UserAuditionVoteSchema,
  'userProfiles/{userId}/mentionHistory/{docId}': MentionHistoryDocumentSchema,
  'userProfiles/{userId}/notificationHistory/{notificationId}': NotificationHistoryDocSchema,
  'userProfiles/{userId}/userLikes/likeHistory/squareStreetzLikes/{postId}': SquareStreetzLikeSchema,
  'publicUsers/{uid}': PublicUserSchema,

  // ===== Work / Realm / Guild =====
  'allWorkProjects/{workProjectId}': FullWorkProjectSchema,
  'allWorkProjects/{workProjectId}/guildmateUsers/{uid}': GuildmateUserSchema,
  'allWorkProjects/{workProjectId}/publicGuildmateUsers/{uid}': PublicGuildmateUserSchema,
  'allWorkProjects/{workProjectId}/workAssets/{workAssetId}': WorkAssetSchema,
  'allWorkProjects/{workProjectId}/workProjectTales/{taleId}': FullTaleSchema,
  'allWorkProjects/{workProjectId}/workProjectTales/{taleId}/taleChapters/{chapterId}': FullChapterSchema,
  'allWorkProjects/{workProjectId}/workProjectTunes/{tuneId}': FullTuneSchema,
  'allWorkProjects/{workProjectId}/workProjectTunes/{tuneId}/tuneTracks/{trackId}': FullTuneTrackSchema,
  'allWorkProjects/{workProjectId}/workProjectTelevision/{televisionId}': FullTelevisionSchema,
  'allWorkProjects/{workProjectId}/workProjectTelevision/{televisionId}/televisionEpisodes/{episodeId}': FullTelevisionEpisodeSchema,
  'allWorkProjects/{workProjectId}/guildChatChannels/{guildChatChannelId}': GuildChatChannelSchema,
  'allWorkProjects/{workProjectId}/guildChatChannels/{guildChatChannelId}/guildChatMessages/{guildChatMessageId}': ChatMessageV1Schema,
  'publicWorkProjects/{workProjectId}': PublicWorkProjectSchema,
  'workRealms/{workRealmId}': WorkRealmSchema,
  'guildInviteConversations/{guildInviteId}': GuildInviteConversationSchema,
  'guildInviteConversations/{guildInviteId}/inviteMessages/{guildInviteMessageId}': ChatMessageV1Schema,

  // ===== Square / Social =====
  'squareStreetzFeed/activePosts/socialPosts/{postId}': SquareStreetzPostSchema,
  'squareStreetzFeed/trendingPosts': TrendingPostsSchema,
  'followEdges/{followEdgeId}': FollowEdgeSchema,
  'followCounters/{followCounterId}': FollowCounterSchema,

  // ===== Payments / pledge ledger =====
  'pledgePayments/{pledgePaymentId}': PledgePaymentSchema,
  'pledgePaymentProviderRefs/{pledgePaymentId}': PledgePaymentProviderRefSchema,
  'processedStripeEvents/{stripeEventId}': ProcessedStripeEventSchema,
  'pledgePaymentLedgerEvents/{ledgerId}': PledgePaymentLedgerEventSchema,
  'paymentWebhookQuarantine/{stripeEventId}': PaymentWebhookQuarantineSchema,

  // ===== Threshold / Hall =====
  'thresholdItems/{thresholdItemId}': ThresholdItemSchema,
  'hallItems/{hallItemId}': PublishedHallItemSchema,

  // ===== Commission / Audition =====
  'commissionListings/{commissionListingId}': FullCommissionListingSchema,
  'commissionListings/{commissionListingId}/commissionProposals/{commissionProposalId}': CommissionProposalSchema,
  'auditionBoard/{auditionId}': AuditionSchema,
  'auditionBoard/{auditionId}/auditionEntries/{auditionEntryId}': AuditionEntrySchema,

  // ===== Moderation / Reports / Admin =====
  'contentReports/{reportId}': ReportSchema,
  'activeReportGroups/{groupKey}': ReportGroupSchema,
  'adminTasks/{taskId}': AdminTaskDocSchema,
  'adminActivityLog/{logId}': ActivityLogEntrySchema,
  'contentViolations/{violationId}': ContentViolationSchema,
  'moderationCascadeManifests/{cascadeId}': ModerationCascadeManifestSchema,
  'moderationCascadeManifests/{cascadeId}/changedDocs/{changedDocId}': ModerationCascadeChangedDocSchema,
  'auditEvents/{eventId}': TTTAuditEventSchema,
  'stakeShareAuditEvents/{eventId}': StakeShareAuditEventSchema,
  'pendingAdminDispatches/{adminDispatchId}': AdminDispatchSchema,
  'pendingAdminDispatches/{adminDispatchId}/conversationMessages/{adminDispatchMessageId}': ChatMessageV1Schema,

  // ===== Media pipeline =====
  'pendingMedia/{pendingMediaId}': PendingMediaSchema,
  'pendingMediaArchive/{pendingMediaId}': ArchivedPendingMediaSchema,
  'mediaAssets/{mediaAssetId}': MediaAssetSchema,

  // ===== Notifications =====
  'activeUserNotifications/{notificationId}': NotificationDocSchema,
  'activeAdminNotifications/{notificationId}': NotificationDocSchema,
  'adminNotificationHistory/{notificationId}': NotificationHistoryDocSchema,
  'pendingNotifications/{notificationId}': PendingNotificationSchema,
  'followerReleaseJobs/{jobId}': FollowerReleaseJobSchema,
  'notificationBroadcastJobs/{jobId}': NotificationBroadcastJobSchema,

  // ===== Craft skills index =====
  'craftSkillsByTag/{tag}/taggedCraftSkills/{compositeId}': CraftSkillReferenceSchema,

  // ===== Operational / utility =====
  'reservedDisplayNames/{displayNameUppercase}': ReservedDisplayNameSchema,
  'shortLinks/{shortId}': ShortLinkSchema,
  'feedbackAliases/{aliasId}': FeedbackAliasSchema,
  'feedbackSubmissions/{feedbackType}/userSuggestions/{suggestionId}': UserSuggestionSchema,

  // ===== _config singletons =====
  '_config/app': AppConfigSchema,
  '_config/futurePlans': FuturePlansDocumentSchema,
  '_config/rulesAndAgreements': RulesAndAgreementsSchema,

  // ===== _systemData singletons =====
  '_systemData/adminList': AdminListSchema,
  '_systemData/profanityList': ProfanityListSchema,
  '_systemData/reservedUsernames': ReservedUsernamesSchema,
} as const satisfies Record<string, z.ZodTypeAny>;

export type RegisteredCollectionPath = keyof typeof COLLECTION_SCHEMAS;

/**
 * Doc-id field annotation: for the listed bindings, the named body field equals the
 * Firestore document id and is injected at READ time (`{ ...doc.data(), <field>: doc.id }`),
 * never persisted — the write callables store the body via `Omit<…, '<field>'>`. The bound
 * schema models the (correct) consumer/read shape, where the field is required, so a raw
 * stored doc is "missing" it. The drift-check injects `{ [field]: doc.id, ...data }` before
 * validating, generalizing the one-off `AdminTaskDocSchema` stored-shape workaround into a
 * single mechanism so real-callable drift-checks don't false-flag every doc-id collection.
 * The schema-doc generator ignores this map. Keys are compiler-checked against the registry.
 */
export const COLLECTION_DOC_ID_FIELDS = {
  'allWorkProjects/{workProjectId}/workProjectTales/{taleId}': 'uid',
  'allWorkProjects/{workProjectId}/workProjectTales/{taleId}/taleChapters/{chapterId}': 'uid',
  'allWorkProjects/{workProjectId}/workProjectTunes/{tuneId}': 'uid',
  'allWorkProjects/{workProjectId}/workProjectTunes/{tuneId}/tuneTracks/{trackId}': 'uid',
  'allWorkProjects/{workProjectId}/workProjectTelevision/{televisionId}': 'uid',
  'allWorkProjects/{workProjectId}/workProjectTelevision/{televisionId}/televisionEpisodes/{episodeId}': 'uid',
  'allWorkProjects/{workProjectId}/guildChatChannels/{guildChatChannelId}': 'guildChatChannelId',
  'activeUserNotifications/{notificationId}': 'id',
  'activeAdminNotifications/{notificationId}': 'id',
  'adminNotificationHistory/{notificationId}': 'id',
  'userProfiles/{userId}/notificationHistory/{notificationId}': 'id',
  'pendingNotifications/{notificationId}': 'id',
} as const satisfies Partial<Record<RegisteredCollectionPath, string>>;

/**
 * Collections that exist (in COLLECTIONS / *_SUBCOLLECTIONS or firestore.rules) but are
 * intentionally NOT bound to a schema, each with a reason. Listed EXPLICITLY so completeness is
 * enforced and nothing is silently uncovered; the registry test fails if a NEW unlisted collection
 * appears. These three are the only remaining gaps after the schema-registry binding pass:
 *
 *  - userMetadata: `userProfiles/{uid}/userMetadata/notificationSettings` — a firestore.rules
 *    match and `PATH_BUILDERS.userMetadata` exist, but there is no live reader/writer and no
 *    notification-settings type anywhere yet. Bind once that shape is implemented.
 *  - checkedOutItems: a `userProfiles/{uid}/checkedOutItems` subcollection constant with no writer,
 *    reader, rule, or path-builder (the admin "checked out items" UI reads adminTasks by
 *    `checkoutDetails.userId`, not this subcollection). Vestigial — remove once confirmed safe.
 *  - feedbackDenylist: `feedbackDenylist/{deniedWord}` — Console-managed (firestore.rules §3F: no
 *    callable writes it) and submitFeedback reads it via `.exists` only, so there is no field
 *    contract to author a schema from. The doc id is the denied word; the body is unused.
 */
export const PENDING_COLLECTIONS: readonly string[] = [
  'userMetadata',
  'checkedOutItems',
  'feedbackDenylist',
] as const;
