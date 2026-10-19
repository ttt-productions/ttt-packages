// Trust & Safety — shared foundation enums + the canonical target locator.
//
// This file is the SINGLE SOURCE for every enum and locator that crosses more
// than one T&S cluster (report spine, case spine, holds, evidence, sagas,
// NCMEC, NCII). Cluster document-schema files import their value sets from
// HERE so two clusters can never define the same enum with drifting values.
//
// Cross-boundary: these types are consumed by both functions/src and src/ in
// ttt-prod, so they live in ttt-core (the single source of truth for the
// backend↔frontend boundary) and surface on the `@ttt-productions/ttt-core/
// doc-schemas` subpath.

import { z } from 'zod';
import {
  MAX_SAFETY_RESOLUTION_SUMMARY_LENGTH,
  MAX_SAFETY_ADMIN_NOTE_LENGTH,
} from '../../constants/business-admin.js';
import { ConversationFileRefSchema } from '../../media/conversation-file-ref.js';

// ===========================================================================
// Report reasons + reportable item types
// ===========================================================================

/** The controlling report-reason taxonomy, shared by client and server. The two protected
 * reasons fork into a childSafetyCase / nciiCase. */
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
  // Admin correspondence messages are NOT reportable at all — an admin is already a
  // participant in every admin conversation, work-party threads included.
  // A single file in a conversation's flat Conversation Files list (guild-invite or
  // admin-support scope). A message carries no file, so the report targets the FILE, whose `conversationFile`
  // TargetLocatorV1 carries the conversation ref + file id + mediaAssetId. Guild CHANNELS
  // have no Conversation Files, so no channel-scoped variant exists.
  'conversation-file',
  'hall-library-item',
  // A single Hall sub-item (a Tale chapter / Tune track / Television episode). The
  // `hallItem` TargetLocatorV1 already carries an optional `subItemId`; the report UI passes the
  // sub-item id + its parent hall item, and the resolver derives the canonical sub-item path
  // server-side, so a user can report the same single sub-item an admin can hide
  // (runSetHallSubItemHidden).
  'hall-library-sub-item',
  'audition',
  'audition-entry',
  'work-project',
  'work-asset',
  'work-realm',
]);
export type ReportableItemType = z.infer<typeof ReportableItemTypeSchema>;

/** The DO-transported chat report types — no Firestore message doc / owner exists to
 * hold at intake; the resolver goes through the signed chat-Worker context
 * read. These are the ONLY reportable message surfaces. Derived subset — compile-linked
 * to the canonical enum, never a re-declared string set. */
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
  // Conversation File — the media-backed file record, actioned exactly like `work-asset`
  // (the other shared-file surface): the action targets the file + its mediaAsset, never
  // a chat message.
  'conversation-file',
] as const satisfies readonly ReportableItemType[];
export type ContentActionPanelItemType = (typeof CONTENT_ACTION_PANEL_ITEM_TYPES)[number];

/** Single-doc content the moderation hide/restore core resolves to one doc with one `hidden` flag.
 * A craft skill is not one: it is denormalized across its per-user doc and tag-index mirrors, so
 * the hide owner reads it as its own set of documents. */
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

/** Moderation types whose canonical doc has NO doc-level `hidden` flag (a strict mediaAsset doc, a
 * userProfile that must never be wholesale-hidden, a Conversation File record that carries
 * references only): hiding one IS the media-serving deny on its asset. */
export const MEDIA_SERVING_ONLY_ITEM_TYPES = [
  'work-asset',
  'profile-picture',
  'conversation-file',
] as const satisfies readonly ModeratableItemType[];
export type MediaServingOnlyItemType = (typeof MEDIA_SERVING_ONLY_ITEM_TYPES)[number];

/** Types moderated by a block on their own mediaAssetId, never an owner-level block: their
 * processor's owner key is not the reported asset id, so an owner block would never match at the
 * serving Worker. */
export const ASSET_LEVEL_BLOCK_ITEM_TYPES = [
  'work-asset',
  'conversation-file',
] as const satisfies readonly MediaServingOnlyItemType[];
export type AssetLevelBlockItemType = (typeof ASSET_LEVEL_BLOCK_ITEM_TYPES)[number];

/** Reported targets the admin's single-doc content remedies (hide, restore, perma-remove) apply
 * to. A Conversation File is the other shared-file surface, so it takes the same remedies as a
 * Work file. */
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

/** The single-doc targets hide and restore apply to: a Hall sub-item is hide/restore-only (its core
 * has no perma-remove), so it joins these and not perma-remove. */
export const SINGLE_DOC_HIDE_RESTORE_TARGET_TYPES = [
  ...SINGLE_DOC_TARGET_TYPES,
  'hall-library-sub-item',
] as const satisfies readonly ContentActionPanelItemType[];

/** Hall content reports whose admin content window offers the full-page Hall item preview. */
export const HALL_LIBRARY_TARGET_TYPES = [
  'hall-library-item',
  'hall-library-sub-item',
] as const satisfies readonly ContentActionPanelItemType[];

// ===========================================================================
// Target locator (the ONE typed locator used by allegations, temp holds,
// removal targets, and the report resolver) + privacy-safe summary
// ===========================================================================

/** Discriminated locator, never an all-optional `contentRef`. Every hideable surface in
 * report-config.ts has a typed locator. */
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
  // A file in a conversation's flat Conversation Files list. A file is never embedded in,
  // sequenced with, or mutated through a chat message, so it is located by its CONVERSATION + file id,
  // never by a channel/message coordinate. `conversation` is the canonical
  // `ConversationFileRef` (exactly two scopes — guildInvite / adminSupport), so a
  // guild CHANNEL conversation file is structurally inexpressible here: guild
  // channels have no Conversation Files. `mediaAssetId` is carried so the removal
  // saga can hold/retire the bytes without a second resolve.
  z
    .object({
      kind: z.literal('conversationFile'),
      conversation: ConversationFileRefSchema,
      conversationFileId: z.string().min(1),
      mediaAssetId: z.string().min(1),
    })
    .strict(),
  // Plain guild chat message (text-only or Worker-unresolved). Chat is
  // text-only, so this is the ONLY guild-channel message locator.
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
  // A Conversation File (guild-invite / admin-support scope).
  'conversationFile',
  // Plain guild chat message locator (text-only / Worker-unresolved protected report).
  'guildChatMessage',
  'url',
  'additionalText',
]);
export type TargetLocatorKind = z.infer<typeof TargetLocatorKindSchema>;

/** Privacy-safe summary ONLY — no narrative / PII; used on roots + public rows. */
export const TargetLocatorSummaryV1Schema = z
  .object({
    kind: TargetLocatorKindSchema,
    surfaceLabel: z.string(),
    hasResolvedTarget: z.boolean(),
  })
  .strict();
export type TargetLocatorSummaryV1 = z.infer<typeof TargetLocatorSummaryV1Schema>;

// ===========================================================================
// Reporting determination + NCMEC submission state
// ===========================================================================

/** Case-level reporting determination. The ONLY carrier of "no NCMEC report required" —
 * NcmecSubmissionState has no `notRequired`. */
export const ReportDispositionSchema = z.enum([
  'undetermined',
  'reportRequired',
  'notRequired',
  'correctedNoApparentViolation',
]);
export type ReportDisposition = z.infer<typeof ReportDispositionSchema>;

/** Reason codes for the privileged setReportDisposition command. The first five are the
 * not-required / exception reasons (no NCMEC report ever arose, or a triggering signal was
 * corrected); the last two are the report-required reasons (a report IS legally required). The
 * disposition↔reason pairing is enforced by the ONE cross-field rule below (ARCH-102). */
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

/** The ONE cross-field pairing (ARCH-102): which reason codes each disposition permits.
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

/** Shared cross-field rule: disposition 'reportRequired' MUST carry at least one evidence ref —
 * a reporting obligation can only be asserted once the evidence has been revealed. Every OTHER
 * disposition ('notRequired', 'correctedNoApparentViolation', 'undetermined') MAY leave evidenceRefs
 * empty. Declared HERE once (ARCH-102) and applied — alongside refineReportDispositionReasonCode — by
 * BOTH the setReportDisposition input schemas (case.ts) and the SafetyStagedAction console command
 * (admin.ts), never re-declared. Reports the failure on the `evidenceRefs` path. */
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

// ===========================================================================
// Structured safety-case CLOSURE record — the operator's terminal
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

/** NCMEC submission lifecycle — MANUAL-PORTAL model. NO `notRequired` (that is
 * ReportDisposition). There is no automated ispws API: a report-needed obligation sits in
 * `awaitingManualFiling` from enqueue until the operator files on the NCMEC portal and records the
 * confirmation (markNcmecPortalComplete → `completed`). Jobs are born `awaitingManualFiling`; the
 * case-list `ncmecStatus` projection uses the same value (no separate `queued` state). There is no
 * in-app retraction — corrections are portal-manual. */
export const NcmecSubmissionStateSchema = z.enum(['awaitingManualFiling', 'completed']);
export type NcmecSubmissionState = z.infer<typeof NcmecSubmissionStateSchema>;

// ===========================================================================
// Safety-hold + resource-command vocabularies (the ONE destructive-guard
// authority). The NCII/storage resource types live in THIS enum.
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

/** Lifecycle/retention regime governed by the hold compatibility matrix. */
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

/** Resource-scoped destructive command kinds. */
export const SafetyCommandKindSchema = z.enum([
  'nciiRemoval',
  'csamActiveByteRemoval',
  'evidenceDisposition',
]);
export type SafetyCommandKind = z.infer<typeof SafetyCommandKindSchema>;

// ===========================================================================
// Reviewer-capability matrix. One solo operator holds all of them; every privileged command checks the SPECIFIC capability + reauth.
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
// Registration-completion outcome — the DOMAIN result of completing a registration,
// never a raw gRPC or infrastructure code. The completion route decides from it whether
// the age fields stand, the person re-does the age step, the same attestation is retried,
// or — `registrationExpired` — the orphan cleanup has already claimed this login for deletion
// and the person must sign up again; no outcome deletes the login itself.
// ===========================================================================

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

// ===========================================================================
// NCII / TAKE IT DOWN shared vocabularies (consumed by BOTH NCII clusters)
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

/** Validity-failure reason codes. `incomplete` is a COMPLETENESS state,
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

/** Two-axis state: completeness vs validity. */
export const TakeItDownCompletenessStatusSchema = z.enum(['incomplete', 'complete']);
export type TakeItDownCompletenessStatus = z.infer<typeof TakeItDownCompletenessStatusSchema>;

export const TakeItDownValidityStatusSchema = z.enum([
  'pending',
  'valid',
  'invalid',
  'unableToLocate',
]);
export type TakeItDownValidityStatus = z.infer<typeof TakeItDownValidityStatusSchema>;

/** The request root's public status set. No appeal model — no `appealedCorrected`
 * (protected reports have no uploader appeal/notice/reinstatement). */
export const TakeItDownPublicStatusSchema = z.enum([
  'received',
  'needsMoreInfo',
  'validInProgress',
  'completed',
  'unableToLocate',
  'invalidGeneralReason',
]);
export type TakeItDownPublicStatus = z.infer<typeof TakeItDownPublicStatusSchema>;

/** Request action types. */
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

/** Honest derived completion — never 'completed' for a partial failure. */
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
  // A conversation's Conversation File copy (chat messages carry no media).
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

/** Internal operational case status.
 *
 * Close-lifecycle states: clicking **Close** (after the strict-closable gate passes)
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

/** Child-safety linkage status on an NCII case. */
export const NciiChildSafetyLinkStatusSchema = z.enum([
  'none',
  'assessmentPending',
  'linked',
  'resolvedNoChildSafetyCase',
]);
export type NciiChildSafetyLinkStatus = z.infer<typeof NciiChildSafetyLinkStatusSchema>;

// ===========================================================================
// Child-safety crossover (possible-minor ≠ automatic CSAM).
// Embedded on nciiCases. childSafetyCaseId lives HERE (one canonical place).
// ===========================================================================

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

/** The status of one possible-minor crossover side effect (serving deny, PhotoDNA) on a crossover
 * item row (`ChildSafetyCrossoverItemV1`) and its rollup on the case
 * (`ChildSafetyCaseV1.crossoverLegs`). `pending` is written in the transaction that registers the
 * item, before the post-commit leg runs; the leg then sets `done` (succeeded) or `failed` (captured,
 * awaiting the reconciler). An item's leg is ABSENT when it never applies — an asset with no origin
 * lineage has nothing to scan. */
export const SafetyCrossoverLegStatusSchema = z.enum(['pending', 'done', 'failed']);
export type SafetyCrossoverLegStatus = z.infer<typeof SafetyCrossoverLegStatusSchema>;
