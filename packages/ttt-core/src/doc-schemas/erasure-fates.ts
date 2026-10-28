import { z } from 'zod';
import type { AdminDispatch } from './messaging.js';
import type { RegisteredCollectionPath } from './registry.js';

export const ERASURE_FATES = ['delete', 'anonymize', 'retain', 'none'] as const;
export const ErasureFateSchema = z.enum(ERASURE_FATES);
export type ErasureFate = z.infer<typeof ErasureFateSchema>;

type ErasureFates = readonly [ErasureFate, ...ErasureFate[]];

const DELETE = ['delete'] as const;
const ANONYMIZE = ['anonymize'] as const;
const RETAIN = ['retain'] as const;
const NONE = ['none'] as const;
const SOLO_DRAFT_WORK = ['delete', 'retain'] as const;

export const ERASURE_FATES_BY_COLLECTION_PATH = {
  'userProfiles/{userId}': ANONYMIZE,
  'userProfiles/{userId}/privateData/{userId}': DELETE,
  'userProfiles/{userId}/privateData/hallLibraryPreferences': DELETE,
  'userProfiles/{userId}/profileCraftSkills/{craftSkillId}': DELETE,
  'userProfiles/{userId}/auditionVotes/{auditionId}': DELETE,
  'userProfiles/{userId}/mentionHistory/{docId}': DELETE,
  'userProfiles/{userId}/notificationHistory/{notificationId}': DELETE,
  'userProfiles/{userId}/userLikes/likeHistory/squareStreetzLikes/{postId}': DELETE,
  'publicUsers/{uid}': ANONYMIZE,
  'reservedDisplayNames/{displayNameUppercase}': DELETE,
  'accountDeletionRequests/{uid}': RETAIN,
  'statusReconcileQueue/{uid}': DELETE,
  'adminDispatchAppealLocks/{uid}': DELETE,
  'ageAttestationNonces/{nonceHash}': RETAIN,

  'allWorkProjects/{workProjectId}': SOLO_DRAFT_WORK,
  'allWorkProjects/{workProjectId}/guildmateUsers/{uid}': SOLO_DRAFT_WORK,
  'allWorkProjects/{workProjectId}/publicGuildmateUsers/{uid}': SOLO_DRAFT_WORK,
  'allWorkProjects/{workProjectId}/workFileFolders/{workFileFolderId}': SOLO_DRAFT_WORK,
  'allWorkProjects/{workProjectId}/workFileFolders/{workFileFolderId}/workFiles/{workFileId}':
    SOLO_DRAFT_WORK,
  'allWorkProjects/{workProjectId}/hallSubmissionReservation/reservation': SOLO_DRAFT_WORK,
  'allWorkProjects/{workProjectId}/workProjectTales/{taleId}': SOLO_DRAFT_WORK,
  'allWorkProjects/{workProjectId}/workProjectTales/{taleId}/taleChapters/{chapterId}':
    SOLO_DRAFT_WORK,
  'allWorkProjects/{workProjectId}/workProjectTunes/{tuneId}': SOLO_DRAFT_WORK,
  'allWorkProjects/{workProjectId}/workProjectTunes/{tuneId}/tuneTracks/{trackId}': SOLO_DRAFT_WORK,
  'allWorkProjects/{workProjectId}/workProjectTelevision/{televisionId}': SOLO_DRAFT_WORK,
  'allWorkProjects/{workProjectId}/workProjectTelevision/{televisionId}/televisionEpisodes/{episodeId}':
    SOLO_DRAFT_WORK,
  'allWorkProjects/{workProjectId}/guildChatChannels/{guildChatChannelId}': SOLO_DRAFT_WORK,
  'publicWorkProjects/{workProjectId}': SOLO_DRAFT_WORK,
  'workRealms/{workRealmId}': SOLO_DRAFT_WORK,
  'reservedRealmNames/{workingTitleUppercase}': SOLO_DRAFT_WORK,
  'workRealms/{workRealmId}/realmFileFolders/{realmFileFolderId}': RETAIN,
  'guildInviteConversations/{guildInviteId}': RETAIN,
  'guildInviteConversations/{guildInviteId}/conversationFiles/{conversationFileId}': [
    'delete',
    'retain',
  ],
  'thresholdItems/{thresholdItemId}': SOLO_DRAFT_WORK,
  'hallItems/{hallItemId}': NONE,
  'hallItems/{hallItemId}/hallItemTales/{itemId}': NONE,
  'hallItems/{hallItemId}/hallItemTunes/{itemId}': NONE,
  'hallItems/{hallItemId}/hallItemTelevision/{itemId}': NONE,
  'hallContentChangeRequests/{changeRequestId}': RETAIN,
  'hallContentChangeRequestLocks/{targetKey}': NONE,

  'squareStreetzFeed/activePosts/socialPosts/{postId}': DELETE,
  'squareStreetzFeed/trendingPosts': NONE,
  'followEdges/{followEdgeId}': DELETE,
  'followCounters/{followCounterId}': DELETE,
  'squareAnnouncementJobs/{jobId}': ['delete', 'retain'],
  'craftSkillsByTag/{tag}/taggedCraftSkills/{compositeId}': DELETE,

  'commissionListings/{commissionListingId}': RETAIN,
  'commissionListings/{commissionListingId}/commissionProposals/{commissionProposalId}': DELETE,
  'auditionBoard/{auditionId}': RETAIN,
  'auditionBoard/{auditionId}/auditionEntries/{auditionEntryId}': DELETE,

  'pledgePayments/{pledgePaymentId}': RETAIN,
  'pledgePaymentProviderRefs/{pledgePaymentId}': RETAIN,
  'processedStripeEvents/{stripeEventId}': NONE,
  'pledgePaymentLedgerEvents/{ledgerId}': RETAIN,
  'paymentWebhookQuarantine/{stripeEventId}': RETAIN,
  'pledgePaymentTotals/summary': NONE,
  'pledgeRefundRequests/{requestId}': RETAIN,

  'contentReports/{reportId}': ['anonymize', 'retain'],
  'contentReports/{reportId}/publicProjection/{reportId}': NONE,
  'contentReports/{reportId}/privateDetails/snapshot': RETAIN,
  'contentReports/{reportId}/privateDetails/narrative': ['delete', 'retain'],
  'contentReports/{reportId}/privateDetails/narrativeEscalation': RETAIN,
  'activeReportGroups/{groupKey}': RETAIN,
  'activeReportGroups/{groupKey}/reportGroupCountedReports/{reportId}': NONE,
  'adminTasks/{taskId}': ['delete', 'retain'],
  'contentViolations/{violationId}': DELETE,
  'moderationCascadeManifests/{cascadeId}': RETAIN,
  'moderationCascadeManifests/{cascadeId}/changedDocs/{changedDocId}': RETAIN,
  'auditEvents/{eventId}': RETAIN,
  'stakeShareAuditEvents/{eventId}': RETAIN,
  'pendingAdminDispatches/{adminDispatchId}': ['delete', 'anonymize'],
  'pendingAdminDispatches/{adminDispatchId}/conversationMessages/{adminDispatchMessageId}': [
    'delete',
    'anonymize',
  ],
  'pendingAdminDispatches/{adminDispatchId}/conversationFiles/{conversationFileId}': [
    'delete',
    'retain',
  ],
  'pendingAdminDispatches/{adminDispatchId}/dispatchReadMarkers/{uid}': DELETE,
  'shortLinks/{shortId}': RETAIN,
  'feedbackSubmissions/{feedbackType}/userSuggestions/{suggestionId}': ANONYMIZE,

  'pendingMedia/{pendingMediaId}': ['delete', 'anonymize'],
  'pendingMediaArchive/{pendingMediaId}': ['delete', 'anonymize'],
  'mediaAssets/{mediaAssetId}': ['delete', 'retain'],
  'mediaActivationJobs/{jobId}': RETAIN,
  'mediaCopyIntents/{newAssetId}': NONE,

  'activeUserNotifications/{notificationId}': ['delete', 'retain'],
  'activeAdminNotifications/{notificationId}': RETAIN,
  'adminNotificationHistory/{notificationId}': RETAIN,
  'pendingNotifications/{notificationId}': ['delete', 'retain'],
  'notificationDeliveries/{deliveryId}': ['delete', 'retain'],
  'notificationFanoutJobs/{jobId}': RETAIN,
  'notificationArchiveAllJobs/{jobId}': DELETE,

  'chatChannelAuthProjections/{authPairKey}': DELETE,
  'chatScopeDegraded/{scopeKey}': RETAIN,
  'chatScopeDegraded/{scopeKey}/chatScopeDegradedCauses/{causeId}': RETAIN,
  'chatSyncEvents/{eventId}': RETAIN,
  'chatSyncFanoutJobs/{jobId}': RETAIN,
  'chatMessageOutbox/{commandId}': ['delete', 'retain'],
  'chatAdminActionCommands/{requestId}': RETAIN,
  'chatHistoryAnonymizationJobs/{jobId}': RETAIN,
  'chatHistoryAnonymizationJobs/{jobId}/affectedChunks/{chunkOrdinal}': NONE,
  'chatParkedDeliveries/{deliveryId}': RETAIN,

  'publicDocuments/{documentId}/publicDocumentVersions/{versionId}': RETAIN,
  'publicDocumentDrafts/{documentId}': RETAIN,
  'publicDocumentReleases/{releaseId}': RETAIN,

  'childSafetyCaseList/{caseId}': RETAIN,
  'activeSafetyCaseAlerts/{caseId}': RETAIN,
  'childSafetyCases/{caseId}': RETAIN,
  'childSafetyCases/{caseId}/sourceSignals/{signalId}': RETAIN,
  'childSafetyCases/{caseId}/childSafetyDecisions/{decisionId}': RETAIN,
  'childSafetyCases/{caseId}/childSafetyDecisions/{decisionId}/childSafetyDecisionViews/{viewId}':
    RETAIN,
  'childSafetyCases/{caseId}/childSafetyCaseAccounts/{uid}': RETAIN,
  'childSafetyCases/{caseId}/childSafetyCaseAccounts/{uid}/childSafetyCaseAccountHistory/{historyId}':
    RETAIN,
  'childSafetyCases/{caseId}/childSafetyCaseCrossoverItems/{mediaAssetId}': RETAIN,
  'childSafetyCases/{caseId}/ncmecSubmissions/{submissionId}': RETAIN,
  'childSafetyCases/{caseId}/ncmecSubmissions/{submissionId}/ncmecSubmissionFiles/{fileId}': RETAIN,
  'childSafetyCases/{caseId}/ncmecSubmissions/{submissionId}/ncmecCompletionProof/record': RETAIN,
  'childSafetyCases/{caseId}/legalProcess/{eventId}': RETAIN,
  'childSafetyCases/{caseId}/portalReceiptArtifacts/{artifactId}': RETAIN,
  'childSafetyCases/{caseId}/ncmecPortalCorrections/{correctionId}': RETAIN,
  'childSafetyOwningAliases/{aliasId}': RETAIN,
  'safetyHoldRefs/{holdRefId}': RETAIN,
  'safetyHoldResources/{resourceKeyHash}': RETAIN,
  'safetyResourceCommands/{commandDocId}': RETAIN,
  'safetyResourceCommands/{commandDocId}/authorizedRequests/{requestId}': RETAIN,
  'safetyResourceCommands/{commandDocId}/bypassRefs/{refId}': RETAIN,
  'safetyEvidenceManifests/{manifestId}': RETAIN,
  'safetyEvidenceJobs/{jobId}': RETAIN,
  'safetyEvidenceJobs/{jobId}/safetyEvidenceJobItems/{itemId}': RETAIN,
  'safetyEvidenceJobs/{jobId}/safetyEvidenceJobDisposition/{locationId}': RETAIN,
  'eventProvenance/{eventId}': ['delete', 'retain'],
  'quarantineSagaJobs/{caseId}': RETAIN,
  'quarantineSagaJobs/{caseId}/relatedAssets/{assetId}': RETAIN,
  'ncmecSubmissionJobs/{ncmecJobId}': RETAIN,
  'accountActionCommands/{accountActionCommandId}': RETAIN,
  'safetySlaMonitors/{monitorId}': NONE,
  'safetyMonitorHeartbeat/global': NONE,
  'operatorStepUp/{uid}': DELETE,
  'sweepState/{sweepName}': NONE,
  'nciiAllegations/{allegationId}': RETAIN,
  'takeItDownRequests/{requestId}': RETAIN,
  'takeItDownRequests/{requestId}/privateDetails/requester': RETAIN,
  'takeItDownRequests/{requestId}/takeItDownSubmissions/{submissionId}': RETAIN,
  'takeItDownRequests/{requestId}/validityDecisions/{decisionId}': RETAIN,
  'takeItDownRequests/{requestId}/validityDecisions/{decisionId}/takeItDownValidityRationale/record':
    RETAIN,
  'takeItDownRequests/{requestId}/takeItDownActions/{actionId}': RETAIN,
  'takeItDownRequests/{requestId}/takeItDownEvidenceDisposition/{evidenceId}': RETAIN,
  'takeItDownRequests/{requestId}/takeItDownEvidence/{evidenceId}': RETAIN,
  'nciiCases/{caseId}': RETAIN,
  'nciiCases/{caseId}/allegationLinks/{allegationId}': RETAIN,
  'nciiCases/{caseId}/requestLinks/{requestId}': RETAIN,
  'nciiCases/{caseId}/removalActions/{actionId}': RETAIN,
  'nciiCases/{caseId}/blockedHashes/{hashId}': RETAIN,
  'nciiCases/{caseId}/closureEvents/{eventId}': RETAIN,
  'nciiRetainedEvidenceInventory/{inventoryId}': RETAIN,
  'nciiInventoryDeadLetter/{inventoryId}': RETAIN,
  'nciiTemporaryHolds/{holdId}': RETAIN,
  'nciiRemovalJobs/{jobId}': RETAIN,
  'nciiRemovalJobs/{jobId}/nciiRemovalTargets/{targetKeyHash}': RETAIN,

  '_appConfig/app': NONE,
  '_appConfig/futurePlans': NONE,
  '_appConfig/rulesAndAgreements': NONE,
  '_appConfig/termsOfService': NONE,
  '_appConfig/privacyPolicy': NONE,
  '_appConfig/takeItDownPageCopy': NONE,
  '_appConfig/dmcaPolicy': NONE,
  '_appConfig/systemUidSlots': RETAIN,
  '_serverData/agePolicy': NONE,
  '_serverData/nciiPolicy': RETAIN,
  '_serverData/feedbackLists/feedbackAliases/{aliasId}': NONE,
  '_systemData/adminList': ANONYMIZE,
  '_systemData/profanityList': NONE,
  '_systemData/reservedUsernames': NONE,
  '_systemData/blockedFranchiseNames': NONE,
  '_systemData/appMode': NONE,
  '_systemData/systemVideoSlots': NONE,
} as const satisfies { readonly [P in RegisteredCollectionPath]: ErasureFates };

export function collectionPathsWithErasureFate(fate: ErasureFate): RegisteredCollectionPath[] {
  return (Object.keys(ERASURE_FATES_BY_COLLECTION_PATH) as RegisteredCollectionPath[]).filter(
    (path) => (ERASURE_FATES_BY_COLLECTION_PATH[path] as ErasureFates).includes(fate),
  );
}

export function adminDispatchErasureFate(
  thread: Pick<AdminDispatch, 'partyKind' | 'initiatedBy' | 'userId'>,
  erasedUid: string,
): Extract<ErasureFate, 'delete' | 'anonymize'> {
  return thread.partyKind === 'user' && thread.initiatedBy === 'user' && thread.userId === erasedUid
    ? 'delete'
    : 'anonymize';
}
