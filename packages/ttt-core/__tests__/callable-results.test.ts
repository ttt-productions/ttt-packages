import { describe, expect, it } from 'vitest';
import type { ZodTypeAny } from 'zod';
import * as schemas from '../src/schemas/index';

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
  ['acceptHallDownloadAcknowledgement', schemas.AcceptHallDownloadAcknowledgementResultSchema, { ...ok, alreadyAccepted: false }],
  ['acceptSquareStreetzAgreements', schemas.AcceptSquareStreetzAgreementsResultSchema, { ...ok, alreadyAccepted: true }],
  ['becomeArtisanCreator', schemas.BecomeArtisanCreatorResultSchema, { ...ok, alreadyArtisanCreator: false }],
  ['markNonUsArtisanInterest', schemas.MarkNonUsArtisanInterestResultSchema, { ...ok, alreadyMarked: false }],
  ['markWaitingForNewsApproval', schemas.MarkWaitingForNewsApprovalResultSchema, { ...ok, alreadyMarked: true }],
  ['setMyDisplayName', schemas.SetMyDisplayNameResultSchema, ok],
  ['setUserStatus', schemas.SetUserStatusResultSchema, { ...ok, message: 'User suspended.', auditEventId: 'a1' }],
  ['forceDisplayNameReset', schemas.ForceDisplayNameResetResultSchema, { ...ok, auditEventId: 'a1' }],
  ['closeAccountUnder13', schemas.CloseAccountUnder13ResultSchema, { success: true, outcome: 'parked' }],
  ['updateSiteTourPreference', schemas.UpdateSiteTourPreferenceResultSchema, ok],
  ['upgradeAccountToAdult', schemas.UpgradeAccountToAdultResultSchema, { ...ok, alreadyAdult: false }],
  ['createFileFolder', schemas.CreateFileFolderResultSchema, { ...ok, folderId: 'f1' }],
  ['renameFileFolder', schemas.RenameFileFolderResultSchema, ok],
  ['updateFolderProfessions', schemas.UpdateFolderProfessionsResultSchema, ok],
  ['deleteFileFolder', schemas.DeleteFileFolderResultSchema, ok],
  ['deleteWorkFile', schemas.DeleteWorkFileResultSchema, ok],
  ['inviteUserToGuild', schemas.InviteUserToGuildResultSchema, { ...ok, guildInviteId: 'g1', invitedUsername: 'Ada' }],
  ['leaveWorkProject', schemas.LeaveWorkProjectResultSchema, { ...ok, message: 'Left the Work.' }],
  ['manageWorkProjectStakeShares', schemas.ManageWorkProjectStakeSharesResultSchema, { ...ok, message: 'Done.' }],
  ['updateGuildmateStanding', schemas.UpdateGuildmateStandingResultSchema, ok],
  ['updateGuildmateTradeProfessions', schemas.UpdateGuildmateTradeProfessionsResultSchema, ok],
  ['updatePublicWorkProjectDetails', schemas.UpdatePublicWorkProjectDetailsResultSchema, ok],
  ['updateWorkRealmDetails', schemas.UpdateWorkRealmDetailsResultSchema, ok],
  ['clearHallContentText', schemas.ClearHallContentTextResultSchema, ok],
  ['clearWorkProjectText / clearWorkRealmText', schemas.ClearModerationTextResultSchema, ok],
  ['createAdminDispatchToUser / ToWorkProject', schemas.CreateAdminDispatchResultSchema, { ...ok, adminDispatchId: 'd1' }],
  ['hideHallSubItem', schemas.HideHallSubItemResultSchema, ok],
  ['restoreHallSubItem', schemas.RestoreHallSubItemResultSchema, ok],
  ['hideWorkProject', schemas.HideWorkProjectResultSchema, { ...ok, cascadeId: 'c1' }],
  ['hideWorkRealm', schemas.HideWorkRealmResultSchema, { ...ok, cascadeId: 'c1' }],
  ['restoreWorkProject', schemas.RestoreWorkProjectResultSchema, ok],
  ['restoreWorkRealm', schemas.RestoreWorkRealmResultSchema, ok],
  ['requireWorkProjectRetitle / requireWorkRealmRetitle', schemas.RequireRetitleResultSchema, ok],
  ['resolveAdminTask', schemas.ResolveAdminTaskResultSchema, { ...ok, auditEventId: 'a1' }],
  ['updateAppConfig', schemas.UpdateAppConfigResultSchema, { ...ok, updatedFields: ['maintenanceMode'] }],
  ['markWorkLater', schemas.MarkWorkLaterResultSchema, { ...ok, alreadyResolved: true }],
  ['the public-document seeds', schemas.SeedPublicDocumentResultSchema, { ...ok, seeded: false, version: 3 }],
  ['clearSystemVideoSlot', schemas.ClearSystemVideoSlotResultSchema, { ...ok, cleared: false }],
  ['updateSystemUidSlot', schemas.UpdateSystemUidSlotResultSchema, { ...ok, changed: true }],
  ['closeAudition', schemas.CloseAuditionResultSchema, { ...ok, auditionId: 'au1', workProjectId: 'w1' }],
  ['confirmOperatorStepUp', schemas.ConfirmOperatorStepUpResultSchema, ok],
  ['recordNcmecPortalReceiptArtifact', schemas.RecordNcmecPortalReceiptArtifactResultSchema, {
    ...ok, artifactId: 'r1', objectGeneration: '17', sha256: 'abc',
  }],
  ['recordNcmecPortalCorrection', schemas.RecordNcmecPortalCorrectionResultSchema, {
    ...ok, caseId: 'case1', correctionId: 'corr1',
  }],
  ['linkNciiEvidenceToCase', schemas.LinkNciiEvidenceToCaseResultSchema, {
    ...ok, caseId: 'case1', allegationId: 'al1', ownerUid: null, holdRefId: 'hold1',
  }],
  ['unlinkNciiEvidenceFromCase', schemas.UnlinkNciiEvidenceFromCaseResultSchema, ok],
  ['markNciiEvidence', schemas.MarkNciiEvidenceResultSchema, { ...ok, allegationId: 'al1', alreadyExisted: true }],
  ['createChapter', schemas.CreateChapterResultSchema, { ...ok, chapterId: 'ch1', order: 2 }],
  ['createTelevisionEpisode', schemas.CreateTelevisionEpisodeResultSchema, { ...ok, episodeId: 'e1', order: 1 }],
  ['createTuneTrack', schemas.CreateTuneTrackResultSchema, { ...ok, trackId: 't1', order: 4 }],
  ['reviewHallContentChangeRequest', schemas.ReviewHallContentChangeRequestResultSchema, {
    ...ok, changeRequestId: 'cr1', decision: 'denied',
  }],
  ['reviewThresholdItem', schemas.ReviewThresholdItemResultSchema, { ...claimed, decision: 'needs_revision' }],
  ['submitForThresholdLibraryReview', schemas.SubmitForThresholdLibraryReviewResultSchema, {
    ...ok, hallItemId: 'h1', thresholdItemIds: ['th1', 'th2'],
  }],
  ['submitHallContentChangeRequest', schemas.SubmitHallContentChangeRequestResultSchema, { ...ok, changeRequestId: 'cr1' }],
  ['updateChapterDetails', schemas.UpdateChapterDetailsResultSchema, { ...ok, chapterId: 'ch1' }],
  ['updateHallInkedWork', schemas.UpdateHallInkedWorkResultSchema, { ...ok, inked: true, idempotent: false }],
  ['updateHallLibrarySettings', schemas.UpdateHallLibrarySettingsResultSchema, { ...ok, settings: { tunesAutoplay: true } }],
  ['updateHallPlaybackProgress', schemas.UpdateHallPlaybackProgressResultSchema, { ...ok, hallItemId: 'h1' }],
  ['updateHallRecentlyViewed', schemas.UpdateHallRecentlyViewedResultSchema, { ...ok, hallItemId: 'h1' }],
  ['updateHallWorkHidden', schemas.UpdateHallWorkHiddenResultSchema, { ...ok, hidden: true, idempotent: true }],
  ['updateTaleWorkGenres', schemas.UpdateTaleWorkGenresResultSchema, { ...ok, taleId: 'tale1' }],
  ['updateTelevisionWorkGenres', schemas.UpdateTelevisionWorkGenresResultSchema, { ...ok, televisionId: 'tv1' }],
  ['updateTuneWorkGenres', schemas.UpdateTuneWorkGenresResultSchema, { ...ok, tuneId: 'tune1' }],
  ['updateTelevisionEpisodeDetails', schemas.UpdateTelevisionEpisodeDetailsResultSchema, { ...ok, episodeId: 'e1' }],
  ['updateTuneTrackDetails', schemas.UpdateTuneTrackDetailsResultSchema, { ...ok, trackId: 't1' }],
  ['withdrawFromThresholdLibraryReview', schemas.WithdrawFromThresholdLibraryReviewResultSchema, claimed],
  ['createNotificationBroadcast', schemas.CreateNotificationBroadcastResultSchema, { ...ok, jobId: 'job1' }],
  ['markNotificationsSeen', schemas.MarkNotificationsSeenResultSchema, { ...ok, updated: 0 }],
  ['deleteConversationFile', schemas.DeleteConversationFileResultSchema, { ...ok, conversationFileId: 'cf1' }],
  ['rejectCommissionProposal', schemas.RejectCommissionProposalResultSchema, {
    ...ok, commissionListingId: 'cl1', commissionProposalId: 'cp1', commissionProposerUid: 'u2',
  }],
  ['setCommissionProposalSaved', schemas.SetCommissionProposalSavedResultSchema, {
    ...ok, commissionListingId: 'cl1', commissionProposalId: 'cp1', saved: false,
  }],
  ['closeCommission / adminCloseCommission', schemas.CloseCommissionResultSchema, {
    ...ok, commissionListingId: 'cl1', workProjectId: 'w1',
  }],
  ['adminResolvePledgeRefundRequest', schemas.AdminResolvePledgeRefundRequestResultSchema, {
    ...ok, status: 'denied', auditEventId: 'a1',
  }],
  ['requestPledgeRefund', schemas.RequestPledgeRefundResultSchema, { ...ok, requestId: 'pr1', status: 'requested' }],
  ['trackShortLinkClick', schemas.TrackShortLinkClickResultSchema, { ...ok, destinationUrl: '/auditions/a1' }],
  ['submitFeedback', schemas.SubmitFeedbackResultSchema, { ...ok, message: 'Feedback submitted successfully.' }],
  ['seedBlockedFranchiseNames', schemas.SeedBlockedFranchiseNamesResultSchema, { ...ok, added: 0, total: 12 }],
  ['seedReservedUsernames', schemas.SeedReservedUsernamesResultSchema, { ...ok, added: 3, total: 3 }],
  ['seedProfanityList', schemas.SeedProfanityListResultSchema, { ...ok, alreadySeeded: true, wordCount: 40 }],
  ['updateGuildInviteConfirmation', schemas.UpdateGuildInviteConfirmationResultSchema, {
    ...ok, status: 'accepted', workProjectId: 'w1', senderUid: 'u1', recipientUid: 'u2', callerUid: 'u2',
  }],
  ['updateGuildInviteStakeShares', schemas.UpdateGuildInviteStakeSharesResultSchema, {
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
    expect(schemas.CheckRealmNameAvailableResultSchema.parse({ available: false, reason: 'taken' })).toEqual({
      available: false,
      reason: 'taken',
    });
    expect(schemas.CheckRealmNameAvailableResultSchema.safeParse({ available: false, reason: 'reserved' }).success).toBe(false);
  });

  it('checkTrademark carries the curated match, or none', () => {
    const answer = { curatedMatch: false, matchedEntry: null, advisory: 'manual web check advised', checkedAt: 1 };
    expect(schemas.CheckTrademarkResultSchema.parse(answer)).toEqual(answer);
  });

  it('getLatestHideCascade answers null when no cascade hid the entity', () => {
    expect(schemas.GetLatestHideCascadeResultSchema.parse({ cascadeId: null })).toEqual({ cascadeId: null });
  });

  it('getPendingGuildInviteCount refuses a negative count', () => {
    expect(schemas.GetPendingGuildInviteCountResultSchema.parse({ count: 0 })).toEqual({ count: 0 });
    expect(schemas.GetPendingGuildInviteCountResultSchema.safeParse({ count: -1 }).success).toBe(false);
  });

  it('enrollOperatorStepUp answers the enrolment secret and its URI', () => {
    const answer = { otpauthUri: 'otpauth://totp/x', secret: 'S3CR3T' };
    expect(schemas.EnrollOperatorStepUpResultSchema.parse(answer)).toEqual(answer);
  });

  it('verifyOperatorStepUp answers when the grant expires', () => {
    expect(schemas.VerifyOperatorStepUpResultSchema.parse({ grantExpiresAt: 5 })).toEqual({ grantExpiresAt: 5 });
  });

  it('getSafetyCaseParties offers each party only a known account-action role', () => {
    const party = { uid: 'u1', label: 'Content owner / uploader', suggestedRole: 'uploader', accountStatus: 'active' };
    expect(schemas.GetSafetyCasePartiesResultSchema.parse({ parties: [party] })).toEqual({ parties: [party] });
    expect(
      schemas.GetSafetyCasePartiesResultSchema.safeParse({ parties: [{ ...party, suggestedRole: 'bystander' }] }).success,
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
    expect(schemas.RevealCaseEvidenceResultSchema.parse(answer)).toEqual(answer);
    expect(schemas.RevealCaseEvidenceResultSchema.safeParse({ ...answer, noStore: false }).success).toBe(false);
  });

  it('resolveNciiReportPreview names the media kind only as image, video, or audio', () => {
    expect(schemas.ResolveNciiReportPreviewResultSchema.parse({})).toEqual({});
    expect(schemas.ResolveNciiReportPreviewResultSchema.safeParse({ mediaKind: 'document' }).success).toBe(false);
  });

  it('submitInAppNciiRequest answers only a complete request', () => {
    const answer = { requestReference: 'TID-1', requestId: 'req1', completenessStatus: 'complete', created: true };
    expect(schemas.SubmitInAppNciiRequestResultSchema.parse(answer)).toEqual(answer);
    expect(
      schemas.SubmitInAppNciiRequestResultSchema.safeParse({ ...answer, completenessStatus: 'incomplete' }).success,
    ).toBe(false);
  });

  it('clearUploadActivity and markUploadsSeen answer ok', () => {
    expect(schemas.ClearUploadActivityResultSchema.parse({ ok: true })).toEqual({ ok: true });
    expect(schemas.MarkUploadsSeenResultSchema.parse({ ok: true, marked: 2 })).toEqual({ ok: true, marked: 2 });
    expect(schemas.MarkUploadsSeenResultSchema.safeParse({ ok: false, marked: 2 }).success).toBe(false);
  });

  it('startUpload answers the pending media doc, or an accepted lane result', () => {
    expect(schemas.StartUploadResultSchema.parse({ pendingMediaId: 'pm1' })).toEqual({ pendingMediaId: 'pm1' });
    expect(schemas.StartUploadResultSchema.safeParse({}).success).toBe(false);
  });

  it('createStripeCheckoutSession answers the checkout URL', () => {
    expect(schemas.CreateStripeCheckoutSessionResultSchema.parse({ url: 'https://checkout' })).toEqual({ url: 'https://checkout' });
    expect(schemas.CreateStripeCheckoutSessionResultSchema.safeParse({ url: '' }).success).toBe(false);
  });

  it('getMyPledgeByCheckoutSession answers null when the session names no pledge of the caller’s', () => {
    expect(schemas.GetMyPledgeByCheckoutSessionResultSchema.parse(null)).toBeNull();
  });

  it('createShortLink answers the short id and its URL', () => {
    const answer = { shortId: 's1', shortUrl: 'https://ttt.productions/s/s1' };
    expect(schemas.CreateShortLinkResultSchema.parse(answer)).toEqual(answer);
  });
});

describe('inputs of callables that take none', () => {
  it.each([
    ['requestAccountDeletion', schemas.RequestAccountDeletionInputSchema],
    ['cancelAccountDeletion', schemas.CancelAccountDeletionInputSchema],
    ['getPendingGuildInviteCount', schemas.GetPendingGuildInviteCountInputSchema],
    ['enrollOperatorStepUp', schemas.EnrollOperatorStepUpInputSchema],
  ] as const)('%s accepts only an empty object', (_name, schema) => {
    expect(schema.parse({})).toEqual({});
    expect(schema.safeParse({ uid: 'someone-else' }).success).toBe(false);
    expect(schema.safeParse(null).success).toBe(false);
  });
});
