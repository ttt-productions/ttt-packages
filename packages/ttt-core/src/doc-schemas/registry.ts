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
import { AccountDeletionRequestV1Schema } from './account-deletion.js';
import {
  FullWorkProjectSchema,
  PublicWorkProjectSchema,
  WorkFileFolderSchema,
  WorkFileSchema,
  WorkRealmSchema,
  RealmFileFolderSchema,
  GuildmateUserSchema,
  PublicGuildmateUserSchema,
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
  PublishedChapterSchema,
  PublishedTuneTrackSchema,
  PublishedTelevisionEpisodeSchema,
  HallContentChangeRequestSchema,
  FuturePlansDocumentSchema,
  RulesAndAgreementsSchema,
  LegalPageDocumentSchema,
  TakeItDownPageCopySchema,
  HallLibraryPreferencesSchema,
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
  PledgePaymentTotalsDocSchema,
  PledgeRefundRequestSchema,
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
  ConversationFileSchema,
} from './messaging.js';
import { AppConfigSchema, AdminListSchema, ProfanityListSchema, ReservedUsernamesSchema, BlockedFranchiseNamesSchema, AppModeMarkerSchema } from './system.js';
import {
  ContentViolationSchema,
  ModerationCascadeManifestSchema,
  ModerationCascadeChangedDocSchema,
} from './moderation.js';
import {
  AdminTaskDocSchema,
} from './report-docs.js';
import { TTTAuditEventSchema } from './audit.js';
import {
  NotificationDocSchema,
  NotificationHistoryDocSchema,
  PendingNotificationSchema,
} from './notifications.js';
import {
  NotificationDeliverySchema,
  NotificationFanoutJobSchema,
} from './notification-ledger.js';
import {
  ChatChannelAuthProjectionSchema,
  ChatScopeDegradedSchema,
  ChatScopeDegradedCauseSchema,
  ChatSyncEventSchema,
  ChatSyncFanoutJobSchema,
  ChatMessageOutboxSchema,
  ChatAdminActionCommandSchema,
  ChatHistoryAnonymizationJobSchema,
  ChatHistoryAnonymizationAffectedChunkSchema,
} from './chat-sync.js';
import { SquareAnnouncementJobSchema } from './square-announcement-jobs.js';
import { PendingMediaSchema, ArchivedPendingMediaDocSchema } from '../media/pending-media.js';
import { MediaAssetSchema } from './media-assets.js';
import { MediaActivationJobSchema } from './media-activation-jobs.js';
import {
  ReservedDisplayNameSchema,
  ReservedRealmNameSchema,
  StakeShareAuditEventSchema,
  ShortLinkSchema,
  FeedbackAliasSchema,
  UserSuggestionSchema,
  StatusReconcileQueueEntrySchema,
} from './operational.js';
// ===== Trust & Safety — report spine (§A1) =====
import {
  ProtectedReportRootV1Schema,
  ReportPublicProjectionV1Schema,
  ReportGroupV1Schema,
  ReportTargetSnapshotV1Schema,
  NarrativeRecordV1Schema,
} from './safety/report.js';
import { SafetyCaseAlertV1Schema } from './safety/case-alert.js';
// ===== Trust & Safety — child-safety case spine (§A1b, §A2) =====
import {
  ChildSafetyCaseListV1Schema,
  ChildSafetyCaseV1Schema,
  ChildSafetySourceSignalV1Schema,
  ChildSafetyDecisionV1Schema,
  ChildSafetyDecisionViewV1Schema,
  ChildSafetyCaseAccountV1Schema,
  ChildSafetyCaseAccountHistoryV1Schema,
  ChildSafetyNcmecSubmissionV1Schema,
  ChildSafetyNcmecSubmissionFileV1Schema,
  ChildSafetyLegalProcessEventV1Schema,
} from './safety/case.js';
import {
  ChildSafetyOwningAliasV1Schema,
} from './safety/case-aliases.js';
import {
  SafetyHoldRefV1Schema,
  SafetyHoldResourceV1Schema,
  SafetyResourceCommandV1Schema,
  SafetyResourceCommandAuthorizedRequestV1Schema,
  SafetyResourceCommandBypassRefV1Schema,
} from './safety/holds.js';
import {
  SafetyEvidenceManifestV1Schema,
  SafetyEvidenceJobV1Schema,
  SafetyEvidenceJobItemV1Schema,
  SafetyEvidenceDispositionV1Schema,
} from './safety/evidence.js';
import { EventProvenanceV1Schema } from './safety/provenance.js';
import {
  QuarantineSagaJobV1Schema,
  QuarantineSagaRelatedAssetV1Schema,
  NcmecSubmissionJobV1Schema,
  AccountActionCommandV1Schema,
} from './safety/sagas.js';
import {
  SafetySlaMonitorV1Schema,
  SafetyMonitorHeartbeatV1Schema,
} from './safety/monitors.js';
import { AgeAttestationNonceV1Schema, AgePolicyConfigV1Schema } from './safety/age.js';
// ===== Trust & Safety — NCII / TAKE IT DOWN (§A11) =====
import { NciiAllegationV1Schema } from './ncii/allegations.js';
import {
  TakeItDownRequestRootV1Schema,
  TakeItDownRequesterPrivateV1Schema,
  TakeItDownSubmissionV1Schema,
  TakeItDownValidityDecisionV1Schema,
  TakeItDownRequestActionV1Schema,
  TakeItDownEvidenceV1Schema,
  NciiRetainedEvidenceInventoryV1Schema,
} from './ncii/requests.js';
import {
  NciiCaseV1Schema,
  NciiCaseAllegationLinkV1Schema,
  NciiCaseRequestLinkV1Schema,
  NciiCaseRemovalActionV1Schema,
  NciiBlockedHashV1Schema,
} from './ncii/cases.js';
import { NciiTemporaryHoldV1Schema } from './ncii/holds.js';
import {
  NciiRemovalJobV1Schema,
  NciiRemovalTargetV1Schema,
} from './ncii/removal.js';
import {
  NciiPolicyConfigV1Schema,
  PrivilegedReviewerSecurityProfileV1Schema,
} from './ncii/config.js';
import {
  HallMediaReaperCursorSchema,
  NcmecPortalCorrectionRecordV1Schema,
  NcmecPortalReceiptArtifactV1Schema,
  OperatorStepUpSchema,
  SafetyReconcilerCursorSchema,
} from './backend-state.js';

export const COLLECTION_SCHEMAS = {
  // ===== Users =====
  'userProfiles/{userId}': FullUserSchema,
  'userProfiles/{userId}/privateData/{userId}': UserPrivateDataSchema,
  'userProfiles/{userId}/privateData/hallLibraryPreferences': HallLibraryPreferencesSchema,
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
  'allWorkProjects/{workProjectId}/workFileFolders/{workFileFolderId}': WorkFileFolderSchema,
  'allWorkProjects/{workProjectId}/workFileFolders/{workFileFolderId}/workFiles/{workFileId}': WorkFileSchema,
  'allWorkProjects/{workProjectId}/workProjectTales/{taleId}': FullTaleSchema,
  'allWorkProjects/{workProjectId}/workProjectTales/{taleId}/taleChapters/{chapterId}': FullChapterSchema,
  'allWorkProjects/{workProjectId}/workProjectTunes/{tuneId}': FullTuneSchema,
  'allWorkProjects/{workProjectId}/workProjectTunes/{tuneId}/tuneTracks/{trackId}': FullTuneTrackSchema,
  'allWorkProjects/{workProjectId}/workProjectTelevision/{televisionId}': FullTelevisionSchema,
  'allWorkProjects/{workProjectId}/workProjectTelevision/{televisionId}/televisionEpisodes/{episodeId}': FullTelevisionEpisodeSchema,
  'allWorkProjects/{workProjectId}/guildChatChannels/{guildChatChannelId}': GuildChatChannelSchema,
  // Guild channel + invite messages are REALTIME-ONLY (chat Worker DO) — no Firestore schema.
  'publicWorkProjects/{workProjectId}': PublicWorkProjectSchema,
  'workRealms/{workRealmId}': WorkRealmSchema,
  // Realm shared-file folders — steward-owned containers; callable-written, client-read denied
  // (the gallery projection returns them alongside the files).
  'workRealms/{workRealmId}/realmFileFolders/{realmFileFolderId}': RealmFileFolderSchema,
  'guildInviteConversations/{guildInviteId}': GuildInviteConversationSchema,
  // Conversation Files — the flat per-conversation file list. Backend-only writes;
  // client-readable only while the caller holds conversation read access.
  'guildInviteConversations/{guildInviteId}/conversationFiles/{conversationFileId}': ConversationFileSchema,

  // ===== Square / Social =====
  // SquareStreetzPostSchema is a refined ZodObject (superRefine for the MEDIA-101
  // mediaAssetId↔mediaType pair invariant); the schema-doc generator and the
  // drift-check both unwrap the effect to introspect its shape, so binding the
  // refined schema here is correct.
  'squareStreetzFeed/activePosts/socialPosts/{postId}': SquareStreetzPostSchema,
  'squareStreetzFeed/trendingPosts': TrendingPostsSchema,
  'followEdges/{followEdgeId}': FollowEdgeSchema,
  'followCounters/{followCounterId}': FollowCounterSchema,
  // Durable Square announcement outbox (Admin-SDK-only; deterministic job ids).
  'squareAnnouncementJobs/{jobId}': SquareAnnouncementJobSchema,

  // ===== Payments / pledge ledger =====
  'pledgePayments/{pledgePaymentId}': PledgePaymentSchema,
  'pledgePaymentProviderRefs/{pledgePaymentId}': PledgePaymentProviderRefSchema,
  'processedStripeEvents/{stripeEventId}': ProcessedStripeEventSchema,
  'pledgePaymentLedgerEvents/{ledgerId}': PledgePaymentLedgerEventSchema,
  'paymentWebhookQuarantine/{stripeEventId}': PaymentWebhookQuarantineSchema,
  'pledgePaymentTotals/summary': PledgePaymentTotalsDocSchema,
  'pledgeRefundRequests/{requestId}': PledgeRefundRequestSchema,

  // ===== Threshold / Hall =====
  'thresholdItems/{thresholdItemId}': ThresholdItemSchema,
  'hallItems/{hallItemId}': PublishedHallItemSchema,
  // Published hall sub-item projections — the chapter/track/episode docs copied out of
  // the Work at publish time (runPublishApprovedHallLibraryItem). Segment names are the
  // HALL_ITEM_SUBCOLLECTIONS constants — fixed compound names, NOT derived from
  // WorkProjectType.
  'hallItems/{hallItemId}/hallItemTales/{itemId}': PublishedChapterSchema,
  'hallItems/{hallItemId}/hallItemTunes/{itemId}': PublishedTuneTrackSchema,
  'hallItems/{hallItemId}/hallItemTelevision/{itemId}': PublishedTelevisionEpisodeSchema,
  'hallContentChangeRequests/{changeRequestId}': HallContentChangeRequestSchema,

  // ===== Commission / Audition =====
  'commissionListings/{commissionListingId}': FullCommissionListingSchema,
  'commissionListings/{commissionListingId}/commissionProposals/{commissionProposalId}': CommissionProposalSchema,
  'auditionBoard/{auditionId}': AuditionSchema,
  'auditionBoard/{auditionId}/auditionEntries/{auditionEntryId}': AuditionEntrySchema,

  // ===== Moderation / Reports / Admin =====
  // The report spine (§A1): the restricted root, its public projection subdoc, and the
  // dedup/count group. The root + projection are written by the app's submitReport
  // callable; the group is maintained by an app-side trigger.
  'contentReports/{reportId}': ProtectedReportRootV1Schema,
  'contentReports/{reportId}/publicProjection/{reportId}': ReportPublicProjectionV1Schema,
  'contentReports/{reportId}/privateDetails/snapshot': ReportTargetSnapshotV1Schema,
  'contentReports/{reportId}/privateDetails/narrative': NarrativeRecordV1Schema,
  'activeReportGroups/{groupKey}': ReportGroupV1Schema,
  'adminTasks/{taskId}': AdminTaskDocSchema,
  'contentViolations/{violationId}': ContentViolationSchema,
  'moderationCascadeManifests/{cascadeId}': ModerationCascadeManifestSchema,
  'moderationCascadeManifests/{cascadeId}/changedDocs/{changedDocId}': ModerationCascadeChangedDocSchema,
  'auditEvents/{eventId}': TTTAuditEventSchema,
  'stakeShareAuditEvents/{eventId}': StakeShareAuditEventSchema,
  'pendingAdminDispatches/{adminDispatchId}': AdminDispatchSchema,
  'pendingAdminDispatches/{adminDispatchId}/conversationMessages/{adminDispatchMessageId}': ChatMessageV1Schema,
  'pendingAdminDispatches/{adminDispatchId}/conversationFiles/{conversationFileId}': ConversationFileSchema,

  // ===== Media pipeline =====
  'pendingMedia/{pendingMediaId}': PendingMediaSchema,
  'pendingMediaArchive/{pendingMediaId}': ArchivedPendingMediaDocSchema,
  'mediaAssets/{mediaAssetId}': MediaAssetSchema,
  'mediaActivationJobs/{jobId}': MediaActivationJobSchema,

  // ===== Notifications =====
  'activeUserNotifications/{notificationId}': NotificationDocSchema,
  'activeAdminNotifications/{notificationId}': NotificationDocSchema,
  'adminNotificationHistory/{notificationId}': NotificationHistoryDocSchema,
  'pendingNotifications/{notificationId}': PendingNotificationSchema,

  // ===== Notification redesign — delivery ledger + fanout engine =====
  'notificationDeliveries/{deliveryId}': NotificationDeliverySchema,
  'notificationFanoutJobs/{jobId}': NotificationFanoutJobSchema,

  // ===== Chat realtime sync / projection / commands =====
  'chatChannelAuthProjections/{authPairKey}': ChatChannelAuthProjectionSchema,
  'chatScopeDegraded/{scopeKey}': ChatScopeDegradedSchema,
  'chatScopeDegraded/{scopeKey}/chatScopeDegradedCauses/{causeId}': ChatScopeDegradedCauseSchema,
  'chatSyncEvents/{eventId}': ChatSyncEventSchema,
  'chatSyncFanoutJobs/{jobId}': ChatSyncFanoutJobSchema,
  'chatMessageOutbox/{commandId}': ChatMessageOutboxSchema,
  'chatAdminActionCommands/{requestId}': ChatAdminActionCommandSchema,
  'chatHistoryAnonymizationJobs/{jobId}': ChatHistoryAnonymizationJobSchema,
  'chatHistoryAnonymizationJobs/{jobId}/affectedChunks/{chunkOrdinal}': ChatHistoryAnonymizationAffectedChunkSchema,

  // ===== Craft skills index =====
  'craftSkillsByTag/{tag}/taggedCraftSkills/{compositeId}': CraftSkillReferenceSchema,

  // ===== Operational / utility =====
  'reservedDisplayNames/{displayNameUppercase}': ReservedDisplayNameSchema,
  'reservedRealmNames/{workingTitleUppercase}': ReservedRealmNameSchema,
  'accountDeletionRequests/{uid}': AccountDeletionRequestV1Schema,
  'shortLinks/{shortId}': ShortLinkSchema,
  'feedbackSubmissions/{feedbackType}/userSuggestions/{suggestionId}': UserSuggestionSchema,
  'statusReconcileQueue/{uid}': StatusReconcileQueueEntrySchema,

  // ===== Trust & Safety — child-safety case spine (§A1b, §A2) =====
  'childSafetyCaseList/{caseId}': ChildSafetyCaseListV1Schema,
  'activeSafetyCaseAlerts/{caseId}': SafetyCaseAlertV1Schema,
  'childSafetyCases/{caseId}': ChildSafetyCaseV1Schema,
  'childSafetyCases/{caseId}/sourceSignals/{signalId}': ChildSafetySourceSignalV1Schema,
  'childSafetyCases/{caseId}/childSafetyDecisions/{decisionId}': ChildSafetyDecisionV1Schema,
  'childSafetyCases/{caseId}/childSafetyDecisions/{decisionId}/childSafetyDecisionViews/{viewId}': ChildSafetyDecisionViewV1Schema,
  'childSafetyCases/{caseId}/childSafetyCaseAccounts/{uid}': ChildSafetyCaseAccountV1Schema,
  'childSafetyCases/{caseId}/childSafetyCaseAccounts/{uid}/childSafetyCaseAccountHistory/{historyId}': ChildSafetyCaseAccountHistoryV1Schema,
  'childSafetyCases/{caseId}/ncmecSubmissions/{submissionId}': ChildSafetyNcmecSubmissionV1Schema,
  'childSafetyCases/{caseId}/ncmecSubmissions/{submissionId}/ncmecSubmissionFiles/{fileId}': ChildSafetyNcmecSubmissionFileV1Schema,
  'childSafetyCases/{caseId}/legalProcess/{eventId}': ChildSafetyLegalProcessEventV1Schema,
  // Portal-filed NCMEC artifacts recorded by the two step-up-gated operator callables. Both
  // are backend-only (no client reader), so their shapes live in doc-schemas/backend-state.ts.
  'childSafetyCases/{caseId}/portalReceiptArtifacts/{artifactId}': NcmecPortalReceiptArtifactV1Schema,
  'childSafetyCases/{caseId}/ncmecPortalCorrections/{correctionId}': NcmecPortalCorrectionRecordV1Schema,
  'childSafetyOwningAliases/{aliasId}': ChildSafetyOwningAliasV1Schema,

  // ===== Trust & Safety — holds + resource commands (§A3) =====
  'safetyHoldRefs/{holdRefId}': SafetyHoldRefV1Schema,
  'safetyHoldResources/{resourceKeyHash}': SafetyHoldResourceV1Schema,
  'safetyResourceCommands/{commandDocId}': SafetyResourceCommandV1Schema,
  'safetyResourceCommands/{commandDocId}/authorizedRequests/{requestId}': SafetyResourceCommandAuthorizedRequestV1Schema,
  'safetyResourceCommands/{commandDocId}/bypassRefs/{refId}': SafetyResourceCommandBypassRefV1Schema,

  // ===== Trust & Safety — evidence + provenance (§A4, §A6) =====
  // SafetyEvidenceManifestV1Schema is a refined ZodObject (superRefine for the H5
  // sourceKind invariant); the schema-doc generator unwraps the effect to introspect
  // its shape, so binding the refined schema here is correct.
  'safetyEvidenceManifests/{manifestId}': SafetyEvidenceManifestV1Schema,
  'safetyEvidenceJobs/{jobId}': SafetyEvidenceJobV1Schema,
  'safetyEvidenceJobs/{jobId}/safetyEvidenceJobItems/{itemId}': SafetyEvidenceJobItemV1Schema,
  'safetyEvidenceJobs/{jobId}/safetyEvidenceJobDisposition/{locationId}': SafetyEvidenceDispositionV1Schema,
  'eventProvenance/{eventId}': EventProvenanceV1Schema,

  // ===== Trust & Safety — sagas + closure (§A5) =====
  'quarantineSagaJobs/{caseId}': QuarantineSagaJobV1Schema,
  'quarantineSagaJobs/{caseId}/relatedAssets/{assetId}': QuarantineSagaRelatedAssetV1Schema,
  'ncmecSubmissionJobs/{ncmecJobId}': NcmecSubmissionJobV1Schema,
  'accountActionCommands/{accountActionCommandId}': AccountActionCommandV1Schema,

  // ===== Trust & Safety — SLA monitors + heartbeat (§A8) =====
  'safetySlaMonitors/{monitorId}': SafetySlaMonitorV1Schema,
  'safetyMonitorHeartbeat/global': SafetyMonitorHeartbeatV1Schema,

  // ===== Trust & Safety — age attestation nonces (§A7) =====
  'ageAttestationNonces/{nonceHash}': AgeAttestationNonceV1Schema,

  // ===== Trust & Safety — operator step-up + reconciler cursors (backend-only) =====
  // Cloud-Functions-only readers/writers; client access denied in firestore.rules.
  'operatorStepUp/{uid}': OperatorStepUpSchema,
  'safetyReconcilerCursors/{cursorKey}': SafetyReconcilerCursorSchema,

  // ===== Trust & Safety — NCII / TAKE IT DOWN (§A11) =====
  'nciiAllegations/{allegationId}': NciiAllegationV1Schema,
  'takeItDownRequests/{requestId}': TakeItDownRequestRootV1Schema,
  'takeItDownRequests/{requestId}/privateDetails/requester': TakeItDownRequesterPrivateV1Schema,
  'takeItDownRequests/{requestId}/takeItDownSubmissions/{submissionId}': TakeItDownSubmissionV1Schema,
  'takeItDownRequests/{requestId}/validityDecisions/{decisionId}': TakeItDownValidityDecisionV1Schema,
  'takeItDownRequests/{requestId}/takeItDownActions/{actionId}': TakeItDownRequestActionV1Schema,
  'takeItDownRequests/{requestId}/takeItDownEvidence/{evidenceId}': TakeItDownEvidenceV1Schema,
  'nciiCases/{caseId}': NciiCaseV1Schema,
  'nciiCases/{caseId}/allegationLinks/{allegationId}': NciiCaseAllegationLinkV1Schema,
  'nciiCases/{caseId}/requestLinks/{requestId}': NciiCaseRequestLinkV1Schema,
  'nciiCases/{caseId}/removalActions/{actionId}': NciiCaseRemovalActionV1Schema,
  'nciiCases/{caseId}/blockedHashes/{hashId}': NciiBlockedHashV1Schema,
  'nciiRetainedEvidenceInventory/{inventoryId}': NciiRetainedEvidenceInventoryV1Schema,
  // [H-01] dead-letter sink for inventory rows that could not be written to the primary
  // nciiRetainedEvidenceInventory collection. Stores the same document shape.
  'nciiInventoryDeadLetter/{inventoryId}': NciiRetainedEvidenceInventoryV1Schema,
  'nciiTemporaryHolds/{holdId}': NciiTemporaryHoldV1Schema,
  'nciiRemovalJobs/{jobId}': NciiRemovalJobV1Schema,
  'nciiRemovalJobs/{jobId}/nciiRemovalTargets/{targetKeyHash}': NciiRemovalTargetV1Schema,

  // ===== _appConfig singletons (public) =====
  '_appConfig/app': AppConfigSchema,
  '_appConfig/futurePlans': FuturePlansDocumentSchema,
  '_appConfig/rulesAndAgreements': RulesAndAgreementsSchema,
  // Content-pages migration (DJ ruling 2026-07-06): /terms, /privacy, and the
  // /take-it-down page copy render exclusively from these (all public pages —
  // take-it-down is a NO-LOGIN page, so its copy doc must be publicly readable).
  '_appConfig/termsOfService': LegalPageDocumentSchema,
  '_appConfig/privacyPolicy': LegalPageDocumentSchema,
  '_appConfig/takeItDownPageCopy': TakeItDownPageCopySchema,

  // ===== _serverData singletons (server-only — Cloud-Functions-only readers, BACKEND-108) =====
  '_serverData/agePolicy': AgePolicyConfigV1Schema,
  '_serverData/nciiPolicy': NciiPolicyConfigV1Schema,
  '_serverData/privilegedReviewerSecurity': PrivilegedReviewerSecurityProfileV1Schema,
  // The submitFeedback alias map — moved off the anonymously-readable top-level
  // `feedbackAliases` collection into the server-only bucket (BACKEND-108). The sibling
  // `feedbackDenylist` subcollection has no field contract (`.exists`-only) — see
  // PENDING_COLLECTIONS.
  '_serverData/feedbackLists/feedbackAliases/{aliasId}': FeedbackAliasSchema,

  // ===== _systemData singletons =====
  '_systemData/adminList': AdminListSchema,
  '_systemData/profanityList': ProfanityListSchema,
  '_systemData/reservedUsernames': ReservedUsernamesSchema,
  '_systemData/blockedFranchiseNames': BlockedFranchiseNamesSchema,
  '_systemData/appMode': AppModeMarkerSchema,
  '_systemData/hallMediaReaperCursor': HallMediaReaperCursorSchema,
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
  // Published hall sub-items: the doc id IS the live sub-item's id; `uid` is injected at
  // read (the publish writer spreads the live doc's stored body, which has no `uid`).
  'hallItems/{hallItemId}/hallItemTales/{itemId}': 'uid',
  'hallItems/{hallItemId}/hallItemTunes/{itemId}': 'uid',
  'hallItems/{hallItemId}/hallItemTelevision/{itemId}': 'uid',
  'activeUserNotifications/{notificationId}': 'id',
  'activeAdminNotifications/{notificationId}': 'id',
  'adminNotificationHistory/{notificationId}': 'archiveOccurrenceId',
  'userProfiles/{userId}/notificationHistory/{notificationId}': 'archiveOccurrenceId',
  'pendingNotifications/{notificationId}': 'id',
  'statusReconcileQueue/{uid}': 'uid',
} as const satisfies Partial<Record<RegisteredCollectionPath, string>>;

/**
 * Collections that exist (in COLLECTIONS / *_SUBCOLLECTIONS or firestore.rules) but are
 * intentionally NOT bound to a schema, each with a reason. Listed EXPLICITLY so completeness is
 * enforced and nothing is silently uncovered; the registry test fails if a NEW unlisted collection
 * appears. These are the only remaining gaps after the schema-registry binding pass:
 *
 *  - userMetadata: `userProfiles/{uid}/userMetadata/notificationSettings` — a firestore.rules
 *    match and `PATH_BUILDERS.userMetadata` exist, but there is no live reader/writer and no
 *    notification-settings type anywhere yet. Bind once that shape is implemented.
 *  - feedbackDenylist: `_serverData/feedbackLists/feedbackDenylist/{deniedWord}` — Console-managed
 *    (no callable writes it) and submitFeedback reads it via `.exists` only, so there is no field
 *    contract to author a schema from. The doc id is the denied word; the body is unused.
 *  - ncmecSubmissionAttempts / privilegedReviewer*: see the inline reasons below.
 */
export const PENDING_COLLECTIONS: readonly string[] = [
  'userMetadata',
  'feedbackDenylist',
  // Append-only NCII case closure/reopen event rows — the doc shape is owned app-side
  // (NciiCaseV1 closure events), not modeled in ttt-core doc-schemas.
  'closureEvents',
  // Per-submission NCMEC transmission attempts. The segment exists only in firestore.rules
  // today and has no writer or reader yet; the constant is registered so the name has one
  // owner. Bind once the attempt-record shape is implemented.
  'ncmecSubmissionAttempts',
  // The privileged-reviewer passkey / capability-grant feature is NOT V1: zero writer and zero
  // reader anywhere in functions/src or src, and no firestore.rules block. Their forward-declared
  // schemas (doc-schemas/safety/reviewer-security.ts) stay authored but are UNBOUND, so the
  // registry remains an inventory of live collections. Bind when the feature is built.
  'privilegedReviewerPasskeyProfiles',
  'privilegedReviewerCapabilityGrants',
] as const;
