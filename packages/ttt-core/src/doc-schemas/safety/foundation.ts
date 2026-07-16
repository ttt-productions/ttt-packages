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
import {
  MAX_SAFETY_RESOLUTION_SUMMARY_LENGTH,
  MAX_SAFETY_ADMIN_NOTE_LENGTH,
} from '../../constants/business.js';

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
  'Not related to on-site entertainment',
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
  'commission-proposal',
  'square-streetz-post',
  'profile-picture',
  'guild-invite-message',
  'guild-chat-message',
  // A single message in a WORK-PARTY admin correspondence thread (pendingAdminDispatches
  // partyKind 'workProject' — the one multi-member chat surface transported through
  // Firestore `conversationMessages`). The resolver enforces the work-party kind
  // server-side; user↔admin support threads are NOT reportable (an admin is already a
  // participant in every thread — DJ ruling 2026-07-13).
  'admin-work-message',
  'hall-library-item',
  // [EUAS-017] a single Hall sub-item (a Tale chapter / Tune track / Television episode). The
  // `hallItem` TargetLocatorV1 already carries an optional `subItemId`; the report UI passes the
  // sub-item id + its parent hall item, and the resolver derives the canonical sub-item path
  // server-side. Admins can already hide a single sub-item (runSetHallSubItemHidden) — this makes the
  // matching user-facing report reachable.
  'hall-library-sub-item',
  'audition',
  'audition-entry',
  'work-project',
  'work-asset',
  'work-realm',
]);
export type ReportableItemType = z.infer<typeof ReportableItemTypeSchema>;

/** The DO-transported chat report types — no Firestore message doc / owner exists to
 * hold at intake (H-04 V1); the resolver goes through the signed chat-Worker context
 * read. `admin-work-message` is NOT here: its messages are Firestore docs. Derived
 * subset — compile-linked to the canonical enum, never a re-declared string set. */
export const CHAT_REPORT_ITEM_TYPES = [
  'guild-chat-message',
  'guild-invite-message',
] as const satisfies readonly ReportableItemType[];

/** Item types whose report work-view renders the content-action (moderate) panel —
 * the backend moderation cores accept these. Compile-linked subset of the enum. */
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
  // Work-party admin correspondence message — single-doc hidden flip (2026-07-13).
  'admin-work-message',
] as const satisfies readonly ReportableItemType[];
export type ContentActionPanelItemType = (typeof CONTENT_ACTION_PANEL_ITEM_TYPES)[number];

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
  z.object({ kind: z.literal('commissionProposal'), commissionListingId: z.string().min(1), commissionProposalId: z.string().min(1) }).strict(),
  z.object({ kind: z.literal('workProject'), workProjectId: z.string().min(1) }).strict(),
  z.object({ kind: z.literal('workAsset'), workProjectId: z.string().min(1), workAssetId: z.string().min(1) }).strict(),
  z.object({ kind: z.literal('workRealm'), workRealmId: z.string().min(1) }).strict(),
  z.object({ kind: z.literal('audition'), auditionId: z.string().min(1) }).strict(),
  z.object({ kind: z.literal('auditionEntry'), auditionId: z.string().min(1), auditionEntryId: z.string().min(1) }).strict(),
  z.object({ kind: z.literal('guildInviteMessage'), channelId: z.string().min(1), messageId: z.string().min(1) }).strict(),
  z.object({ kind: z.literal('chatAttachment'), channelId: z.string().min(1), messageId: z.string().min(1), attachmentId: z.string().min(1) }).strict(),
  // [H-04 V1] Plain guild chat message (text-only or Worker-unresolved). Distinct from
  // `chatAttachment` (which carries an actual attachment id) so a text-only protected chat
  // report has a clean, unambiguous locator without misusing the attachment variant.
  z.object({ kind: z.literal('guildChatMessage'), channelId: z.string().min(1), messageId: z.string().min(1) }).strict(),
  // A work-party admin correspondence message — a Firestore doc at
  // pendingAdminDispatches/{adminDispatchId}/conversationMessages/{messageId} (unlike the
  // DO-addressed guildChatMessage/guildInviteMessage locators, messageId here is a doc id,
  // not a numeric seq).
  z.object({ kind: z.literal('adminWorkMessage'), adminDispatchId: z.string().min(1), messageId: z.string().min(1) }).strict(),
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
  'commissionProposal',
  'workProject',
  'workAsset',
  'workRealm',
  'audition',
  'auditionEntry',
  'guildInviteMessage',
  'chatAttachment',
  // [H-04 V1] Plain guild chat message locator (text-only / Worker-unresolved protected report).
  'guildChatMessage',
  // Work-party admin correspondence message (Firestore conversationMessages doc).
  'adminWorkMessage',
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

/** Reason codes for the privileged setReportDisposition command (§A9). The first five are the
 * not-required / exception reasons (no NCMEC report ever arose, or a triggering signal was
 * corrected); the last two are the report-required reasons (a report IS legally required). The
 * disposition↔reason pairing is enforced by the ONE cross-field rule below (Rule 36). */
export const ReportDispositionReasonCodeSchema = z.enum([
  'outOfScopeNotCsea',
  'basisInvalidatedFalseMatch',
  'duplicateOfFiledReport',
  'leDirectedNoReport',
  'nonReportableSafetyConfirmed',
  // Report-required reasons — valid ONLY with disposition 'reportRequired'.
  'apparentCsamConfirmed', // human review confirmed apparent CSAM
  'hashMatchValidated', // validated hash match
]);
export type ReportDispositionReasonCode = z.infer<typeof ReportDispositionReasonCodeSchema>;

/** The reason codes that ASSERT a reporting obligation — legal ONLY with 'reportRequired'.
 * Compile-linked subset of the canonical reason enum. */
export const REPORT_REQUIRED_DISPOSITION_REASON_CODES = [
  'apparentCsamConfirmed',
  'hashMatchValidated',
] as const satisfies readonly ReportDispositionReasonCode[];

/** The not-required / exception reason codes — legal with every disposition that does NOT assert a
 * reporting obligation ('notRequired', 'correctedNoApparentViolation'). Compile-linked subset. */
export const NOT_REQUIRED_DISPOSITION_REASON_CODES = [
  'outOfScopeNotCsea',
  'basisInvalidatedFalseMatch',
  'duplicateOfFiledReport',
  'leDirectedNoReport',
  'nonReportableSafetyConfirmed',
] as const satisfies readonly ReportDispositionReasonCode[];

/** The ONE cross-field pairing (§A9, Rule 36): which reason codes each disposition permits.
 * Declared HERE once; both the setReportDisposition input (case.ts) and the SafetyDispositionAction
 * console command (admin.ts) apply `refineReportDispositionReasonCode` derived from this map rather
 * than re-declaring the pairing. 'undetermined' is the initial state, never an operator-settable
 * target, so it permits NO reason code (the operator command excludes it). Typed as an exhaustive
 * Record so a new disposition fails to compile until its permitted codes are declared. */
export const REPORT_DISPOSITION_ALLOWED_REASON_CODES: Record<
  ReportDisposition,
  readonly ReportDispositionReasonCode[]
> = {
  undetermined: [],
  reportRequired: REPORT_REQUIRED_DISPOSITION_REASON_CODES,
  notRequired: NOT_REQUIRED_DISPOSITION_REASON_CODES,
  correctedNoApparentViolation: NOT_REQUIRED_DISPOSITION_REASON_CODES,
};

/** Shared cross-field refinement enforcing the disposition↔reason pairing above. Applied by BOTH
 * the setReportDisposition input schemas and the SafetyDispositionAction console command so the
 * rule lives in exactly one place. Reports the failure on the `dispositionReasonCode` path. */
export function refineReportDispositionReasonCode(
  value: { disposition: ReportDisposition; dispositionReasonCode: ReportDispositionReasonCode },
  ctx: z.RefinementCtx,
): void {
  if (!REPORT_DISPOSITION_ALLOWED_REASON_CODES[value.disposition].includes(value.dispositionReasonCode)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['dispositionReasonCode'],
      message: `Reason code '${value.dispositionReasonCode}' is not valid for disposition '${value.disposition}'.`,
    });
  }
}

// ===========================================================================
// [EUAS-008] Structured safety-case CLOSURE record — the operator's terminal
// determination persisted when a CSAM / NCII case is closed via the guided
// resolution flow (resolveAdminTask). Embedded on the NCII case (`closure`) and on
// a child-safety `decisions/{id}` row (kind `caseClosed`) so both case types carry
// the SAME structured outcome/summary/note + actor/timestamp — not just a status
// flip. This does NOT replace the case lifecycle's own terminal status; it records
// WHO closed it, WHY, and with what outcome.
// ===========================================================================

/** founded = a violation was substantiated; unfounded = no violation on review. */
export const SafetyCaseClosureOutcomeSchema = z.enum(['founded', 'unfounded']);
export type SafetyCaseClosureOutcome = z.infer<typeof SafetyCaseClosureOutcomeSchema>;

/** The structured closure record written on a safety-case close. */
export const SafetyCaseClosureV1Schema = z.object({
  outcome: SafetyCaseClosureOutcomeSchema,
  resolutionSummary: z.string().min(1).max(MAX_SAFETY_RESOLUTION_SUMMARY_LENGTH),
  adminNote: z.string().max(MAX_SAFETY_ADMIN_NOTE_LENGTH).optional(),
  closedByUid: z.string().min(1),
  closedAt: z.number(),
}).strict();
export type SafetyCaseClosureV1 = z.infer<typeof SafetyCaseClosureV1Schema>;

/** NCMEC submission lifecycle — MANUAL-PORTAL model (§A9). NO `notRequired` (that is
 * ReportDisposition). There is no automated ispws API: a report-needed obligation sits in
 * `awaitingManualFiling` from enqueue until the operator files on the NCMEC portal and records the
 * confirmation (markNcmecPortalComplete → `completed`). Jobs are born `awaitingManualFiling`; the
 * case-list `ncmecStatus` projection uses the same value (no separate `queued` state). There is no
 * in-app retraction — corrections are portal-manual (correction-lifecycle decision). The old
 * API-drive states
 * (opening/open/uploading/addingFileDetails/finishing/retryableFailure/ambiguousResult/permanentFailure)
 * were removed with the live-API client. */
export const NcmecSubmissionStateSchema = z.enum([
  'awaitingManualFiling',
  'completed',
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
  // An OPEN ordinary (non-protected) content report places an account-level hold
  // (resourceType 'account', ownerUid = the reported user) so a user can't delete
  // their data out from under an unreviewed report (e.g. a DMCA/IP complaint, then
  // delete-to-clear-tracks). blocksDeletion + blocksAnonymization; released when the
  // report group's admin close-out resolves it. Durable (no expiresAt).
  'ordinaryReport',
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
  'authorityCertification',
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

/** The public no-login status-page status set (root + statusProjection). No
 * appeal model — no `appealedCorrected` (the appeal/reinstatement flow was
 * removed; protected reports have no uploader appeal/notice/reinstatement). */
export const TakeItDownPublicStatusSchema = z.enum([
  'received',
  'needsMoreInfo',
  'validInProgress',
  'completed',
  'unableToLocate',
  'invalidGeneralReason',
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

/** Internal operational case status ([H7]).
 *
 * [R12] close-lifecycle states: clicking **Close** (after the strict-closable gate passes)
 * applies the staged actions and moves the case to `processing` — it STAYS pinned/in-queue,
 * NEVER cleared on the click. The NCII removal worker flips the case to the terminal `closed`
 * ONLY on VERIFIED removal completion (clearing the pin via onSafetyCaseClosed). If the
 * removal saga exhausts its retries (dead-letter), the case moves to `failed` — kept pinned,
 * surfaced in the Safety Console failed-jobs view, with a Restart that re-arms the job. Both
 * are explicit values (never derived). */
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

/** [H-2] Per-leg lifecycle status for the possible-minor crossover side-effects (serving-deny,
 * PhotoDNA) persisted on the crossover child-safety case (see ChildSafetyCaseV1.crossoverLegs).
 * `pending` is the in-transaction initial marker the assessment writes before the post-commit leg
 * runs; the leg then flips it to `done` (succeeded) or `failed` (captureException'd, awaiting a
 * reconcile/replay). A leg is ABSENT (not `pending`) when it never applied — an external / no-media
 * target has no bytes to deny or scan. */
export const SafetyCrossoverLegStatusSchema = z.enum(['pending', 'done', 'failed']);
export type SafetyCrossoverLegStatus = z.infer<typeof SafetyCrossoverLegStatusSchema>;
