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
  HallSubmissionReservationSchema,
  PublishedHallItemSchema,
  PublishedChapterSchema,
  PublishedTuneTrackSchema,
  PublishedTelevisionEpisodeSchema,
  HallContentChangeRequestSchema,
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
import {
  PublicDocumentVersionSchema,
  PublicDocumentDraftSchema,
  PublicDocumentReleaseSchema,
  PUBLIC_DOCUMENT_PROJECTIONS,
} from './public-documents.js';
import {
  AppConfigSchema,
  AdminListSchema,
  ProfanityListSchema,
  ReservedUsernamesSchema,
  BlockedFranchiseNamesSchema,
  AppModeMarkerSchema,
} from './system.js';
import { SystemUidSlotsDocumentSchema, SystemVideoSlotsDocumentSchema } from './system-slots.js';
import {
  ContentViolationSchema,
  ModerationCascadeManifestSchema,
  ModerationCascadeChangedDocSchema,
} from './moderation.js';
import { AdminTaskDocSchema } from './report-docs.js';
import { TTTAuditEventSchema } from './audit.js';
import {
  NotificationDocSchema,
  NotificationHistoryDocSchema,
  PendingNotificationSchema,
} from './notifications.js';
import { NotificationDeliverySchema, NotificationFanoutJobSchema } from './notification-ledger.js';
import { NotificationArchiveAllJobSchema } from './notification-archive-all-jobs.js';
import { AdminDispatchReadMarkerSchema } from './admin-dispatch-read-markers.js';
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
  ChatParkedDeliverySchema,
} from './chat-sync.js';
import { SquareAnnouncementJobSchema } from './square-announcement-jobs.js';
import { PendingMediaSchema, ArchivedPendingMediaDocSchema } from '../media/pending-media.js';
import { MediaAssetSchema } from './media-assets.js';
import { MediaActivationJobSchema } from './media-activation-jobs.js';
import { MediaCopyIntentSchema } from './media-copy-intents.js';
import {
  ReservedDisplayNameSchema,
  ReservedRealmNameSchema,
  StakeShareAuditEventSchema,
  ShortLinkSchema,
  FeedbackAliasSchema,
  UserSuggestionSchema,
  StatusReconcileQueueEntrySchema,
  ContentionLockSchema,
} from './operational.js';
import {
  ProtectedReportRootV1Schema,
  ReportPublicProjectionV1Schema,
  ReportGroupV1Schema,
  ReportGroupCountedReportSchema,
  ReportTargetSnapshotV1Schema,
  NarrativeRecordV1Schema,
} from './safety/report.js';
import { SafetyCaseAlertV1Schema } from './safety/case-alert.js';
import {
  ChildSafetyCaseListV1Schema,
  ChildSafetyCaseV1Schema,
  ChildSafetySourceSignalV1Schema,
  ChildSafetyDecisionV1Schema,
  ChildSafetyDecisionViewV1Schema,
  ChildSafetyCaseAccountV1Schema,
  ChildSafetyCaseAccountHistoryV1Schema,
  ChildSafetyCrossoverItemV1Schema,
  ChildSafetyNcmecSubmissionV1Schema,
  ChildSafetyNcmecSubmissionFileV1Schema,
  ChildSafetyLegalProcessEventV1Schema,
} from './safety/case.js';
import { ChildSafetyOwningAliasV1Schema } from './safety/case-aliases.js';
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
  SafetyEvidenceJobItemDocV1Schema,
  SafetyEvidenceDispositionV1Schema,
} from './safety/evidence.js';
import { EventProvenanceV1Schema } from './safety/provenance.js';
import {
  QuarantineSagaJobV1Schema,
  QuarantineSagaRelatedAssetV1Schema,
  NcmecSubmissionJobV1Schema,
  AccountActionCommandV1Schema,
} from './safety/sagas.js';
import { SafetySlaMonitorV1Schema, SafetyMonitorHeartbeatV1Schema } from './safety/monitors.js';
import { AgeAttestationNonceV1Schema, AgePolicyConfigV1Schema } from './safety/age.js';
import { NciiAllegationV1Schema } from './ncii/allegations.js';
import {
  TakeItDownRequestRootV1Schema,
  TakeItDownRequesterPrivateV1Schema,
  TakeItDownSubmissionV1Schema,
  TakeItDownValidityDecisionV1Schema,
  TakeItDownValidityRationaleV1Schema,
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
  NciiCaseClosureEventV1Schema,
} from './ncii/cases.js';
import { NciiTemporaryHoldV1Schema } from './ncii/holds.js';
import { NciiRemovalJobV1Schema, NciiRemovalTargetV1Schema } from './ncii/removal.js';
import {
  NciiPolicyConfigV1Schema,
  PrivilegedReviewerSecurityProfileV1Schema,
} from './ncii/config.js';
import {
  NcmecCompletionProofRecordV1Schema,
  NcmecPortalCorrectionRecordV1Schema,
  NcmecPortalReceiptArtifactV1Schema,
  OperatorStepUpSchema,
  SweepStateSchema,
} from './backend-state.js';

export const COLLECTION_SCHEMAS = {
  'userProfiles/{userId}': FullUserSchema,
  'userProfiles/{userId}/privateData/{userId}': UserPrivateDataSchema,
  'userProfiles/{userId}/privateData/hallLibraryPreferences': HallLibraryPreferencesSchema,
  'userProfiles/{userId}/profileCraftSkills/{craftSkillId}': CraftSkillSchema,
  'userProfiles/{userId}/auditionVotes/{auditionId}': UserAuditionVoteSchema,
  'userProfiles/{userId}/mentionHistory/{docId}': MentionHistoryDocumentSchema,
  'userProfiles/{userId}/notificationHistory/{notificationId}': NotificationHistoryDocSchema,
  'userProfiles/{userId}/userLikes/likeHistory/squareStreetzLikes/{postId}':
    SquareStreetzLikeSchema,
  'publicUsers/{uid}': PublicUserSchema,

  'allWorkProjects/{workProjectId}': FullWorkProjectSchema,
  'allWorkProjects/{workProjectId}/guildmateUsers/{uid}': GuildmateUserSchema,
  'allWorkProjects/{workProjectId}/publicGuildmateUsers/{uid}': PublicGuildmateUserSchema,
  'allWorkProjects/{workProjectId}/workFileFolders/{workFileFolderId}': WorkFileFolderSchema,
  'allWorkProjects/{workProjectId}/workFileFolders/{workFileFolderId}/workFiles/{workFileId}':
    WorkFileSchema,
  'allWorkProjects/{workProjectId}/hallSubmissionReservation/reservation':
    HallSubmissionReservationSchema,
  'allWorkProjects/{workProjectId}/workProjectTales/{taleId}': FullTaleSchema,
  'allWorkProjects/{workProjectId}/workProjectTales/{taleId}/taleChapters/{chapterId}':
    FullChapterSchema,
  'allWorkProjects/{workProjectId}/workProjectTunes/{tuneId}': FullTuneSchema,
  'allWorkProjects/{workProjectId}/workProjectTunes/{tuneId}/tuneTracks/{trackId}':
    FullTuneTrackSchema,
  'allWorkProjects/{workProjectId}/workProjectTelevision/{televisionId}': FullTelevisionSchema,
  'allWorkProjects/{workProjectId}/workProjectTelevision/{televisionId}/televisionEpisodes/{episodeId}':
    FullTelevisionEpisodeSchema,
  'allWorkProjects/{workProjectId}/guildChatChannels/{guildChatChannelId}': GuildChatChannelSchema,
  'publicWorkProjects/{workProjectId}': PublicWorkProjectSchema,
  'workRealms/{workRealmId}': WorkRealmSchema,
  'workRealms/{workRealmId}/realmFileFolders/{realmFileFolderId}': RealmFileFolderSchema,
  'guildInviteConversations/{guildInviteId}': GuildInviteConversationSchema,
  'guildInviteConversations/{guildInviteId}/conversationFiles/{conversationFileId}':
    ConversationFileSchema,

  // A refined schema binds here as is: the schema-doc generator and the drift-check unwrap the
  // effect.
  'squareStreetzFeed/activePosts/socialPosts/{postId}': SquareStreetzPostSchema,
  'squareStreetzFeed/trendingPosts': TrendingPostsSchema,
  'followEdges/{followEdgeId}': FollowEdgeSchema,
  'followCounters/{followCounterId}': FollowCounterSchema,
  'squareAnnouncementJobs/{jobId}': SquareAnnouncementJobSchema,

  'pledgePayments/{pledgePaymentId}': PledgePaymentSchema,
  'pledgePaymentProviderRefs/{pledgePaymentId}': PledgePaymentProviderRefSchema,
  'processedStripeEvents/{stripeEventId}': ProcessedStripeEventSchema,
  'pledgePaymentLedgerEvents/{ledgerId}': PledgePaymentLedgerEventSchema,
  'paymentWebhookQuarantine/{stripeEventId}': PaymentWebhookQuarantineSchema,
  'pledgePaymentTotals/summary': PledgePaymentTotalsDocSchema,
  'pledgeRefundRequests/{requestId}': PledgeRefundRequestSchema,

  'thresholdItems/{thresholdItemId}': ThresholdItemSchema,
  'hallItems/{hallItemId}': PublishedHallItemSchema,
  'hallItems/{hallItemId}/hallItemTales/{itemId}': PublishedChapterSchema,
  'hallItems/{hallItemId}/hallItemTunes/{itemId}': PublishedTuneTrackSchema,
  'hallItems/{hallItemId}/hallItemTelevision/{itemId}': PublishedTelevisionEpisodeSchema,
  'hallContentChangeRequests/{changeRequestId}': HallContentChangeRequestSchema,
  'hallContentChangeRequestLocks/{targetKey}': ContentionLockSchema,

  'commissionListings/{commissionListingId}': FullCommissionListingSchema,
  'commissionListings/{commissionListingId}/commissionProposals/{commissionProposalId}':
    CommissionProposalSchema,
  'auditionBoard/{auditionId}': AuditionSchema,
  'auditionBoard/{auditionId}/auditionEntries/{auditionEntryId}': AuditionEntrySchema,

  'contentReports/{reportId}': ProtectedReportRootV1Schema,
  'contentReports/{reportId}/publicProjection/{reportId}': ReportPublicProjectionV1Schema,
  'contentReports/{reportId}/privateDetails/snapshot': ReportTargetSnapshotV1Schema,
  'contentReports/{reportId}/privateDetails/narrative': NarrativeRecordV1Schema,
  'contentReports/{reportId}/privateDetails/narrativeEscalation': NarrativeRecordV1Schema,
  'activeReportGroups/{groupKey}': ReportGroupV1Schema,
  'activeReportGroups/{groupKey}/reportGroupCountedReports/{reportId}':
    ReportGroupCountedReportSchema,
  'adminTasks/{taskId}': AdminTaskDocSchema,
  'contentViolations/{violationId}': ContentViolationSchema,
  'moderationCascadeManifests/{cascadeId}': ModerationCascadeManifestSchema,
  'moderationCascadeManifests/{cascadeId}/changedDocs/{changedDocId}':
    ModerationCascadeChangedDocSchema,
  'auditEvents/{eventId}': TTTAuditEventSchema,
  'stakeShareAuditEvents/{eventId}': StakeShareAuditEventSchema,
  'pendingAdminDispatches/{adminDispatchId}': AdminDispatchSchema,
  'pendingAdminDispatches/{adminDispatchId}/conversationMessages/{adminDispatchMessageId}':
    ChatMessageV1Schema,
  'pendingAdminDispatches/{adminDispatchId}/conversationFiles/{conversationFileId}':
    ConversationFileSchema,
  'pendingAdminDispatches/{adminDispatchId}/dispatchReadMarkers/{uid}':
    AdminDispatchReadMarkerSchema,

  'pendingMedia/{pendingMediaId}': PendingMediaSchema,
  'pendingMediaArchive/{pendingMediaId}': ArchivedPendingMediaDocSchema,
  'mediaAssets/{mediaAssetId}': MediaAssetSchema,
  'mediaActivationJobs/{jobId}': MediaActivationJobSchema,
  'mediaCopyIntents/{newAssetId}': MediaCopyIntentSchema,

  'activeUserNotifications/{notificationId}': NotificationDocSchema,
  'activeAdminNotifications/{notificationId}': NotificationDocSchema,
  'adminNotificationHistory/{notificationId}': NotificationHistoryDocSchema,
  'pendingNotifications/{notificationId}': PendingNotificationSchema,

  'notificationDeliveries/{deliveryId}': NotificationDeliverySchema,
  'notificationFanoutJobs/{jobId}': NotificationFanoutJobSchema,
  'notificationArchiveAllJobs/{jobId}': NotificationArchiveAllJobSchema,

  'chatChannelAuthProjections/{authPairKey}': ChatChannelAuthProjectionSchema,
  'chatScopeDegraded/{scopeKey}': ChatScopeDegradedSchema,
  'chatScopeDegraded/{scopeKey}/chatScopeDegradedCauses/{causeId}': ChatScopeDegradedCauseSchema,
  'chatSyncEvents/{eventId}': ChatSyncEventSchema,
  'chatSyncFanoutJobs/{jobId}': ChatSyncFanoutJobSchema,
  'chatMessageOutbox/{commandId}': ChatMessageOutboxSchema,
  'chatAdminActionCommands/{requestId}': ChatAdminActionCommandSchema,
  'chatHistoryAnonymizationJobs/{jobId}': ChatHistoryAnonymizationJobSchema,
  'chatHistoryAnonymizationJobs/{jobId}/affectedChunks/{chunkOrdinal}':
    ChatHistoryAnonymizationAffectedChunkSchema,
  'chatParkedDeliveries/{deliveryId}': ChatParkedDeliverySchema,

  'craftSkillsByTag/{tag}/taggedCraftSkills/{compositeId}': CraftSkillReferenceSchema,

  'reservedDisplayNames/{displayNameUppercase}': ReservedDisplayNameSchema,
  'reservedRealmNames/{workingTitleUppercase}': ReservedRealmNameSchema,
  'accountDeletionRequests/{uid}': AccountDeletionRequestV1Schema,
  'shortLinks/{shortId}': ShortLinkSchema,
  'feedbackSubmissions/{feedbackType}/userSuggestions/{suggestionId}': UserSuggestionSchema,
  'statusReconcileQueue/{uid}': StatusReconcileQueueEntrySchema,
  'adminDispatchAppealLocks/{uid}': ContentionLockSchema,

  'publicDocuments/{documentId}/publicDocumentVersions/{versionId}': PublicDocumentVersionSchema,
  'publicDocumentDrafts/{documentId}': PublicDocumentDraftSchema,
  'publicDocumentReleases/{releaseId}': PublicDocumentReleaseSchema,

  'childSafetyCaseList/{caseId}': ChildSafetyCaseListV1Schema,
  'activeSafetyCaseAlerts/{caseId}': SafetyCaseAlertV1Schema,
  'childSafetyCases/{caseId}': ChildSafetyCaseV1Schema,
  'childSafetyCases/{caseId}/sourceSignals/{signalId}': ChildSafetySourceSignalV1Schema,
  'childSafetyCases/{caseId}/childSafetyDecisions/{decisionId}': ChildSafetyDecisionV1Schema,
  'childSafetyCases/{caseId}/childSafetyDecisions/{decisionId}/childSafetyDecisionViews/{viewId}':
    ChildSafetyDecisionViewV1Schema,
  'childSafetyCases/{caseId}/childSafetyCaseAccounts/{uid}': ChildSafetyCaseAccountV1Schema,
  'childSafetyCases/{caseId}/childSafetyCaseAccounts/{uid}/childSafetyCaseAccountHistory/{historyId}':
    ChildSafetyCaseAccountHistoryV1Schema,
  'childSafetyCases/{caseId}/childSafetyCaseCrossoverItems/{mediaAssetId}':
    ChildSafetyCrossoverItemV1Schema,
  'childSafetyCases/{caseId}/ncmecSubmissions/{submissionId}': ChildSafetyNcmecSubmissionV1Schema,
  'childSafetyCases/{caseId}/ncmecSubmissions/{submissionId}/ncmecSubmissionFiles/{fileId}':
    ChildSafetyNcmecSubmissionFileV1Schema,
  'childSafetyCases/{caseId}/ncmecSubmissions/{submissionId}/ncmecCompletionProof/record':
    NcmecCompletionProofRecordV1Schema,
  'childSafetyCases/{caseId}/legalProcess/{eventId}': ChildSafetyLegalProcessEventV1Schema,
  'childSafetyCases/{caseId}/portalReceiptArtifacts/{artifactId}':
    NcmecPortalReceiptArtifactV1Schema,
  'childSafetyCases/{caseId}/ncmecPortalCorrections/{correctionId}':
    NcmecPortalCorrectionRecordV1Schema,
  'childSafetyOwningAliases/{aliasId}': ChildSafetyOwningAliasV1Schema,

  'safetyHoldRefs/{holdRefId}': SafetyHoldRefV1Schema,
  'safetyHoldResources/{resourceKeyHash}': SafetyHoldResourceV1Schema,
  'safetyResourceCommands/{commandDocId}': SafetyResourceCommandV1Schema,
  'safetyResourceCommands/{commandDocId}/authorizedRequests/{requestId}':
    SafetyResourceCommandAuthorizedRequestV1Schema,
  'safetyResourceCommands/{commandDocId}/bypassRefs/{refId}':
    SafetyResourceCommandBypassRefV1Schema,

  'safetyEvidenceManifests/{manifestId}': SafetyEvidenceManifestV1Schema,
  'safetyEvidenceJobs/{jobId}': SafetyEvidenceJobV1Schema,
  'safetyEvidenceJobs/{jobId}/safetyEvidenceJobItems/{itemId}': SafetyEvidenceJobItemDocV1Schema,
  'safetyEvidenceJobs/{jobId}/safetyEvidenceJobDisposition/{locationId}':
    SafetyEvidenceDispositionV1Schema,
  'eventProvenance/{eventId}': EventProvenanceV1Schema,

  'quarantineSagaJobs/{caseId}': QuarantineSagaJobV1Schema,
  'quarantineSagaJobs/{caseId}/relatedAssets/{assetId}': QuarantineSagaRelatedAssetV1Schema,
  'ncmecSubmissionJobs/{ncmecJobId}': NcmecSubmissionJobV1Schema,
  'accountActionCommands/{accountActionCommandId}': AccountActionCommandV1Schema,

  'safetySlaMonitors/{monitorId}': SafetySlaMonitorV1Schema,
  'safetyMonitorHeartbeat/global': SafetyMonitorHeartbeatV1Schema,

  'ageAttestationNonces/{nonceHash}': AgeAttestationNonceV1Schema,

  'operatorStepUp/{uid}': OperatorStepUpSchema,

  'sweepState/{sweepName}': SweepStateSchema,

  'nciiAllegations/{allegationId}': NciiAllegationV1Schema,
  'takeItDownRequests/{requestId}': TakeItDownRequestRootV1Schema,
  'takeItDownRequests/{requestId}/privateDetails/requester': TakeItDownRequesterPrivateV1Schema,
  'takeItDownRequests/{requestId}/takeItDownSubmissions/{submissionId}':
    TakeItDownSubmissionV1Schema,
  'takeItDownRequests/{requestId}/validityDecisions/{decisionId}':
    TakeItDownValidityDecisionV1Schema,
  'takeItDownRequests/{requestId}/validityDecisions/{decisionId}/takeItDownValidityRationale/record':
    TakeItDownValidityRationaleV1Schema,
  'takeItDownRequests/{requestId}/takeItDownActions/{actionId}': TakeItDownRequestActionV1Schema,
  'takeItDownRequests/{requestId}/takeItDownEvidenceDisposition/{evidenceId}':
    SafetyEvidenceDispositionV1Schema,
  'takeItDownRequests/{requestId}/takeItDownEvidence/{evidenceId}': TakeItDownEvidenceV1Schema,
  'nciiCases/{caseId}': NciiCaseV1Schema,
  'nciiCases/{caseId}/allegationLinks/{allegationId}': NciiCaseAllegationLinkV1Schema,
  'nciiCases/{caseId}/requestLinks/{requestId}': NciiCaseRequestLinkV1Schema,
  'nciiCases/{caseId}/removalActions/{actionId}': NciiCaseRemovalActionV1Schema,
  'nciiCases/{caseId}/blockedHashes/{hashId}': NciiBlockedHashV1Schema,
  'nciiCases/{caseId}/closureEvents/{eventId}': NciiCaseClosureEventV1Schema,
  'nciiRetainedEvidenceInventory/{inventoryId}': NciiRetainedEvidenceInventoryV1Schema,
  'nciiInventoryDeadLetter/{inventoryId}': NciiRetainedEvidenceInventoryV1Schema,
  'nciiTemporaryHolds/{holdId}': NciiTemporaryHoldV1Schema,
  'nciiRemovalJobs/{jobId}': NciiRemovalJobV1Schema,
  'nciiRemovalJobs/{jobId}/nciiRemovalTargets/{targetKeyHash}': NciiRemovalTargetV1Schema,

  '_appConfig/app': AppConfigSchema,
  '_appConfig/futurePlans': PUBLIC_DOCUMENT_PROJECTIONS.futurePlans.schema,
  '_appConfig/rulesAndAgreements': PUBLIC_DOCUMENT_PROJECTIONS.rulesAndAgreements.schema,
  '_appConfig/termsOfService': PUBLIC_DOCUMENT_PROJECTIONS.termsOfService.schema,
  '_appConfig/privacyPolicy': PUBLIC_DOCUMENT_PROJECTIONS.privacyPolicy.schema,
  '_appConfig/takeItDownPageCopy': PUBLIC_DOCUMENT_PROJECTIONS.takeItDownPageCopy.schema,
  '_appConfig/dmcaPolicy': PUBLIC_DOCUMENT_PROJECTIONS.dmcaPolicy.schema,
  '_appConfig/systemUidSlots': SystemUidSlotsDocumentSchema,

  '_serverData/agePolicy': AgePolicyConfigV1Schema,
  '_serverData/nciiPolicy': NciiPolicyConfigV1Schema,
  '_serverData/privilegedReviewerSecurity': PrivilegedReviewerSecurityProfileV1Schema,
  '_serverData/feedbackLists/feedbackAliases/{aliasId}': FeedbackAliasSchema,

  '_systemData/adminList': AdminListSchema,
  '_systemData/profanityList': ProfanityListSchema,
  '_systemData/reservedUsernames': ReservedUsernamesSchema,
  '_systemData/blockedFranchiseNames': BlockedFranchiseNamesSchema,
  '_systemData/appMode': AppModeMarkerSchema,
  '_systemData/systemVideoSlots': SystemVideoSlotsDocumentSchema,
} as const satisfies Record<string, z.ZodTypeAny>;

export type RegisteredCollectionPath = keyof typeof COLLECTION_SCHEMAS;

export const COLLECTION_DOC_ID_FIELDS = {
  'allWorkProjects/{workProjectId}/workProjectTales/{taleId}': 'uid',
  'allWorkProjects/{workProjectId}/workProjectTales/{taleId}/taleChapters/{chapterId}': 'uid',
  'allWorkProjects/{workProjectId}/workProjectTunes/{tuneId}': 'uid',
  'allWorkProjects/{workProjectId}/workProjectTunes/{tuneId}/tuneTracks/{trackId}': 'uid',
  'allWorkProjects/{workProjectId}/workProjectTelevision/{televisionId}': 'uid',
  'allWorkProjects/{workProjectId}/workProjectTelevision/{televisionId}/televisionEpisodes/{episodeId}':
    'uid',
  'allWorkProjects/{workProjectId}/guildChatChannels/{guildChatChannelId}': 'guildChatChannelId',
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

export const PENDING_COLLECTION_PATHS = {
  feedbackDenylist: '_serverData/feedbackLists/feedbackDenylist/{deniedWord}',
} as const;

export const PENDING_COLLECTIONS: readonly string[] = Object.keys(PENDING_COLLECTION_PATHS);
