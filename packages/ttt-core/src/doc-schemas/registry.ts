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
  PledgePaymentSchema,
} from './social.js';
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
} from './messaging.js';
import { AppConfigSchema } from './system.js';
import {
  ContentViolationSchema,
  ModerationCascadeManifestSchema,
  ModerationCascadeChangedDocSchema,
} from './moderation.js';
import {
  AdminTaskSchema,
  ReportSchema,
  ReportGroupSchema,
  ActivityLogEntrySchema,
} from './report-docs.js';
import { TTTAuditEventSchema } from './audit.js';
import {
  NotificationDocSchema,
  NotificationHistoryDocSchema,
  PendingNotificationSchema,
} from './notifications.js';
import { PendingMediaSchema, ArchivedPendingMediaSchema } from '../media/pending-media.js';
import { ReservedDisplayNameSchema, StakeShareAuditEventSchema } from './operational.js';

export const COLLECTION_SCHEMAS = {
  // ===== Users =====
  'userProfiles/{userId}': FullUserSchema,
  'userProfiles/{userId}/privateData/{userId}': UserPrivateDataSchema,
  'userProfiles/{userId}/profileCraftSkills/{craftSkillId}': CraftSkillSchema,
  'userProfiles/{userId}/userPledgePayments/{pledgePaymentId}': PledgePaymentSchema,
  'userProfiles/{userId}/auditionVotes/{auditionId}': UserAuditionVoteSchema,
  'userProfiles/{userId}/mentionHistory/{docId}': MentionHistoryDocumentSchema,
  'userProfiles/{userId}/notificationHistory/{notificationId}': NotificationHistoryDocSchema,
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
  'publicWorkProjects/{workProjectId}': PublicWorkProjectSchema,
  'workRealms/{workRealmId}': WorkRealmSchema,
  'guildInviteConversations/{guildInviteId}': GuildInviteConversationSchema,

  // ===== Square / Social / Pledge =====
  'squareStreetzFeed/activePosts/socialPosts/{postId}': SquareStreetzPostSchema,
  'followEdges/{followEdgeId}': FollowEdgeSchema,
  'recentPledgePayments/{pledgePaymentId}': PledgePaymentSchema,
  'archivedPledgePayments/{pledgePaymentId}': PledgePaymentSchema,

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
  'adminTasks/{taskId}': AdminTaskSchema,
  'adminActivityLog/{logId}': ActivityLogEntrySchema,
  'contentViolations/{violationId}': ContentViolationSchema,
  'moderationCascadeManifests/{cascadeId}': ModerationCascadeManifestSchema,
  'moderationCascadeManifests/{cascadeId}/changedDocs/{changedDocId}': ModerationCascadeChangedDocSchema,
  'auditEvents/{eventId}': TTTAuditEventSchema,
  'stakeShareAuditEvents/{eventId}': StakeShareAuditEventSchema,
  'pendingAdminDispatches/{adminDispatchId}': AdminDispatchSchema,

  // ===== Media pipeline =====
  'pendingMedia/{pendingMediaId}': PendingMediaSchema,
  'pendingMediaArchive/{pendingMediaId}': ArchivedPendingMediaSchema,

  // ===== Notifications =====
  'activeUserNotifications/{notificationId}': NotificationDocSchema,
  'activeAdminNotifications/{notificationId}': NotificationDocSchema,
  'adminNotificationHistory/{notificationId}': NotificationHistoryDocSchema,
  'pendingNotifications/{notificationId}': PendingNotificationSchema,

  // ===== Craft skills index =====
  'craftSkillsByTag/{tag}/taggedCraftSkills/{compositeId}': CraftSkillReferenceSchema,

  // ===== Operational / utility =====
  'reservedDisplayNames/{displayNameUppercase}': ReservedDisplayNameSchema,

  // ===== _config singletons =====
  '_config/app': AppConfigSchema,
  '_config/futurePlans': FuturePlansDocumentSchema,
  '_config/rulesAndAgreements': RulesAndAgreementsSchema,
} as const satisfies Record<string, z.ZodTypeAny>;

export type RegisteredCollectionPath = keyof typeof COLLECTION_SCHEMAS;

/**
 * Collections that exist (in COLLECTIONS / *_SUBCOLLECTIONS or firestore.rules) but are not
 * yet bound to a schema — their document shape still needs to be reverse-engineered from
 * the backend write sites, OR (pledgePaymentsSummary) the terminology doc says they are
 * being removed. Listed EXPLICITLY so completeness is enforced and nothing is silently
 * uncovered. Each is a tracked follow-up; the registry test fails if a NEW unlisted
 * collection appears.
 *
 *  - Chat message bodies (guildChatMessages / conversationMessages / inviteMessages) are
 *    owned by @ttt-productions/chat-schemas (ChatMessageV1) — bind to that schema next.
 *  - userMetadata / userLikes / likeHistory / squareStreetzLikes / checkedOutItems /
 *    userSuggestions / trendingPosts / reservedDisplayNames / shortLinks / feedback* /
 *    _systemData / stakeShareAuditEvents / notificationQueue / notificationBroadcastJobs:
 *    need a shape authored from the backend write site.
 *  - pledgePaymentsSummary: terminology doc says consolidated away (Phase 6) — confirm + remove.
 */
export const PENDING_COLLECTIONS: readonly string[] = [
  'pledgePaymentsSummary',
  'shortLinks',
  'notificationQueue',
  'notificationBroadcastJobs',
  'feedbackSubmissions',
  'feedbackAliases',
  'feedbackDenylist',
  'userSuggestions',
  '_systemData',
  'userMetadata',
  'userLikes',
  'likeHistory',
  'squareStreetzLikes',
  'checkedOutItems',
  'trendingPosts',
  'guildChatMessages',
  'conversationMessages',
  'inviteMessages',
] as const;
