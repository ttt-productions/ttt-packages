// The account-erasure fate of every registered Firestore path — what erasing one member does to
// the documents there that belong to or name them. TOTAL over COLLECTION_SCHEMAS, so a new
// collection cannot be registered without declaring its fate; the erasure scrub and the published
// deletion policy both follow it.
//
// A path listing two fates splits by the per-document rule written at its entry. Every
// destructive fate is subject to the scrub's hold carve-out: a document under a safety hold is left
// untouched and the erasure stays incomplete until the hold is released.

import { z } from 'zod';
import type { AdminDispatch } from './messaging.js';
import type { RegisteredCollectionPath } from './registry.js';

/**
 * - `delete` — the member's documents there are deleted; a media asset is retired (its bytes
 *   removed, its doc tombstoned).
 * - `anonymize` — kept, with the member's identity rewritten in place (the Former Member identity,
 *   the chat tombstone, `reporterUid: 'erased'`, blanked personal fields).
 * - `retain` — kept unchanged; a uid it holds renders as Former Member through the anonymized
 *   public mirror.
 * - `none` — no document there belongs to or names a member.
 */
export const ERASURE_FATES = ['delete', 'anonymize', 'retain', 'none'] as const;
export const ErasureFateSchema = z.enum(ERASURE_FATES);
export type ErasureFate = z.infer<typeof ErasureFateSchema>;

type ErasureFates = readonly [ErasureFate, ...ErasureFate[]];

const DELETE = ['delete'] as const;
const ANONYMIZE = ['anonymize'] as const;
const RETAIN = ['retain'] as const;
const NONE = ['none'] as const;
/** A Work-owned path: deleted with a solo unpublished draft Work, retained on any other Work. */
const SOLO_DRAFT_WORK = ['delete', 'retain'] as const;

export const ERASURE_FATES_BY_COLLECTION_PATH = {
  // ===== The member's own account =====
  'userProfiles/{userId}': ANONYMIZE,
  'userProfiles/{userId}/privateData/{userId}': DELETE,
  // Viewing history, resume points, and watchlist.
  'userProfiles/{userId}/privateData/hallLibraryPreferences': DELETE,
  'userProfiles/{userId}/profileCraftSkills/{craftSkillId}': DELETE,
  'userProfiles/{userId}/auditionVotes/{auditionId}': DELETE,
  'userProfiles/{userId}/mentionHistory/{docId}': DELETE,
  'userProfiles/{userId}/notificationHistory/{notificationId}': DELETE,
  // The member's like history; the like counts on posts stay.
  'userProfiles/{userId}/userLikes/likeHistory/squareStreetzLikes/{postId}': DELETE,
  'publicUsers/{uid}': ANONYMIZE,
  'reservedDisplayNames/{displayNameUppercase}': DELETE,
  // The compliance record of the erasure itself: kept permanently, account id only.
  'accountDeletionRequests/{uid}': RETAIN,
  // No scrub step: the account-status drain deletes the entry on its next run, once the Auth user is gone.
  'statusReconcileQueue/{uid}': DELETE,
  'ageAttestationNonces/{nonceHash}': RETAIN,

  // ===== Work / Realm / Guild =====
  'allWorkProjects/{workProjectId}': SOLO_DRAFT_WORK,
  // Otherwise the membership is kept as `departed`.
  'allWorkProjects/{workProjectId}/guildmateUsers/{uid}': SOLO_DRAFT_WORK,
  'allWorkProjects/{workProjectId}/publicGuildmateUsers/{uid}': SOLO_DRAFT_WORK,
  'allWorkProjects/{workProjectId}/workFileFolders/{workFileFolderId}': SOLO_DRAFT_WORK,
  'allWorkProjects/{workProjectId}/workFileFolders/{workFileFolderId}/workFiles/{workFileId}': SOLO_DRAFT_WORK,
  'allWorkProjects/{workProjectId}/hallSubmissionReservation/reservation': SOLO_DRAFT_WORK,
  'allWorkProjects/{workProjectId}/workProjectTales/{taleId}': SOLO_DRAFT_WORK,
  'allWorkProjects/{workProjectId}/workProjectTales/{taleId}/taleChapters/{chapterId}': SOLO_DRAFT_WORK,
  'allWorkProjects/{workProjectId}/workProjectTunes/{tuneId}': SOLO_DRAFT_WORK,
  'allWorkProjects/{workProjectId}/workProjectTunes/{tuneId}/tuneTracks/{trackId}': SOLO_DRAFT_WORK,
  'allWorkProjects/{workProjectId}/workProjectTelevision/{televisionId}': SOLO_DRAFT_WORK,
  'allWorkProjects/{workProjectId}/workProjectTelevision/{televisionId}/televisionEpisodes/{episodeId}': SOLO_DRAFT_WORK,
  'allWorkProjects/{workProjectId}/guildChatChannels/{guildChatChannelId}': SOLO_DRAFT_WORK,
  'publicWorkProjects/{workProjectId}': SOLO_DRAFT_WORK,
  // Deleted with a draft Realm the solo draft founded and no other Work joined.
  'workRealms/{workRealmId}': SOLO_DRAFT_WORK,
  'reservedRealmNames/{workingTitleUppercase}': SOLO_DRAFT_WORK,
  'workRealms/{workRealmId}/realmFileFolders/{realmFileFolderId}': RETAIN,
  // The two parties' invite, and how a guildmate joined with stake: an open invite is closed
  // (cancelled or declined) and every invite is kept, the member shown as Former Member.
  'guildInviteConversations/{guildInviteId}': RETAIN,
  // A file the member uploaded is deleted, its bytes retired first (only its uploader controls it);
  // a file the other party uploaded is theirs and stays.
  'guildInviteConversations/{guildInviteId}/conversationFiles/{conversationFileId}': ['delete', 'retain'],
  'thresholdItems/{thresholdItemId}': SOLO_DRAFT_WORK,
  'hallItems/{hallItemId}': NONE,
  'hallItems/{hallItemId}/hallItemTales/{itemId}': NONE,
  'hallItems/{hallItemId}/hallItemTunes/{itemId}': NONE,
  'hallItems/{hallItemId}/hallItemTelevision/{itemId}': NONE,
  // The Work's record — every guildmate reads it and it holds the target's one open request; the
  // proposer renders as Former Member, and a pending request stays open for the admin to decide.
  'hallContentChangeRequests/{changeRequestId}': RETAIN,

  // ===== Square / Social =====
  'squareStreetzFeed/activePosts/socialPosts/{postId}': DELETE,
  'squareStreetzFeed/trendingPosts': NONE,
  // Both directions; each outbound edge decrements its target's count.
  'followEdges/{followEdgeId}': DELETE,
  // The member's own counter; other members' counters name no one.
  'followCounters/{followCounterId}': DELETE,
  // A job whose post the member would author is deleted in every status, so no pending, stale, or
  // replayed job posts under the erased account; a Work-authored announcement is retained.
  'squareAnnouncementJobs/{jobId}': ['delete', 'retain'],
  'craftSkillsByTag/{tag}/taggedCraftSkills/{compositeId}': DELETE,

  // ===== Commission / Audition =====
  // A posting belongs to its Work; its creator renders as Former Member.
  'commissionListings/{commissionListingId}': RETAIN,
  'commissionListings/{commissionListingId}/commissionProposals/{commissionProposalId}': DELETE,
  'auditionBoard/{auditionId}': RETAIN,
  'auditionBoard/{auditionId}/auditionEntries/{auditionEntryId}': DELETE,

  // ===== Payments =====
  'pledgePayments/{pledgePaymentId}': RETAIN,
  // Money, dispute, and checkout-consent evidence, and the money ledger's integrity record: each kept
  // for as long as the pledge ledger it serves.
  'pledgePaymentProviderRefs/{pledgePaymentId}': RETAIN,
  'processedStripeEvents/{stripeEventId}': NONE,
  'pledgePaymentLedgerEvents/{ledgerId}': RETAIN,
  'paymentWebhookQuarantine/{stripeEventId}': RETAIN,
  'pledgePaymentTotals/summary': NONE,
  // Money and chargeback evidence, kept account-id only for as long as the pledge ledger.
  'pledgeRefundRequests/{requestId}': RETAIN,

  // ===== Reports / moderation / admin =====
  // A report the member filed: an ordinary report's reporter is anonymized; a report that opened a
  // child-safety or NCII case is retained with the case. A report someone else filed about the
  // member is theirs and the evidence behind a decision: retained, the member an account id, with
  // its frozen evidence snapshot.
  'contentReports/{reportId}': ['anonymize', 'retain'],
  'contentReports/{reportId}/publicProjection/{reportId}': NONE,
  'contentReports/{reportId}/privateDetails/snapshot': RETAIN,
  // Ordinary report: deleted. Protected-case report: retained with the case.
  'contentReports/{reportId}/privateDetails/narrative': ['delete', 'retain'],
  'contentReports/{reportId}/privateDetails/narrativeEscalation': RETAIN,
  'activeReportGroups/{groupKey}': RETAIN,
  'activeReportGroups/{groupKey}/reportGroupCountedReports/{reportId}': NONE,
  // The member's appeal task, a solo draft's review task, and an own support thread's task are
  // deleted with their source; every other task is retained.
  'adminTasks/{taskId}': ['delete', 'retain'],
  'contentViolations/{violationId}': DELETE,
  'moderationCascadeManifests/{cascadeId}': RETAIN,
  'moderationCascadeManifests/{cascadeId}/changedDocs/{changedDocId}': RETAIN,
  'auditEvents/{eventId}': RETAIN,
  'stakeShareAuditEvents/{eventId}': RETAIN,
  // By `adminDispatchErasureFate`.
  'pendingAdminDispatches/{adminDispatchId}': ['delete', 'anonymize'],
  'pendingAdminDispatches/{adminDispatchId}/conversationMessages/{adminDispatchMessageId}': ['delete', 'anonymize'],
  // Deleted with a deleted thread; a kept thread keeps its files.
  'pendingAdminDispatches/{adminDispatchId}/conversationFiles/{conversationFileId}': ['delete', 'retain'],
  // A link others may already have shared; its creator is an account id only.
  'shortLinks/{shortId}': RETAIN,
  // A suggestion is shared by everyone who sent the same word: the member is removed from its
  // submitter list, and the suggestion and its count stay.
  'feedbackSubmissions/{feedbackType}/userSuggestions/{suggestionId}': ANONYMIZE,

  // ===== Media pipeline =====
  // A rejected upload's row is deleted with its violation; every other row is kept as an operational
  // record with its personal fields blanked and its staged original deleted, and a row still in
  // flight is made terminal so its activation job aborts instead of publishing.
  'pendingMedia/{pendingMediaId}': ['delete', 'anonymize'],
  'pendingMediaArchive/{pendingMediaId}': ['delete', 'anonymize'],
  // The member's own media is retired; media a Work owns is retained with the Work.
  'mediaAssets/{mediaAssetId}': ['delete', 'retain'],
  // A job for the member's in-flight upload aborts through that upload's terminal row and is kept
  // as its closed record; every other job is retained.
  'mediaActivationJobs/{jobId}': RETAIN,
  'mediaCopyIntents/{newAssetId}': NONE,

  // ===== Notifications =====
  // Every notification sent to the member — its card, its delivery row in any state, its archive
  // job — is deleted. Another recipient's notification naming the member as actor is theirs: it is
  // kept, account id only, until its existing expiry. Admin cards are shared by the admin team, so
  // they only ever name the member as actor.
  'activeUserNotifications/{notificationId}': ['delete', 'retain'],
  'activeAdminNotifications/{notificationId}': RETAIN,
  'adminNotificationHistory/{notificationId}': RETAIN,
  'pendingNotifications/{notificationId}': ['delete', 'retain'],
  'notificationDeliveries/{deliveryId}': ['delete', 'retain'],
  'notificationFanoutJobs/{jobId}': RETAIN,
  'notificationArchiveAllJobs/{jobId}': DELETE,

  // ===== Chat sync =====
  // Deleted LAST — after both chat legs are done, because their discovery reads these rows — so
  // no kept row re-seeds the member into a channel's membership.
  'chatChannelAuthProjections/{authPairKey}': DELETE,
  'chatScopeDegraded/{scopeKey}': RETAIN,
  'chatScopeDegraded/{scopeKey}/chatScopeDegradedCauses/{causeId}': RETAIN,
  'chatSyncEvents/{eventId}': RETAIN,
  'chatSyncFanoutJobs/{jobId}': RETAIN,
  // Every unapplied opening message the member sent — pending or dead-lettered, whatever its
  // invite's state — is deleted before the live-chat leg, so it is never delivered under the erased
  // account (never seen, so nothing a kept conversation shows is lost); an applied row is retained
  // until its expiry.
  'chatMessageOutbox/{commandId}': ['delete', 'retain'],
  'chatAdminActionCommands/{requestId}': RETAIN,
  // The erasure's own anonymization work: the erasure completes only once every job for the member
  // is done; a done job is retained until its expiry.
  'chatHistoryAnonymizationJobs/{jobId}': RETAIN,
  'chatHistoryAnonymizationJobs/{jobId}/affectedChunks/{chunkOrdinal}': NONE,

  // ===== Public documents (admin-written) =====
  'publicDocuments/{documentId}/publicDocumentVersions/{versionId}': RETAIN,
  'publicDocumentDrafts/{documentId}': RETAIN,
  'publicDocumentReleases/{releaseId}': RETAIN,

  // ===== Trust & Safety — retained under the safety evidence profile =====
  'childSafetyCaseList/{caseId}': RETAIN,
  'activeSafetyCaseAlerts/{caseId}': RETAIN,
  'childSafetyCases/{caseId}': RETAIN,
  'childSafetyCases/{caseId}/sourceSignals/{signalId}': RETAIN,
  'childSafetyCases/{caseId}/childSafetyDecisions/{decisionId}': RETAIN,
  'childSafetyCases/{caseId}/childSafetyDecisions/{decisionId}/childSafetyDecisionViews/{viewId}': RETAIN,
  'childSafetyCases/{caseId}/childSafetyCaseAccounts/{uid}': RETAIN,
  'childSafetyCases/{caseId}/childSafetyCaseAccounts/{uid}/childSafetyCaseAccountHistory/{historyId}': RETAIN,
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
  // The `reportSubmit` row of an ordinary report the member filed is deleted; a protected-case
  // report's row is retained with the case, and a routine upload row for its existing 90-day window.
  'eventProvenance/{eventId}': ['delete', 'retain'],
  'quarantineSagaJobs/{caseId}': RETAIN,
  'quarantineSagaJobs/{caseId}/relatedAssets/{assetId}': RETAIN,
  'ncmecSubmissionJobs/{ncmecJobId}': RETAIN,
  'accountActionCommands/{accountActionCommandId}': RETAIN,
  'safetySlaMonitors/{monitorId}': NONE,
  'safetyMonitorHeartbeat/global': NONE,
  // An admin's live step-up secret: no reader once the account is gone, and every enrollment and
  // verification is already recorded in the audit log.
  'operatorStepUp/{uid}': DELETE,
  'sweepState/{sweepName}': NONE,
  'nciiAllegations/{allegationId}': RETAIN,
  'takeItDownRequests/{requestId}': RETAIN,
  'takeItDownRequests/{requestId}/privateDetails/requester': RETAIN,
  'takeItDownRequests/{requestId}/takeItDownSubmissions/{submissionId}': RETAIN,
  'takeItDownRequests/{requestId}/validityDecisions/{decisionId}': RETAIN,
  'takeItDownRequests/{requestId}/validityDecisions/{decisionId}/takeItDownValidityRationale/record': RETAIN,
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

  // ===== Singletons =====
  '_appConfig/app': NONE,
  '_appConfig/futurePlans': NONE,
  '_appConfig/rulesAndAgreements': NONE,
  '_appConfig/termsOfService': NONE,
  '_appConfig/privacyPolicy': NONE,
  '_appConfig/takeItDownPageCopy': NONE,
  '_appConfig/dmcaPolicy': NONE,
  '_serverData/agePolicy': NONE,
  '_serverData/nciiPolicy': RETAIN,
  '_serverData/privilegedReviewerSecurity': NONE,
  '_serverData/feedbackLists/feedbackAliases/{aliasId}': NONE,
  // An erased admin is removed from the roster through the roster core.
  '_systemData/adminList': ANONYMIZE,
  '_systemData/profanityList': NONE,
  '_systemData/reservedUsernames': NONE,
  '_systemData/blockedFranchiseNames': NONE,
  '_systemData/appMode': NONE,
} as const satisfies { readonly [P in RegisteredCollectionPath]: ErasureFates };

/** Every registered path whose declared fates include `fate`. */
export function collectionPathsWithErasureFate(fate: ErasureFate): RegisteredCollectionPath[] {
  return (Object.keys(ERASURE_FATES_BY_COLLECTION_PATH) as RegisteredCollectionPath[]).filter((path) =>
    (ERASURE_FATES_BY_COLLECTION_PATH[path] as ErasureFates).includes(fate),
  );
}

/**
 * The fate of a support thread that names the member being erased. Only the member's OWN user-party
 * thread — one they started, as its user — is theirs alone: it is deleted with its messages and
 * files. Every other thread naming them is kept with them shown as Former Member: one the admin
 * team started to them, a Work thread they started, and another member's thread they took part in
 * (an erased admin's replies never delete a member's thread).
 */
export function adminDispatchErasureFate(
  thread: Pick<AdminDispatch, 'partyKind' | 'initiatedBy' | 'userId'>,
  erasedUid: string,
): Extract<ErasureFate, 'delete' | 'anonymize'> {
  return thread.partyKind === 'user' && thread.initiatedBy === 'user' && thread.userId === erasedUid
    ? 'delete'
    : 'anonymize';
}
