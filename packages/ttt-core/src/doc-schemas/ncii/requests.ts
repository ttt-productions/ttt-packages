// Trust & Safety — NCII statutory TAKE IT DOWN requests (Appendix A §A11, concept
// (2)) — the SPLIT model: a PII-free root + a restricted requester-PII subdoc +
// immutable submissions/validityDecisions + operator actions + a public-safe
// status projection + isolated public evidence uploads.
//
// Only a COMPLETE + VALID request can arm the 48h clock. The public no-login form
// CANNOT submit a "valid request" without the required fields; validation
// failures use the enumerated TakeItDownInvalidReasonCode. The root holds NO
// requester PII / narrative / signature / authority — those live in the restricted
// `/private/requester` subdoc. Status is shown publicly via an unguessable
// status-token hash (rotatable + revocable) + a public-safe projection — never via
// the root or any queue projection.
//
// Every shape here is transcribed verbatim from docs/code_changes_needed/
// trust-and-safety/IMPLEMENTATION_PLAN.md Appendix A §A11 (2) + [C-02] + [F7] +
// [F10] — no invented values, no placeholders.
//
// SHARED enums + locator types come from ../safety/foundation.js (the single
// source for every cross-cluster enum); they are NEVER redefined here. This
// cluster IMPORTS TakeItDownRequesterRoleSchema, TargetLocatorSummaryV1Schema,
// TakeItDownCompletenessStatusSchema, TakeItDownValidityStatusSchema,
// TakeItDownInvalidReasonCodeSchema, TakeItDownPublicStatusSchema,
// NciiRemovalCompletionOutcomeSchema, NciiActionTypeSchema, NciiActionResultSchema,
// TakeItDownFieldCodeSchema, TakeItDownPublicReasonCodeSchema, and
// SafetyReviewerCapabilitySchema.
//
// Collection note: this cluster introduces a NEW Firestore collection plus several
// subcollections (private/requester, submissions, validityDecisions, actions,
// statusProjection/current, evidence). Wiring collections.ts / path-builders.ts /
// registry.ts is deferred to the app leg (the orchestrator binds the schemas +
// path builders there); the doc-id shapes (including the deterministic intake
// requestId [H-07]) are documented on each schema below.

import { z } from 'zod';
import {
  TakeItDownRequesterRoleSchema,
  TargetLocatorSummaryV1Schema,
  TakeItDownCompletenessStatusSchema,
  TakeItDownValidityStatusSchema,
  TakeItDownInvalidReasonCodeSchema,
  TakeItDownPublicStatusSchema,
  NciiRemovalCompletionOutcomeSchema,
  NciiActionTypeSchema,
  NciiActionResultSchema,
  TakeItDownFieldCodeSchema,
  TakeItDownPublicReasonCodeSchema,
  SafetyReviewerCapabilitySchema,
  type TakeItDownFieldCode,
  type TakeItDownRequesterRole,
} from '../safety/foundation.js';

// ===========================================================================
// §A11 (2) [H1] — ROOT takeItDownRequests/{requestId} = TakeItDownRequestRootV1
// (NO requester PII / narrative / signature / authority). [H-07] the intake
// `requestId` is the deterministic sha256('takeItDownRequest:v1:' +
// idempotencyKey + ':' + normalizedTargetKey) so retries resolve to one doc.
// ===========================================================================

export const TakeItDownRequestRootV1Schema = z.object({
  schemaVersion: z.literal(1),
  requestId: z.string().min(1),
  caseId: z.string().min(1).optional(),
  requesterRole: TakeItDownRequesterRoleSchema,
  // privacy-safe summary ONLY — never the narrative
  targetLocatorSummary: TargetLocatorSummaryV1Schema,
  receivedAt: z.number(),
  completenessStatus: TakeItDownCompletenessStatusSchema, // 'incomplete' | 'complete'
  validityStatus: TakeItDownValidityStatusSchema, // 'pending' | 'valid' | 'invalid' | 'unableToLocate'
  invalidReasonCode: TakeItDownInvalidReasonCodeSchema.optional(),
  completenessDeterminedAt: z.number().optional(),
  validityDeterminedAt: z.number().optional(),
  completedBySubmissionId: z.string().min(1).optional(), // which immutable submission completed the request
  validRequestReceivedAt: z.number().optional(), // [F3] EARLIEST complete+valid receipt — pins the clock
  removalDeadlineAt: z.number().optional(), // = validRequestReceivedAt + 48h (non-authoritative projection; [H4])
  publicStatus: TakeItDownPublicStatusSchema,
  statusTokenHash: z.string().min(1), // sha256(token) ONLY — the raw token is never stored
  statusTokenVersion: z.number(), // rotation
  statusTokenRevokedAt: z.number().optional(), // revocation
  statusTokenExpiresAt: z.number().optional(), // [M3] expires from FINAL request closure (statusTokenRetentionDays)
  requestClosedAt: z.number().optional(), // when the request reached a terminal disposition
  removalCompletionAt: z.number().optional(), // [M-01] set when removal verified-completes
  finalClosedAt: z.number().optional(), // [H-08] = requestClosedAt (no appeal window); arms for EVERY terminal disposition. The request's retention clocks (PII / evidence / status-token) count from here.
  removalCompletionOutcome: NciiRemovalCompletionOutcomeSchema.optional(), // [H4] honest derived completion — NEVER 'completed' for a partial technical failure
  createdAt: z.number(),
  updatedAt: z.number(),
}).strict();
export type TakeItDownRequestRootV1 = z.infer<typeof TakeItDownRequestRootV1Schema>;

// ===========================================================================
// §A11 (2) [H1] / [F7] — RESTRICTED takeItDownRequests/{requestId}/private/requester
// = TakeItDownRequesterPrivateV1 (nciiRequestReviewer / nciiEvidenceReviewer only).
// Holds signature, full contact, narrative, certifications.
// ===========================================================================

/** electronicSignature.signatureMethod — typed vs drawn signature. */
export const TakeItDownSignatureMethodSchema = z.enum(['typedName', 'drawnSignature']);
export type TakeItDownSignatureMethod = z.infer<typeof TakeItDownSignatureMethodSchema>;

/** The statutory electronic signature block (embedded on the restricted subdoc). */
export const TakeItDownElectronicSignatureV1Schema = z.object({
  signedName: z.string(),
  signedAt: z.number(),
  signatureMethod: TakeItDownSignatureMethodSchema,
}).strict();
export type TakeItDownElectronicSignatureV1 = z.infer<typeof TakeItDownElectronicSignatureV1Schema>;

/** The authorized-representative block — present only for an
 * `authorizedRepresentative` requester. */
export const TakeItDownAuthorizedRepresentativeV1Schema = z.object({
  representedPersonName: z.string(),
  authorityBasis: z.string(),
  authorityEvidenceRef: z.string().min(1).optional(),
}).strict();
export type TakeItDownAuthorizedRepresentativeV1 = z.infer<typeof TakeItDownAuthorizedRepresentativeV1Schema>;

/** `takeItDownRequests/{requestId}/private/requester` = TakeItDownRequesterPrivateV1.
 * RESTRICTED — nciiRequestReviewer / nciiEvidenceReviewer only. Fixed doc id
 * `requester`. */
export const TakeItDownRequesterPrivateV1Schema = z.object({
  schemaVersion: z.literal(1),
  requesterName: z.string(),
  contactEmail: z.string(),
  contactPhone: z.string().optional(),
  electronicSignature: TakeItDownElectronicSignatureV1Schema,
  authorizedRepresentative: TakeItDownAuthorizedRepresentativeV1Schema.optional(),
  nonconsentStatement: z.string(), // the statutory non-consent statement
  supportingFacts: z.string(),
  goodFaithCertification: z.boolean(),
  accuracyCertification: z.boolean().optional(), // [H2] NOT a hard validity gate by default — counsel decides
  authorityCertification: z.boolean().optional(), // [H2] NOT a hard validity gate by default — counsel decides
  createdAt: z.number(),
  updatedAt: z.number(),
}).strict();
export type TakeItDownRequesterPrivateV1 = z.infer<typeof TakeItDownRequesterPrivateV1Schema>;

// ===========================================================================
// §A11 (2) [H1] — IMMUTABLE takeItDownRequests/{requestId}/submissions/{submissionId}
// = TakeItDownSubmissionV1 (append-only; the earliest complete receipt is
// reconstructed from these, never from the mutable root).
// ===========================================================================

/** Who created a submission. */
export const TakeItDownSubmissionCreatedBySchema = z.enum(['requester', 'operator', 'system']);
export type TakeItDownSubmissionCreatedBy = z.infer<typeof TakeItDownSubmissionCreatedBySchema>;

/** `takeItDownRequests/{requestId}/submissions/{submissionId}` = TakeItDownSubmissionV1
 * — IMMUTABLE append-only. Doc id `submissionId` is a deterministic/assigned id. */
export const TakeItDownSubmissionV1Schema = z.object({
  schemaVersion: z.literal(1),
  submissionId: z.string().min(1),
  sequence: z.number(), // monotonic per request — append order
  receivedAt: z.number(), // the immutable statutory receipt time of THIS submission
  suppliedFieldCodes: z.array(TakeItDownFieldCodeSchema).max(16),
  evidenceIds: z.array(z.string().min(1)).max(16),
  cumulativeRequestSnapshotHash: z.string(), // hash of the cumulative request state as of this submission
  cumulativeCompleteness: TakeItDownCompletenessStatusSchema, // 'incomplete' | 'complete'
  firstCompletedRequest: z.boolean(), // true on the submission whose cumulative state FIRST became complete
  supersedesSubmissionId: z.string().min(1).optional(),
  createdBy: TakeItDownSubmissionCreatedBySchema,
}).strict();
export type TakeItDownSubmissionV1 = z.infer<typeof TakeItDownSubmissionV1Schema>;

// ===========================================================================
// §A11 (2) [H2] — IMMUTABLE takeItDownRequests/{requestId}/validityDecisions/{decisionId}
// = TakeItDownValidityDecisionV1 (append-only; the authoritative validity ruling —
// the root `validityStatus` is its projection). `incomplete` is NEVER a validity
// result.
// ===========================================================================

/** The validity-decision result. `incomplete` is a COMPLETENESS state, NEVER a
 * validity result. */
export const TakeItDownValidityDecisionResultSchema = z.enum(['valid', 'invalid', 'unableToLocate']);
export type TakeItDownValidityDecisionResult = z.infer<typeof TakeItDownValidityDecisionResultSchema>;

/** `takeItDownRequests/{requestId}/validityDecisions/{decisionId}` =
 * TakeItDownValidityDecisionV1 — IMMUTABLE append-only. Doc id `decisionId` is a
 * deterministic/assigned id. */
export const TakeItDownValidityDecisionV1Schema = z.object({
  schemaVersion: z.literal(1),
  decisionId: z.string().min(1),
  requestId: z.string().min(1),
  result: TakeItDownValidityDecisionResultSchema,
  basisSubmissionIds: z.array(z.string().min(1)).max(16), // the submissions the decision relied on
  validFromSubmissionId: z.string().min(1).optional(), // the EARLIEST submission whose cumulative snapshot satisfies the valid decision
  validRequestReceivedAt: z.number().optional(), // = that submission's immutable receivedAt (the binding statutory time)
  reasonCode: TakeItDownInvalidReasonCodeSchema.optional(),
  rationaleRef: z.string(), // pointer to a restricted rationale row
  decidedByUid: z.string().min(1),
  decidedAt: z.number(),
}).strict();
export type TakeItDownValidityDecisionV1 = z.infer<typeof TakeItDownValidityDecisionV1Schema>;

// ===========================================================================
// §A11 (2) [L1] — takeItDownRequests/{requestId}/actions/{actionId} = the request
// action row (CLOSED enums + a detailRef to a RESTRICTED row, never an inline
// rationale blob).
// ===========================================================================

/** `takeItDownRequests/{requestId}/actions/{actionId}` — the [L1] closed-enum +
 * detailRef row. Doc id `actionId` is a deterministic/assigned id. */
export const TakeItDownRequestActionV1Schema = z.object({
  schemaVersion: z.literal(1),
  actionId: z.string().min(1),
  at: z.number(),
  actorId: z.string().min(1),
  capability: SafetyReviewerCapabilitySchema, // = the §[M4] matrix capability used
  actionType: NciiActionTypeSchema,
  result: NciiActionResultSchema,
  summary: z.string().max(280), // BOUNDED ≤ 280 chars, non-sensitive
  detailRef: z.string().min(1), // pointer to a RESTRICTED detail row holding any sensitive rationale
}).strict();
export type TakeItDownRequestActionV1 = z.infer<typeof TakeItDownRequestActionV1Schema>;

// ===========================================================================
// §A11 (2) [H3] — takeItDownRequests/{requestId}/statusProjection/current =
// TakeItDownPublicStatusV1 (public-safe ONLY — the single row the no-login status
// page reads). Routed on the OPAQUE requestReference, never the raw requestId.
// ===========================================================================

/** The public status page's `nextAction` hint. */
export const TakeItDownPublicNextActionSchema = z.enum([
  'none',
  'submitSupplement',
  'checkLater',
]);
export type TakeItDownPublicNextAction = z.infer<typeof TakeItDownPublicNextActionSchema>;

/** `takeItDownRequests/{requestId}/statusProjection/current` =
 * TakeItDownPublicStatusV1. Fixed doc id `current`. */
export const TakeItDownPublicStatusV1Schema = z.object({
  schemaVersion: z.literal(1),
  requestReference: z.string().min(1), // opaque public reference (NOT the requestId, NOT PII)
  publicStatus: TakeItDownPublicStatusSchema,
  publicReasonCode: TakeItDownPublicReasonCodeSchema.optional(),
  missingFieldCodes: z.array(TakeItDownFieldCodeSchema).max(16).optional(),
  nextAction: TakeItDownPublicNextActionSchema.optional(),
  removalDeadlineAt: z.number().optional(),
  updatedAt: z.number(),
}).strict();
export type TakeItDownPublicStatusV1 = z.infer<typeof TakeItDownPublicStatusV1Schema>;

// ===========================================================================
// §A11 (2) [F10] — takeItDownRequests/{requestId}/evidence/{evidenceId} = the
// public-evidence-upload record (account-less + in-app evidence lands in an
// ISOLATED admin-only Firebase Storage bucket, never R2, never served, no durable
// URL). Evidence reuses the `ncii-evidence` fileOrigin spec and the ONE shared
// PhotoDNA scan (image → PhotoDNA; video → frame-extraction → PhotoDNA per frame),
// byte-exact / no transcode (`preserveOriginal`). It does NOT use the auth-gated
// `startUpload` path — a not-logged-in victim can't call it — so the browser writes
// the file DIRECTLY to the isolated bucket (App-Check + create-only + image/video +
// size-cap storage rules; path keyed by the opaque `requestReference`) and a Storage
// onFinalize trigger runs that same scan. This record exists ONLY after a CLEAN
// scan; a validated match opens a child-safety case and the bytes are held there
// instead (no evidence record, never shown).
// ===========================================================================

/** `takeItDownRequests/{requestId}/evidence/{evidenceId}` — the [F10] public
 * evidence-upload record. Doc id `evidenceId` is a deterministic/assigned id.
 * INVARIANT: this record NEVER sets `originatingUploaderUid` — enforcement / NCMEC
 * attribution targets the ORIGINAL content's originatingUploaderUid (perpetrator)
 * via MediaOriginLineageV1 (a correlation, not a merge). */
export const TakeItDownEvidenceV1Schema = z.object({
  schemaVersion: z.literal(1),
  evidenceId: z.string().min(1),
  requestId: z.string().min(1),
  uploadContext: z.literal('takeItDownEvidence'), // LITERAL tag — never an ordinary content origin
  submitterUid: z.string().min(1).optional(), // the submitter is NEVER auto-actioned for evidence they submit
  bucket: z.string().min(1),
  key: z.string().min(1),
  generation: z.string().min(1),
  contentType: z.string().min(1),
  sizeBytes: z.number(),
  sha256: z.string().min(1),
  md5: z.string().min(1),
  capturedAt: z.number(),
  createdAt: z.number(),
}).strict();
export type TakeItDownEvidenceV1 = z.infer<typeof TakeItDownEvidenceV1Schema>;

// ===========================================================================
// §A11 [C-02] — conditional completeness predicate (`computeCompleteness`).
// requiredFieldCodes(requesterRole) + a contact one-of. These are EMBEDDED /
// NON-DOC shapes (not Firestore documents): the counsel-ratified required set + a
// documented predicate. Completeness is NOT "every TakeItDownFieldCode arrived".
// ===========================================================================

/** [C-02] Required field codes for a `depictedPerson` request (counsel-ratified). */
export const REQUIRED_FIELD_CODES_DEPICTED_PERSON = [
  'requesterName',
  'requesterRole',
  'electronicSignature',
  'targetLocator',
  'nonconsentStatement',
  'goodFaithCertification',
] as const satisfies readonly TakeItDownFieldCode[];

/** [C-02] Required field codes for an `authorizedRepresentative` request =
 * depicted-person set ∪ { authorityBasis, authorityEvidence } (counsel-ratified). */
export const REQUIRED_FIELD_CODES_AUTHORIZED_REPRESENTATIVE = [
  ...REQUIRED_FIELD_CODES_DEPICTED_PERSON,
  'authorityBasis',
  'authorityEvidence',
] as const satisfies readonly TakeItDownFieldCode[];

/** [C-02] The contact one-of: at least ONE of these must be present (neither is
 * individually required; either alone satisfies it). */
export const CONTACT_ONE_OF_FIELD_CODES = [
  'contactEmail',
  'contactPhone',
] as const satisfies readonly TakeItDownFieldCode[];

/** [C-02] `requiredFieldCodes(requesterRole)` — the counsel-ratified required set.
 * `supportingFacts` is collected but is NOT a completeness gate; `contactEmail` /
 * `contactPhone` are governed by the contact one-of (see CONTACT_ONE_OF_FIELD_CODES),
 * never individually required. The implementer uses EXACTLY this set and never
 * hard-requires `contactPhone` or the authorizedRepresentative block on a
 * depicted-person request. */
export function requiredFieldCodes(
  requesterRole: TakeItDownRequesterRole,
): readonly TakeItDownFieldCode[] {
  return requesterRole === 'authorizedRepresentative'
    ? REQUIRED_FIELD_CODES_AUTHORIZED_REPRESENTATIVE
    : REQUIRED_FIELD_CODES_DEPICTED_PERSON;
}

/** [C-02] `computeCompleteness` — returns `complete` iff every code in
 * `requiredFieldCodes(requesterRole)` is supplied AND the contact one-of holds;
 * otherwise `incomplete` with the missing codes surfaced (those become
 * `TakeItDownPublicStatusV1.missingFieldCodes`). The missing-set lists the role's
 * unmet required codes, plus a `contactEmail`/`contactPhone` representative for an
 * unmet contact one-of (the implementer/UI decides which contact code to surface;
 * here we surface `contactEmail` as the canonical missing-contact marker). */
export function computeCompleteness(input: {
  requesterRole: TakeItDownRequesterRole;
  suppliedFieldCodes: readonly TakeItDownFieldCode[];
}): { status: 'incomplete' | 'complete'; missingFieldCodes: TakeItDownFieldCode[] } {
  const supplied = new Set(input.suppliedFieldCodes);
  const missingFieldCodes: TakeItDownFieldCode[] = [];

  for (const code of requiredFieldCodes(input.requesterRole)) {
    if (!supplied.has(code)) missingFieldCodes.push(code);
  }

  const contactSatisfied = CONTACT_ONE_OF_FIELD_CODES.some((code) => supplied.has(code));
  if (!contactSatisfied) missingFieldCodes.push('contactEmail');

  return {
    status: missingFieldCodes.length === 0 ? 'complete' : 'incomplete',
    missingFieldCodes,
  };
}
