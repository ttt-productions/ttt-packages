// Trust & Safety — shared foundation enums + the canonical target locator.
//
// This file is the SINGLE SOURCE for every enum and locator that crosses more
// than one T&S cluster (report spine, case spine, holds, evidence, sagas,
// NCMEC, NCII). Cluster document-schema files import their value sets from
// HERE so two clusters can never define the same enum with drifting values.
// Every value is transcribed verbatim from docs/code_changes_needed/
// trust-and-safety/IMPLEMENTATION_PLAN.md Appendix A (the frozen spec) — no
// invented values, no placeholders.
//
// Cross-boundary: these types are consumed by both functions/src and src/ in
// ttt-prod, so they live in ttt-core (the single source of truth for the
// backend↔frontend boundary) and surface on the `@ttt-productions/ttt-core/
// doc-schemas` subpath.

import { z } from 'zod';

// ===========================================================================
// A1 — Report reasons + reportable item types
// ===========================================================================

/** The controlling report-reason taxonomy (fixes the client/server drift
 * TS-032). The two protected reasons fork into a childSafetyCase / nciiCase. */
export const ReportReasonSchema = z.enum([
  'Spam',
  'Harassment',
  'Hate Speech',
  'Violence or Threats',
  'Sexual Content',
  'Self-Harm',
  'Impersonation',
  'Intellectual Property',
  'Child Safety Concern', // → protected fork: childSafetyCase
  'Nonconsensual Intimate Image (NCII)', // → protected fork: nciiCase
  'Other',
]);
export type ReportReason = z.infer<typeof ReportReasonSchema>;

/** The two reasons that take the mandatory in-process protected branch. */
export const PROTECTED_REPORT_REASONS = [
  'Child Safety Concern',
  'Nonconsensual Intimate Image (NCII)',
] as const satisfies readonly ReportReason[];

/** Which protected fork a protected-reason report committed. */
export const ProtectedForkSchema = z.enum(['childSafetyCase', 'nciiCase']);
export type ProtectedFork = z.infer<typeof ProtectedForkSchema>;

/** EXACTLY the `reportableItems` keys in ttt-prod src/lib/report-config.ts. A
 * ttt-prod CI test asserts this enum and `reportableItems` stay in sync (the
 * sync test lives app-side because report-config.ts is app-side). */
export const ReportableItemTypeSchema = z.enum([
  'username',
  'craft-skill',
  'commission-listing',
  'square-streetz-post',
  'profile-picture',
  'guild-invite-message',
  'guild-chat-message',
  'hall-library-item',
  'audition',
  'audition-entry',
  'work-project',
  'work-realm',
]);
export type ReportableItemType = z.infer<typeof ReportableItemTypeSchema>;

// ===========================================================================
// A11 — Target locator (the ONE typed locator used by allegations, temp holds,
// removal targets, and the report resolver) + privacy-safe summary
// ===========================================================================

/** Discriminated locator — replaces every all-optional `contentRef`. Every
 * hideable surface in report-config.ts has a typed locator ([H-02]). */
export const TargetLocatorV1Schema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('mediaAsset'), mediaAssetId: z.string().min(1) }).strict(),
  z.object({ kind: z.literal('hallItem'), hallItemId: z.string().min(1), subItemId: z.string().min(1).optional() }).strict(),
  z.object({ kind: z.literal('squarePost'), postId: z.string().min(1) }).strict(),
  z.object({ kind: z.literal('profileImage'), profileUid: z.string().min(1) }).strict(),
  z.object({ kind: z.literal('username'), profileUid: z.string().min(1) }).strict(),
  z.object({ kind: z.literal('craftSkill'), profileUid: z.string().min(1), craftSkillId: z.string().min(1) }).strict(),
  z.object({ kind: z.literal('commissionListing'), commissionListingId: z.string().min(1) }).strict(),
  z.object({ kind: z.literal('workProject'), workProjectId: z.string().min(1) }).strict(),
  z.object({ kind: z.literal('workRealm'), workRealmId: z.string().min(1) }).strict(),
  z.object({ kind: z.literal('audition'), auditionId: z.string().min(1) }).strict(),
  z.object({ kind: z.literal('auditionEntry'), auditionId: z.string().min(1), auditionEntryId: z.string().min(1) }).strict(),
  z.object({ kind: z.literal('guildInviteMessage'), channelId: z.string().min(1), messageId: z.string().min(1) }).strict(),
  z.object({ kind: z.literal('chatAttachment'), channelId: z.string().min(1), messageId: z.string().min(1), attachmentId: z.string().min(1) }).strict(),
  z.object({ kind: z.literal('url'), url: z.string().min(1) }).strict(),
  z.object({ kind: z.literal('additionalText'), textRef: z.string().min(1) }).strict(),
]);
export type TargetLocatorV1 = z.infer<typeof TargetLocatorV1Schema>;

/** The set of locator discriminants — used wherever only the `kind` is needed. */
export const TargetLocatorKindSchema = z.enum([
  'mediaAsset',
  'hallItem',
  'squarePost',
  'profileImage',
  'username',
  'craftSkill',
  'commissionListing',
  'workProject',
  'workRealm',
  'audition',
  'auditionEntry',
  'guildInviteMessage',
  'chatAttachment',
  'url',
  'additionalText',
]);
export type TargetLocatorKind = z.infer<typeof TargetLocatorKindSchema>;

/** Privacy-safe summary ONLY — no narrative / PII; used on roots + public rows. */
export const TargetLocatorSummaryV1Schema = z.object({
  kind: TargetLocatorKindSchema,
  surfaceLabel: z.string(),
  hasResolvedTarget: z.boolean(),
}).strict();
export type TargetLocatorSummaryV1 = z.infer<typeof TargetLocatorSummaryV1Schema>;

// ===========================================================================
// A9 — Reporting determination + NCMEC submission state
// ===========================================================================

/** Case-level reporting determination (Finding-H6). The ONLY carrier of "no
 * NCMEC report required" — `notRequired` was removed from NcmecSubmissionState. */
export const ReportDispositionSchema = z.enum([
  'undetermined',
  'reportRequired',
  'notRequired',
  'correctedNoApparentViolation',
]);
export type ReportDisposition = z.infer<typeof ReportDispositionSchema>;

/** Reason codes for the privileged setReportDisposition command (§A9). */
export const ReportDispositionReasonCodeSchema = z.enum([
  'outOfScopeNotCsea',
  'basisInvalidatedFalseMatch',
  'duplicateOfFiledReport',
  'leDirectedNoReport',
  'nonReportableSafetyConfirmed',
]);
export type ReportDispositionReasonCode = z.infer<typeof ReportDispositionReasonCodeSchema>;

/** NCMEC submission lifecycle — MANUAL-PORTAL model (§A9). NO `notRequired` (that is
 * ReportDisposition). There is no automated ispws API: a report-needed obligation sits in
 * `awaitingManualFiling` from enqueue until the operator files on the NCMEC portal and records the
 * confirmation (markNcmecPortalComplete → `completed`). `queued` is the case-list `ncmecStatus`
 * "report queued" projection; `retracted` is a terminal exit. The old API-drive states
 * (opening/open/uploading/addingFileDetails/finishing/retryableFailure/ambiguousResult/permanentFailure)
 * were removed with the live-API client. */
export const NcmecSubmissionStateSchema = z.enum([
  'queued',
  'awaitingManualFiling',
  'completed',
  'retracted',
]);
export type NcmecSubmissionState = z.infer<typeof NcmecSubmissionStateSchema>;

// ===========================================================================
// A3 — Safety-hold + resource-command vocabularies (the ONE destructive-guard
// authority). The NCII/storage resource types live in THIS enum (H1 fix).
// ===========================================================================

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

/** Lifecycle/retention regime governed by the A3 compatibility matrix. */
export const SafetyHoldClassSchema = z.enum([
  'childSafety',
  'nciiTemporary',
  'legalRetention',
  'preservationEvidence',
]);
export type SafetyHoldClass = z.infer<typeof SafetyHoldClassSchema>;

/** Resource-scoped destructive command kinds (A3). */
export const SafetyCommandKindSchema = z.enum([
  'nciiRemoval',
  'csamActiveByteRemoval',
  'evidenceDisposition',
]);
export type SafetyCommandKind = z.infer<typeof SafetyCommandKindSchema>;

// ===========================================================================
// Reviewer-capability matrix (§A11 [M4] + §A9). One solo operator holds all
// at launch; every privileged command checks the SPECIFIC capability + reauth.
// ===========================================================================

export const SafetyReviewerCapabilitySchema = z.enum([
  'nciiRequestReviewer',
  'nciiEvidenceReviewer',
  'nciiAppealReviewer',
  'childSafetyReviewer',
  'legalDispositionAuthority',
]);
export type SafetyReviewerCapability = z.infer<typeof SafetyReviewerCapabilitySchema>;

// ===========================================================================
// A7 — Registration-completion outcome (DOMAIN enum; replaces the unsafe
// generic gRPC retryable/terminal code lists). Only a domain outcome feeds the
// orphan-Auth deletion policy.
// ===========================================================================

export const RegistrationCompletionOutcomeSchema = z.enum([
  'completed',
  'alreadyCompletedSameUid',
  'retryableInfrastructureFailure',
  'reauthenticationRequired',
  'appCheckRetryRequired',
  'nonceExpired',
  'nonceUnknown',
  'nonceConsumedDifferentUid',
  'sessionHashMismatch',
  'attestationSignatureInvalid',
  'privateDataConflict',
  'policyVersionRejected',
]);
export type RegistrationCompletionOutcome = z.infer<typeof RegistrationCompletionOutcomeSchema>;

// ===========================================================================
// A11 — NCII / TAKE IT DOWN shared vocabularies (consumed by BOTH NCII clusters)
// ===========================================================================

/** Closed enum of required field codes — completeness + public missing-fields. */
export const TakeItDownFieldCodeSchema = z.enum([
  'requesterName',
  'contactEmail',
  'contactPhone',
  'requesterRole',
  'electronicSignature',
  'authorityBasis',
  'authorityEvidence',
  'targetLocator',
  'nonconsentStatement',
  'supportingFacts',
  'goodFaithCertification',
]);
export type TakeItDownFieldCode = z.infer<typeof TakeItDownFieldCodeSchema>;

/** Closed PUBLIC-SAFE reason codes — never reveal evidence/uploader/crossover. */
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

/** Validity-failure reason codes ([H2]). `incomplete` is a COMPLETENESS state,
 * NEVER a validity state. */
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
  'otherCounselApproved',
]);
export type TakeItDownInvalidReasonCode = z.infer<typeof TakeItDownInvalidReasonCodeSchema>;

/** Requester role (depicted person vs authorized representative). */
export const TakeItDownRequesterRoleSchema = z.enum(['depictedPerson', 'authorizedRepresentative']);
export type TakeItDownRequesterRole = z.infer<typeof TakeItDownRequesterRoleSchema>;

/** Two-axis state: completeness vs validity (H2). */
export const TakeItDownCompletenessStatusSchema = z.enum(['incomplete', 'complete']);
export type TakeItDownCompletenessStatus = z.infer<typeof TakeItDownCompletenessStatusSchema>;

export const TakeItDownValidityStatusSchema = z.enum(['pending', 'valid', 'invalid', 'unableToLocate']);
export type TakeItDownValidityStatus = z.infer<typeof TakeItDownValidityStatusSchema>;

/** The public no-login status-page status set (root + statusProjection). */
export const TakeItDownPublicStatusSchema = z.enum([
  'received',
  'needsMoreInfo',
  'validInProgress',
  'completed',
  'unableToLocate',
  'invalidGeneralReason',
  'appealedCorrected',
]);
export type TakeItDownPublicStatus = z.infer<typeof TakeItDownPublicStatusSchema>;

/** Request action types ([L1]). */
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

/** Honest derived completion ([H4]) — never 'completed' for a partial failure. */
export const NciiRemovalCompletionOutcomeSchema = z.enum([
  'completed',
  'completedWithApprovedException',
  'unableToComplete',
]);
export type NciiRemovalCompletionOutcome = z.infer<typeof NciiRemovalCompletionOutcomeSchema>;

export const NciiTargetSurfaceSchema = z.enum([
  'original',
  'hallCopy',
  'profileMedia',
  'chatAttachment',
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
  'terminalException',
]);
export type NciiTargetOutcome = z.infer<typeof NciiTargetOutcomeSchema>;

/** CLOSED terminal-exception enum — a technical outage is NOT an exception. */
export const NciiTerminalExceptionSchema = z.enum([
  'legallyPermittedRetention',
  'contentNotPresentVerified',
  'counselApprovedException',
]);
export type NciiTerminalException = z.infer<typeof NciiTerminalExceptionSchema>;

/** Internal operational case status ([H7]). */
export const NciiInternalStatusSchema = z.enum([
  'open',
  'removalInProgress',
  'removed',
  'rejected',
  'closed',
]);
export type NciiInternalStatus = z.infer<typeof NciiInternalStatusSchema>;

/** Child-safety linkage status on an NCII case ([H7]). */
export const NciiChildSafetyLinkStatusSchema = z.enum([
  'none',
  'assessmentPending',
  'linked',
  'resolvedNoChildSafetyCase',
]);
export type NciiChildSafetyLinkStatus = z.infer<typeof NciiChildSafetyLinkStatusSchema>;

// ===========================================================================
// A11 [F4] — child-safety crossover (possible-minor ≠ automatic CSAM).
// Embedded on nciiCases. childSafetyCaseId lives HERE (one canonical place).
// ===========================================================================

export const NciiMinorAssessmentSchema = z.enum(['adult', 'unknown', 'possibleMinor', 'confirmedMinor']);
export type NciiMinorAssessment = z.infer<typeof NciiMinorAssessmentSchema>;

export const NciiCsamAssessmentSchema = z.enum([
  'notAssessed',
  'notApparent',
  'apparentViolation',
  'validatedHashMatch',
]);
export type NciiCsamAssessment = z.infer<typeof NciiCsamAssessmentSchema>;

export const NciiChildSafetyCrossoverSchema = z.object({
  minorAssessment: NciiMinorAssessmentSchema,
  csamAssessment: NciiCsamAssessmentSchema,
  childSafetyCaseId: z.string().min(1).optional(),
  assessedByUid: z.string().min(1).optional(),
  assessedAt: z.number().optional(),
}).strict();
export type NciiChildSafetyCrossover = z.infer<typeof NciiChildSafetyCrossoverSchema>;
