import { z } from 'zod';
import {
  MAX_SAFETY_RESOLUTION_SUMMARY_LENGTH,
  MAX_SAFETY_ADMIN_NOTE_LENGTH,
} from '../../constants/business-admin.js';
import { ConversationFileRefSchema } from '../../media/conversation-file-ref.js';

export const ReportReasonSchema = z.enum([
  'Spam',
  'Harassment',
  'Hate Speech',
  'Violence or Threats',
  'Sexual Content',
  'Self-Harm',
  'Impersonation',
  'Intellectual Property',
  'Child Safety Concern',
  'Nonconsensual Intimate Image (NCII)',
  'Not related to on-site entertainment',
  'Other',
]);
export type ReportReason = z.infer<typeof ReportReasonSchema>;

export const PROTECTED_REPORT_REASONS = [
  'Child Safety Concern',
  'Nonconsensual Intimate Image (NCII)',
] as const satisfies readonly ReportReason[];

export const ProtectedForkSchema = z.enum(['childSafetyCase', 'nciiCase']);
export type ProtectedFork = z.infer<typeof ProtectedForkSchema>;

export const ReportableItemTypeSchema = z.enum([
  'username',
  'craft-skill',
  'commission-listing',
  'commission-proposal',
  'square-streetz-post',
  'profile-picture',
  'guild-invite-message',
  'guild-chat-message',
  'conversation-file',
  'hall-library-item',
  'hall-library-sub-item',
  'audition',
  'audition-entry',
  'work-project',
  'work-asset',
  'work-realm',
]);
export type ReportableItemType = z.infer<typeof ReportableItemTypeSchema>;

export const CHAT_REPORT_ITEM_TYPES = [
  'guild-chat-message',
  'guild-invite-message',
] as const satisfies readonly ReportableItemType[];

export const CONTENT_ACTION_PANEL_ITEM_TYPES = [
  'square-streetz-post',
  'audition',
  'audition-entry',
  'commission-listing',
  'commission-proposal',
  'work-asset',
  'profile-picture',
  'hall-library-item',
  'hall-library-sub-item',
  'craft-skill',
  'conversation-file',
] as const satisfies readonly ReportableItemType[];
export type ContentActionPanelItemType = (typeof CONTENT_ACTION_PANEL_ITEM_TYPES)[number];

export const MODERATABLE_ITEM_TYPES = [
  'square-streetz-post',
  'audition',
  'audition-entry',
  'commission-listing',
  'commission-proposal',
  'work-asset',
  'profile-picture',
  'hall-library-item',
  'conversation-file',
] as const satisfies readonly ReportableItemType[];
export type ModeratableItemType = (typeof MODERATABLE_ITEM_TYPES)[number];

export const MEDIA_SERVING_ONLY_ITEM_TYPES = [
  'work-asset',
  'profile-picture',
  'conversation-file',
] as const satisfies readonly ModeratableItemType[];
export type MediaServingOnlyItemType = (typeof MEDIA_SERVING_ONLY_ITEM_TYPES)[number];

export const ASSET_LEVEL_BLOCK_ITEM_TYPES = [
  'work-asset',
  'conversation-file',
] as const satisfies readonly MediaServingOnlyItemType[];
export type AssetLevelBlockItemType = (typeof ASSET_LEVEL_BLOCK_ITEM_TYPES)[number];

export const SINGLE_DOC_TARGET_TYPES = [
  'square-streetz-post',
  'audition',
  'audition-entry',
  'commission-listing',
  'commission-proposal',
  'work-asset',
  'profile-picture',
  'hall-library-item',
  'craft-skill',
  'conversation-file',
] as const satisfies readonly ContentActionPanelItemType[];

export const SINGLE_DOC_HIDE_RESTORE_TARGET_TYPES = [
  ...SINGLE_DOC_TARGET_TYPES,
  'hall-library-sub-item',
] as const satisfies readonly ContentActionPanelItemType[];

export const HALL_LIBRARY_TARGET_TYPES = [
  'hall-library-item',
  'hall-library-sub-item',
] as const satisfies readonly ContentActionPanelItemType[];

export const TargetLocatorV1Schema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('mediaAsset'), mediaAssetId: z.string().min(1) }).strict(),
  z
    .object({
      kind: z.literal('hallItem'),
      hallItemId: z.string().min(1),
      subItemId: z.string().min(1).optional(),
    })
    .strict(),
  z.object({ kind: z.literal('squarePost'), postId: z.string().min(1) }).strict(),
  z.object({ kind: z.literal('profileImage'), profileUid: z.string().min(1) }).strict(),
  z.object({ kind: z.literal('username'), profileUid: z.string().min(1) }).strict(),
  z
    .object({
      kind: z.literal('craftSkill'),
      profileUid: z.string().min(1),
      craftSkillId: z.string().min(1),
    })
    .strict(),
  z
    .object({ kind: z.literal('commissionListing'), commissionListingId: z.string().min(1) })
    .strict(),
  z
    .object({
      kind: z.literal('commissionProposal'),
      commissionListingId: z.string().min(1),
      commissionProposalId: z.string().min(1),
    })
    .strict(),
  z.object({ kind: z.literal('workProject'), workProjectId: z.string().min(1) }).strict(),
  z
    .object({
      kind: z.literal('workAsset'),
      workProjectId: z.string().min(1),
      workAssetId: z.string().min(1),
    })
    .strict(),
  z.object({ kind: z.literal('workRealm'), workRealmId: z.string().min(1) }).strict(),
  z.object({ kind: z.literal('audition'), auditionId: z.string().min(1) }).strict(),
  z
    .object({
      kind: z.literal('auditionEntry'),
      auditionId: z.string().min(1),
      auditionEntryId: z.string().min(1),
    })
    .strict(),
  z
    .object({
      kind: z.literal('guildInviteMessage'),
      channelId: z.string().min(1),
      messageId: z.string().min(1),
    })
    .strict(),
  z
    .object({
      kind: z.literal('conversationFile'),
      conversation: ConversationFileRefSchema,
      conversationFileId: z.string().min(1),
      mediaAssetId: z.string().min(1),
    })
    .strict(),
  z
    .object({
      kind: z.literal('guildChatMessage'),
      channelId: z.string().min(1),
      messageId: z.string().min(1),
    })
    .strict(),
  z.object({ kind: z.literal('url'), url: z.string().min(1) }).strict(),
  z.object({ kind: z.literal('additionalText'), textRef: z.string().min(1) }).strict(),
]);
export type TargetLocatorV1 = z.infer<typeof TargetLocatorV1Schema>;

export const TargetLocatorKindSchema = z.enum([
  'mediaAsset',
  'hallItem',
  'squarePost',
  'profileImage',
  'username',
  'craftSkill',
  'commissionListing',
  'commissionProposal',
  'workProject',
  'workAsset',
  'workRealm',
  'audition',
  'auditionEntry',
  'guildInviteMessage',
  'conversationFile',
  'guildChatMessage',
  'url',
  'additionalText',
]);
export type TargetLocatorKind = z.infer<typeof TargetLocatorKindSchema>;

export const TargetLocatorSummaryV1Schema = z
  .object({
    kind: TargetLocatorKindSchema,
    surfaceLabel: z.string(),
    hasResolvedTarget: z.boolean(),
  })
  .strict();
export type TargetLocatorSummaryV1 = z.infer<typeof TargetLocatorSummaryV1Schema>;

export const ReportDispositionSchema = z.enum([
  'undetermined',
  'reportRequired',
  'notRequired',
  'correctedNoApparentViolation',
]);
export type ReportDisposition = z.infer<typeof ReportDispositionSchema>;

export const ReportDispositionReasonCodeSchema = z.enum([
  'outOfScopeNotCsea',
  'basisInvalidatedFalseMatch',
  'duplicateOfFiledReport',
  'leDirectedNoReport',
  'nonReportableSafetyConfirmed',
  'apparentCsamConfirmed',
  'hashMatchValidated',
]);
export type ReportDispositionReasonCode = z.infer<typeof ReportDispositionReasonCodeSchema>;

export const REPORT_REQUIRED_DISPOSITION_REASON_CODES = [
  'apparentCsamConfirmed',
  'hashMatchValidated',
] as const satisfies readonly ReportDispositionReasonCode[];

export const NOT_REQUIRED_DISPOSITION_REASON_CODES = [
  'outOfScopeNotCsea',
  'basisInvalidatedFalseMatch',
  'duplicateOfFiledReport',
  'leDirectedNoReport',
  'nonReportableSafetyConfirmed',
] as const satisfies readonly ReportDispositionReasonCode[];

export const REPORT_DISPOSITION_ALLOWED_REASON_CODES: Record<
  ReportDisposition,
  readonly ReportDispositionReasonCode[]
> = {
  undetermined: [],
  reportRequired: REPORT_REQUIRED_DISPOSITION_REASON_CODES,
  notRequired: NOT_REQUIRED_DISPOSITION_REASON_CODES,
  correctedNoApparentViolation: NOT_REQUIRED_DISPOSITION_REASON_CODES,
};

export function refineReportDispositionReasonCode(
  value: { disposition: ReportDisposition; dispositionReasonCode: ReportDispositionReasonCode },
  ctx: z.RefinementCtx,
): void {
  if (
    !REPORT_DISPOSITION_ALLOWED_REASON_CODES[value.disposition].includes(
      value.dispositionReasonCode,
    )
  ) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['dispositionReasonCode'],
      message: `Reason code '${value.dispositionReasonCode}' is not valid for disposition '${value.disposition}'.`,
    });
  }
}

export function refineReportDispositionEvidenceRefs(
  value: { disposition: ReportDisposition; evidenceRefs: readonly string[] },
  ctx: z.RefinementCtx,
): void {
  if (value.disposition === 'reportRequired' && value.evidenceRefs.length === 0) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['evidenceRefs'],
      message:
        "Disposition 'reportRequired' requires at least one evidence ref (evidence must have been revealed).",
    });
  }
}

export const SafetyCaseClosureOutcomeSchema = z.enum(['founded', 'unfounded']);
export type SafetyCaseClosureOutcome = z.infer<typeof SafetyCaseClosureOutcomeSchema>;

export const SafetyCaseClosureV1Schema = z
  .object({
    outcome: SafetyCaseClosureOutcomeSchema,
    resolutionSummary: z.string().min(1).max(MAX_SAFETY_RESOLUTION_SUMMARY_LENGTH),
    adminNote: z.string().max(MAX_SAFETY_ADMIN_NOTE_LENGTH).optional(),
    closedByUid: z.string().min(1),
    closedAt: z.number(),
  })
  .strict();
export type SafetyCaseClosureV1 = z.infer<typeof SafetyCaseClosureV1Schema>;

export const NcmecSubmissionStateSchema = z.enum(['awaitingManualFiling', 'completed']);
export type NcmecSubmissionState = z.infer<typeof NcmecSubmissionStateSchema>;

export const SafetyHoldResourceTypeSchema = z.enum([
  'contentDoc',
  'mediaAsset',
  'account',
  'chatMessageRange',
  'channel',
  'nciiTemporaryTarget',
  'storageObject',
  'reportEvidenceObject',
]);
export type SafetyHoldResourceType = z.infer<typeof SafetyHoldResourceTypeSchema>;

export const SafetyHoldClassSchema = z.enum([
  'childSafety',
  'nciiTemporary',
  'legalRetention',
  'preservationEvidence',
  'ordinaryReport',
]);
export type SafetyHoldClass = z.infer<typeof SafetyHoldClassSchema>;

export const SafetyCommandKindSchema = z.enum([
  'nciiRemoval',
  'csamActiveByteRemoval',
  'evidenceDisposition',
]);
export type SafetyCommandKind = z.infer<typeof SafetyCommandKindSchema>;

export const SafetyReviewerCapabilitySchema = z.enum([
  'nciiRequestReviewer',
  'nciiEvidenceReviewer',
  'nciiAppealReviewer',
  'childSafetyReviewer',
  'legalDispositionAuthority',
]);
export type SafetyReviewerCapability = z.infer<typeof SafetyReviewerCapabilitySchema>;

export const RegistrationCompletionOutcomeSchema = z.enum([
  'completed',
  'alreadyCompletedSameUid',
  'retryableInfrastructureFailure',
  'nonceExpired',
  'nonceUnknown',
  'nonceConsumedDifferentUid',
  'sessionHashMismatch',
  'attestationSignatureInvalid',
  'policyVersionRejected',
  'registrationExpired',
]);
export type RegistrationCompletionOutcome = z.infer<typeof RegistrationCompletionOutcomeSchema>;

export const TakeItDownFieldCodeSchema = z.enum([
  'requesterName',
  'contactEmail',
  'contactPhone',
  'requesterRole',
  'electronicSignature',
  'authorityBasis',
  'authorityCertification',
  'authorityEvidence',
  'targetLocator',
  'nonconsentStatement',
  'supportingFacts',
  'goodFaithCertification',
]);
export type TakeItDownFieldCode = z.infer<typeof TakeItDownFieldCodeSchema>;

export const TakeItDownPublicReasonCodeSchema = z.enum([
  'needMoreInformation',
  'couldNotVerifyRequesterRole',
  'couldNotLocateContent',
  'outsideCoveredScope',
  'duplicateOfExistingRequest',
  'removedSuccessfully',
  'underReview',
  'closedSeeNotice',
]);
export type TakeItDownPublicReasonCode = z.infer<typeof TakeItDownPublicReasonCodeSchema>;

export const TakeItDownInvalidReasonCodeSchema = z.enum([
  'missingSignature',
  'missingLocator',
  'missingNonconsentStatement',
  'missingContactInformation',
  'requesterNotDepictedPersonOrAuthorizedRepresentative',
  'authorityNotEstablished',
  'locatorNotResolvableAfterReasonableEffort',
  'requestOutsideCoveredDepiction',
  'duplicateSuperseded',
  'fraudulentOrBadFaith',
]);
export type TakeItDownInvalidReasonCode = z.infer<typeof TakeItDownInvalidReasonCodeSchema>;

export const TakeItDownRequesterRoleSchema = z.enum(['depictedPerson', 'authorizedRepresentative']);
export type TakeItDownRequesterRole = z.infer<typeof TakeItDownRequesterRoleSchema>;

export const TakeItDownCompletenessStatusSchema = z.enum(['incomplete', 'complete']);
export type TakeItDownCompletenessStatus = z.infer<typeof TakeItDownCompletenessStatusSchema>;

export const TakeItDownValidityStatusSchema = z.enum([
  'pending',
  'valid',
  'invalid',
  'unableToLocate',
]);
export type TakeItDownValidityStatus = z.infer<typeof TakeItDownValidityStatusSchema>;

export const TakeItDownPublicStatusSchema = z.enum([
  'received',
  'needsMoreInfo',
  'validInProgress',
  'completed',
  'unableToLocate',
  'invalidGeneralReason',
]);
export type TakeItDownPublicStatus = z.infer<typeof TakeItDownPublicStatusSchema>;

export const NciiActionTypeSchema = z.enum([
  'intakeReceived',
  'completenessDecided',
  'validityDecided',
  'tempHoldPlaced',
  'tempHoldReleased',
  'removalStarted',
  'removalCompleted',
  'hashBlockReversed',
  'childSafetyCaseLinked',
  'legalDispositionRecorded',
]);
export type NciiActionType = z.infer<typeof NciiActionTypeSchema>;

export const NciiActionResultSchema = z.enum(['succeeded', 'failed', 'deferred', 'rejected']);
export type NciiActionResult = z.infer<typeof NciiActionResultSchema>;

export const NciiRemovalCompletionOutcomeSchema = z.enum(['completed', 'unableToComplete']);
export type NciiRemovalCompletionOutcome = z.infer<typeof NciiRemovalCompletionOutcomeSchema>;

export const NciiTargetSurfaceSchema = z.enum([
  'original',
  'hallCopy',
  'profileMedia',
  'conversationFile',
  'variant',
  'cacheServing',
  'exactHashMatch',
]);
export type NciiTargetSurface = z.infer<typeof NciiTargetSurfaceSchema>;

export const NciiTargetOutcomeSchema = z.enum([
  'pending',
  'removed',
  'tombstoned',
  'verifiedGone',
  'leftoverRetrying',
  'unableToComplete',
]);
export type NciiTargetOutcome = z.infer<typeof NciiTargetOutcomeSchema>;

export const NciiInternalStatusSchema = z.enum([
  'open',
  'removalInProgress',
  'processing',
  'failed',
  'removed',
  'rejected',
  'closed',
]);
export type NciiInternalStatus = z.infer<typeof NciiInternalStatusSchema>;

export const NciiChildSafetyLinkStatusSchema = z.enum([
  'none',
  'assessmentPending',
  'linked',
  'resolvedNoChildSafetyCase',
]);
export type NciiChildSafetyLinkStatus = z.infer<typeof NciiChildSafetyLinkStatusSchema>;

export const NciiMinorAssessmentSchema = z.enum([
  'adult',
  'unknown',
  'possibleMinor',
  'confirmedMinor',
]);
export type NciiMinorAssessment = z.infer<typeof NciiMinorAssessmentSchema>;

export const NciiCsamAssessmentSchema = z.enum([
  'notAssessed',
  'notApparent',
  'apparentViolation',
  'validatedHashMatch',
]);
export type NciiCsamAssessment = z.infer<typeof NciiCsamAssessmentSchema>;

export const NciiChildSafetyCrossoverSchema = z
  .object({
    minorAssessment: NciiMinorAssessmentSchema,
    csamAssessment: NciiCsamAssessmentSchema,
    childSafetyCaseId: z.string().min(1).optional(),
    assessedByUid: z.string().min(1).optional(),
    assessedAt: z.number().optional(),
  })
  .strict();
export type NciiChildSafetyCrossover = z.infer<typeof NciiChildSafetyCrossoverSchema>;

export const SafetyCrossoverLegStatusSchema = z.enum(['pending', 'done', 'failed']);
export type SafetyCrossoverLegStatus = z.infer<typeof SafetyCrossoverLegStatusSchema>;
