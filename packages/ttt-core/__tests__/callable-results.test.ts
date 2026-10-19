import { describe, expect, it } from 'vitest';
import type { ZodTypeAny } from 'zod';
import {
  AcceptHallDownloadAcknowledgementResultSchema,
  AcceptSquareStreetzAgreementsResultSchema,
  BecomeArtisanCreatorResultSchema,
  MarkNonUsArtisanInterestResultSchema,
  MarkWaitingForNewsApprovalResultSchema,
  SetMyDisplayNameResultSchema,
  SetUserStatusResultSchema,
  ForceDisplayNameResetResultSchema,
  CloseAccountUnder13ResultSchema,
  UpdateSiteTourPreferenceResultSchema,
  UpgradeAccountToAdultResultSchema,
  RequestAccountDeletionInputSchema,
  CancelAccountDeletionInputSchema,
} from '../src/schemas/users.js';
import {
  CreateFileFolderResultSchema,
  RenameFileFolderResultSchema,
  UpdateFolderProfessionsResultSchema,
  DeleteFileFolderResultSchema,
  DeleteWorkFileResultSchema,
  InviteUserToGuildResultSchema,
  LeaveWorkProjectResultSchema,
  UpdateGuildmateStandingResultSchema,
  UpdateGuildmateTradeProfessionsResultSchema,
  UpdatePublicWorkProjectDetailsResultSchema,
  UpdateWorkRealmDetailsResultSchema,
  CheckRealmNameAvailableResultSchema,
} from '../src/schemas/work-project-management.js';
import { ManageWorkProjectStakeSharesResultSchema } from '../src/schemas/stake-share-operation.js';
import {
  ClearHallContentTextResultSchema,
  ClearModerationTextResultSchema,
  HideHallSubItemResultSchema,
  RestoreHallSubItemResultSchema,
  HideWorkProjectResultSchema,
  HideWorkRealmResultSchema,
  RestoreWorkProjectResultSchema,
  RestoreWorkRealmResultSchema,
  RequireRetitleResultSchema,
  ResolveAdminTaskResultSchema,
  UpdateAppConfigResultSchema,
  MarkWorkLaterResultSchema,
  ClearSystemVideoSlotResultSchema,
  UpdateSystemUidSlotResultSchema,
  CheckTrademarkResultSchema,
  GetLatestHideCascadeResultSchema,
  GetPendingGuildInviteCountResultSchema,
  GetPendingGuildInviteCountInputSchema,
} from '../src/schemas/admin.js';
import { CreateAdminDispatchResultSchema } from '../src/schemas/chat.js';
import {
  SeedPublicDocumentResultSchema,
  TrackShortLinkClickResultSchema,
  SubmitFeedbackResultSchema,
  SeedBlockedFranchiseNamesResultSchema,
  SeedReservedUsernamesResultSchema,
  SeedProfanityListResultSchema,
  CreateShortLinkResultSchema,
} from '../src/schemas/utility.js';
import { CloseAuditionResultSchema } from '../src/schemas/auditions.js';
import {
  ConfirmOperatorStepUpResultSchema,
  RecordNcmecPortalReceiptArtifactResultSchema,
  RecordNcmecPortalCorrectionResultSchema,
  EnrollOperatorStepUpResultSchema,
  VerifyOperatorStepUpResultSchema,
  GetSafetyCasePartiesResultSchema,
  RevealCaseEvidenceResultSchema,
  EnrollOperatorStepUpInputSchema,
} from '../src/schemas/safety.js';
import {
  LinkNciiEvidenceToCaseResultSchema,
  UnlinkNciiEvidenceFromCaseResultSchema,
  MarkNciiEvidenceResultSchema,
  ResolveNciiReportPreviewResultSchema,
  SubmitInAppNciiRequestResultSchema,
} from '../src/schemas/ncii.js';
import {
  CreateChapterResultSchema,
  CreateTelevisionEpisodeResultSchema,
  CreateTuneTrackResultSchema,
  ReviewHallContentChangeRequestResultSchema,
  ReviewThresholdItemResultSchema,
  SubmitForThresholdLibraryReviewResultSchema,
  SubmitHallContentChangeRequestResultSchema,
  UpdateChapterDetailsResultSchema,
  UpdateHallInkedWorkResultSchema,
  UpdateHallLibrarySettingsResultSchema,
  UpdateHallPlaybackProgressResultSchema,
  UpdateHallRecentlyViewedResultSchema,
  UpdateHallWorkHiddenResultSchema,
  UpdateTaleWorkGenresResultSchema,
  UpdateTelevisionWorkGenresResultSchema,
  UpdateTuneWorkGenresResultSchema,
  UpdateTelevisionEpisodeDetailsResultSchema,
  UpdateTuneTrackDetailsResultSchema,
  WithdrawFromThresholdLibraryReviewResultSchema,
} from '../src/schemas/hall-library.js';
import {
  CreateNotificationBroadcastResultSchema,
  MarkNotificationsSeenResultSchema,
} from '../src/schemas/notification.js';
import { DeleteConversationFileResultSchema } from '../src/schemas/conversation-files.js';
import {
  RejectCommissionProposalResultSchema,
  SetCommissionProposalSavedResultSchema,
  CloseCommissionResultSchema,
} from '../src/schemas/commissions.js';
import {
  AdminResolvePledgeRefundRequestResultSchema,
  RequestPledgeRefundResultSchema,
  CreateStripeCheckoutSessionResultSchema,
  GetMyPledgeByCheckoutSessionResultSchema,
} from '../src/schemas/payments.js';
import {
  UpdateGuildInviteConfirmationResultSchema,
  UpdateGuildInviteStakeSharesResultSchema,
} from '../src/schemas/admin-dispatch-actions.js';
import {
  ClearUploadActivityResultSchema,
  MarkUploadsSeenResultSchema,
  StartUploadResultSchema,
} from '../src/schemas/uploads.js';

// Each callable's answer is declared once here, so Functions returns it and the app types it from
// the same shape (ARCH-101). Every case is an answer its callable gives; an answer that reports
// success must report it as `success: true`, never a boolean the client could read as a failure.
const ok = { success: true } as const;
const claimed = {
  ...ok,
  hallItemId: 'h1',
  thresholdItemId: 'th1',
  itemId: 'i1',
};

const answers: Array<[name: string, schema: ZodTypeAny, answer: Record<string, unknown>]> = [
  ['acceptHallDownloadAcknowledgement', AcceptHallDownloadAcknowledgementResultSchema, { ...ok, alreadyAccepted: false }],
  ['acceptSquareStreetzAgreements', AcceptSquareStreetzAgreementsResultSchema, { ...ok, alreadyAccepted: true }],
  ['becomeArtisanCreator', BecomeArtisanCreatorResultSchema, { ...ok, alreadyArtisanCreator: false }],
  ['markNonUsArtisanInterest', MarkNonUsArtisanInterestResultSchema, { ...ok, alreadyMarked: false }],
  ['markWaitingForNewsApproval', MarkWaitingForNewsApprovalResultSchema, { ...ok, alreadyMarked: true }],
  ['setMyDisplayName', SetMyDisplayNameResultSchema, ok],
  ['setUserStatus', SetUserStatusResultSchema, { ...ok, message: 'User suspended.', auditEventId: 'a1' }],
  ['forceDisplayNameReset', ForceDisplayNameResetResultSchema, { ...ok, auditEventId: 'a1' }],
  ['closeAccountUnder13', CloseAccountUnder13ResultSchema, { success: true, outcome: 'parked' }],
  ['updateSiteTourPreference', UpdateSiteTourPreferenceResultSchema, ok],
  ['upgradeAccountToAdult', UpgradeAccountToAdultResultSchema, { ...ok, alreadyAdult: false }],
  ['createFileFolder', CreateFileFolderResultSchema, { ...ok, folderId: 'f1' }],
  ['renameFileFolder', RenameFileFolderResultSchema, ok],
  ['updateFolderProfessions', UpdateFolderProfessionsResultSchema, ok],
  ['deleteFileFolder', DeleteFileFolderResultSchema, ok],
  ['deleteWorkFile', DeleteWorkFileResultSchema, ok],
  ['inviteUserToGuild', InviteUserToGuildResultSchema, { ...ok, guildInviteId: 'g1', invitedUsername: 'Ada' }],
  ['leaveWorkProject', LeaveWorkProjectResultSchema, { ...ok, message: 'Left the Work.' }],
  ['manageWorkProjectStakeShares', ManageWorkProjectStakeSharesResultSchema, { ...ok, message: 'Done.' }],
  ['updateGuildmateStanding', UpdateGuildmateStandingResultSchema, ok],
  ['updateGuildmateTradeProfessions', UpdateGuildmateTradeProfessionsResultSchema, ok],
  ['updatePublicWorkProjectDetails', UpdatePublicWorkProjectDetailsResultSchema, ok],
  ['updateWorkRealmDetails', UpdateWorkRealmDetailsResultSchema, ok],
  ['clearHallContentText', ClearHallContentTextResultSchema, ok],
  ['clearWorkProjectText / clearWorkRealmText', ClearModerationTextResultSchema, ok],
  ['createAdminDispatchToUser / ToWorkProject', CreateAdminDispatchResultSchema, { ...ok, adminDispatchId: 'd1' }],
  ['hideHallSubItem', HideHallSubItemResultSchema, ok],
  ['restoreHallSubItem', RestoreHallSubItemResultSchema, ok],
  ['hideWorkProject', HideWorkProjectResultSchema, { ...ok, cascadeId: 'c1' }],
  ['hideWorkRealm', HideWorkRealmResultSchema, { ...ok, cascadeId: 'c1' }],
  ['restoreWorkProject', RestoreWorkProjectResultSchema, ok],
  ['restoreWorkRealm', RestoreWorkRealmResultSchema, ok],
  ['requireWorkProjectRetitle / requireWorkRealmRetitle', RequireRetitleResultSchema, ok],
  ['resolveAdminTask', ResolveAdminTaskResultSchema, { ...ok, auditEventId: 'a1' }],
  ['updateAppConfig', UpdateAppConfigResultSchema, { ...ok, updatedFields: ['maintenanceMode'] }],
  ['markWorkLater', MarkWorkLaterResultSchema, { ...ok, alreadyResolved: true }],
  ['the public-document seeds', SeedPublicDocumentResultSchema, { ...ok, seeded: false, version: 3 }],
  ['clearSystemVideoSlot', ClearSystemVideoSlotResultSchema, { ...ok, cleared: false }],
  ['updateSystemUidSlot', UpdateSystemUidSlotResultSchema, { ...ok, changed: true }],
  ['closeAudition', CloseAuditionResultSchema, { ...ok, auditionId: 'au1', workProjectId: 'w1' }],
  ['confirmOperatorStepUp', ConfirmOperatorStepUpResultSchema, ok],
  ['recordNcmecPortalReceiptArtifact', RecordNcmecPortalReceiptArtifactResultSchema, {
    ...ok, artifactId: 'r1', objectGeneration: '17', sha256: 'abc',
  }],
  ['recordNcmecPortalCorrection', RecordNcmecPortalCorrectionResultSchema, {
    ...ok, caseId: 'case1', correctionId: 'corr1',
  }],
  ['linkNciiEvidenceToCase', LinkNciiEvidenceToCaseResultSchema, {
    ...ok, caseId: 'case1', allegationId: 'al1', ownerUid: null, holdRefId: 'hold1',
  }],
  ['unlinkNciiEvidenceFromCase', UnlinkNciiEvidenceFromCaseResultSchema, ok],
  ['markNciiEvidence', MarkNciiEvidenceResultSchema, { ...ok, allegationId: 'al1', alreadyExisted: true }],
  ['createChapter', CreateChapterResultSchema, { ...ok, chapterId: 'ch1', order: 2 }],
  ['createTelevisionEpisode', CreateTelevisionEpisodeResultSchema, { ...ok, episodeId: 'e1', order: 1 }],
  ['createTuneTrack', CreateTuneTrackResultSchema, { ...ok, trackId: 't1', order: 4 }],
  ['reviewHallContentChangeRequest', ReviewHallContentChangeRequestResultSchema, {
    ...ok, changeRequestId: 'cr1', decision: 'denied',
  }],
  ['reviewThresholdItem', ReviewThresholdItemResultSchema, { ...claimed, decision: 'needs_revision' }],
  ['submitForThresholdLibraryReview', SubmitForThresholdLibraryReviewResultSchema, {
    ...ok, hallItemId: 'h1', thresholdItemIds: ['th1', 'th2'],
  }],
  ['submitHallContentChangeRequest', SubmitHallContentChangeRequestResultSchema, { ...ok, changeRequestId: 'cr1' }],
  ['updateChapterDetails', UpdateChapterDetailsResultSchema, { ...ok, chapterId: 'ch1' }],
  ['updateHallInkedWork', UpdateHallInkedWorkResultSchema, { ...ok, inked: true, idempotent: false }],
  ['updateHallLibrarySettings', UpdateHallLibrarySettingsResultSchema, { ...ok, settings: { tunesAutoplay: true } }],
  ['updateHallPlaybackProgress', UpdateHallPlaybackProgressResultSchema, { ...ok, hallItemId: 'h1' }],
  ['updateHallRecentlyViewed', UpdateHallRecentlyViewedResultSchema, { ...ok, hallItemId: 'h1' }],
  ['updateHallWorkHidden', UpdateHallWorkHiddenResultSchema, { ...ok, hidden: true, idempotent: true }],
  ['updateTaleWorkGenres', UpdateTaleWorkGenresResultSchema, { ...ok, taleId: 'tale1' }],
  ['updateTelevisionWorkGenres', UpdateTelevisionWorkGenresResultSchema, { ...ok, televisionId: 'tv1' }],
  ['updateTuneWorkGenres', UpdateTuneWorkGenresResultSchema, { ...ok, tuneId: 'tune1' }],
  ['updateTelevisionEpisodeDetails', UpdateTelevisionEpisodeDetailsResultSchema, { ...ok, episodeId: 'e1' }],
  ['updateTuneTrackDetails', UpdateTuneTrackDetailsResultSchema, { ...ok, trackId: 't1' }],
  ['withdrawFromThresholdLibraryReview', WithdrawFromThresholdLibraryReviewResultSchema, claimed],
  ['createNotificationBroadcast', CreateNotificationBroadcastResultSchema, { ...ok, jobId: 'job1' }],
  ['markNotificationsSeen', MarkNotificationsSeenResultSchema, { ...ok, updated: 0 }],
  ['deleteConversationFile', DeleteConversationFileResultSchema, { ...ok, conversationFileId: 'cf1' }],
  ['rejectCommissionProposal', RejectCommissionProposalResultSchema, {
    ...ok, commissionListingId: 'cl1', commissionProposalId: 'cp1', commissionProposerUid: 'u2',
  }],
  ['setCommissionProposalSaved', SetCommissionProposalSavedResultSchema, {
    ...ok, commissionListingId: 'cl1', commissionProposalId: 'cp1', saved: false,
  }],
  ['closeCommission / adminCloseCommission', CloseCommissionResultSchema, {
    ...ok, commissionListingId: 'cl1', workProjectId: 'w1',
  }],
  ['adminResolvePledgeRefundRequest', AdminResolvePledgeRefundRequestResultSchema, {
    ...ok, status: 'denied', auditEventId: 'a1',
  }],
  ['requestPledgeRefund', RequestPledgeRefundResultSchema, { ...ok, requestId: 'pr1', status: 'requested' }],
  ['trackShortLinkClick', TrackShortLinkClickResultSchema, { ...ok, destinationUrl: '/auditions/a1' }],
  ['submitFeedback', SubmitFeedbackResultSchema, { ...ok, message: 'Feedback submitted successfully.' }],
  ['seedBlockedFranchiseNames', SeedBlockedFranchiseNamesResultSchema, { ...ok, added: 0, total: 12 }],
  ['seedReservedUsernames', SeedReservedUsernamesResultSchema, { ...ok, added: 3, total: 3 }],
  ['seedProfanityList', SeedProfanityListResultSchema, { ...ok, alreadySeeded: true, wordCount: 40 }],
  ['updateGuildInviteConfirmation', UpdateGuildInviteConfirmationResultSchema, {
    ...ok, status: 'accepted', workProjectId: 'w1', senderUid: 'u1', recipientUid: 'u2', callerUid: 'u2',
  }],
  ['updateGuildInviteStakeShares', UpdateGuildInviteStakeSharesResultSchema, {
    ...ok, newStakeShares: 25, workProjectId: 'w1', senderUid: 'u1', recipientUid: 'u2', outboxCommandId: 'cmd1',
  }],
];

describe('callable answers', () => {
  it.each(answers)('%s: its answer parses as declared', (_name, schema, answer) => {
    expect(schema.parse(answer)).toEqual(answer);
  });

  it.each(answers)('%s: a failure posing as success is refused', (_name, schema, answer) => {
    expect(schema.safeParse({ ...answer, success: false }).success).toBe(false);
  });
});

// Answers that carry no success flag: each is a read or a lookup whose content is the answer.
describe('callable read answers', () => {
  it('checkRealmNameAvailable names why a name is unavailable only as taken', () => {
    expect(CheckRealmNameAvailableResultSchema.parse({ available: false, reason: 'taken' })).toEqual({
      available: false,
      reason: 'taken',
    });
    expect(CheckRealmNameAvailableResultSchema.safeParse({ available: false, reason: 'reserved' }).success).toBe(false);
  });

  it('checkTrademark carries the curated match, or none', () => {
    const answer = { curatedMatch: false, matchedEntry: null, advisory: 'manual web check advised', checkedAt: 1 };
    expect(CheckTrademarkResultSchema.parse(answer)).toEqual(answer);
  });

  it('getLatestHideCascade answers null when no cascade hid the entity', () => {
    expect(GetLatestHideCascadeResultSchema.parse({ cascadeId: null })).toEqual({ cascadeId: null });
  });

  it('getPendingGuildInviteCount refuses a negative count', () => {
    expect(GetPendingGuildInviteCountResultSchema.parse({ count: 0 })).toEqual({ count: 0 });
    expect(GetPendingGuildInviteCountResultSchema.safeParse({ count: -1 }).success).toBe(false);
  });

  it('enrollOperatorStepUp answers the enrolment secret and its URI', () => {
    const answer = { otpauthUri: 'otpauth://totp/x', secret: 'S3CR3T' };
    expect(EnrollOperatorStepUpResultSchema.parse(answer)).toEqual(answer);
  });

  it('verifyOperatorStepUp answers when the grant expires', () => {
    expect(VerifyOperatorStepUpResultSchema.parse({ grantExpiresAt: 5 })).toEqual({ grantExpiresAt: 5 });
  });

  it('getSafetyCaseParties offers each party only a known account-action role', () => {
    const party = { uid: 'u1', label: 'Content owner / uploader', suggestedRole: 'uploader', accountStatus: 'active' };
    expect(GetSafetyCasePartiesResultSchema.parse({ parties: [party] })).toEqual({ parties: [party] });
    expect(
      GetSafetyCasePartiesResultSchema.safeParse({ parties: [{ ...party, suggestedRole: 'bystander' }] }).success,
    ).toBe(false);
  });

  it('revealCaseEvidence always answers uncacheable', () => {
    const answer = {
      success: true,
      caseId: 'case1',
      metadata: { manifestId: 'm1', sourceKind: 'media' },
      expiresAt: 9,
      noStore: true,
    };
    expect(RevealCaseEvidenceResultSchema.parse(answer)).toEqual(answer);
    expect(RevealCaseEvidenceResultSchema.safeParse({ ...answer, noStore: false }).success).toBe(false);
  });

  it('resolveNciiReportPreview names the media kind only as image, video, or audio', () => {
    expect(ResolveNciiReportPreviewResultSchema.parse({})).toEqual({});
    expect(ResolveNciiReportPreviewResultSchema.safeParse({ mediaKind: 'document' }).success).toBe(false);
  });

  it('submitInAppNciiRequest answers only a complete request', () => {
    const answer = { requestReference: 'TID-1', requestId: 'req1', completenessStatus: 'complete', created: true };
    expect(SubmitInAppNciiRequestResultSchema.parse(answer)).toEqual(answer);
    expect(
      SubmitInAppNciiRequestResultSchema.safeParse({ ...answer, completenessStatus: 'incomplete' }).success,
    ).toBe(false);
  });

  it('clearUploadActivity and markUploadsSeen answer ok', () => {
    expect(ClearUploadActivityResultSchema.parse({ ok: true })).toEqual({ ok: true });
    expect(MarkUploadsSeenResultSchema.parse({ ok: true, marked: 2 })).toEqual({ ok: true, marked: 2 });
    expect(MarkUploadsSeenResultSchema.safeParse({ ok: false, marked: 2 }).success).toBe(false);
  });

  it('startUpload answers the pending media doc, or an accepted lane result', () => {
    expect(StartUploadResultSchema.parse({ pendingMediaId: 'pm1' })).toEqual({ pendingMediaId: 'pm1' });
    expect(StartUploadResultSchema.safeParse({}).success).toBe(false);
  });

  it('createStripeCheckoutSession answers the checkout URL', () => {
    expect(CreateStripeCheckoutSessionResultSchema.parse({ url: 'https://checkout' })).toEqual({ url: 'https://checkout' });
    expect(CreateStripeCheckoutSessionResultSchema.safeParse({ url: '' }).success).toBe(false);
  });

  it('getMyPledgeByCheckoutSession answers null when the session names no pledge of the caller’s', () => {
    expect(GetMyPledgeByCheckoutSessionResultSchema.parse(null)).toBeNull();
  });

  it('createShortLink answers the short id and its URL', () => {
    const answer = { shortId: 's1', shortUrl: 'https://ttt.productions/s/s1' };
    expect(CreateShortLinkResultSchema.parse(answer)).toEqual(answer);
  });
});

describe('inputs of callables that take none', () => {
  it.each([
    ['requestAccountDeletion', RequestAccountDeletionInputSchema],
    ['cancelAccountDeletion', CancelAccountDeletionInputSchema],
    ['getPendingGuildInviteCount', GetPendingGuildInviteCountInputSchema],
    ['enrollOperatorStepUp', EnrollOperatorStepUpInputSchema],
  ] as const)('%s accepts only an empty object', (_name, schema) => {
    expect(schema.parse({})).toEqual({});
    expect(schema.safeParse({ uid: 'someone-else' }).success).toBe(false);
    expect(schema.safeParse(null).success).toBe(false);
  });
});
