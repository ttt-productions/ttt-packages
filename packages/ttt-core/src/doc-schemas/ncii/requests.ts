// Trust & Safety — NCII statutory TAKE IT DOWN requests (Appendix A §A11, concept
// (2)) — the SPLIT model: a PII-free root + a restricted requester-PII subdoc +
// immutable submissions/validityDecisions + operator actions + isolated public
// evidence uploads.
//
// Only a COMPLETE + VALID request can arm the 48h clock. The public no-login form
// CANNOT submit a "valid request" without the required fields; validation
// failures use the enumerated TakeItDownInvalidReasonCode. The root holds NO
// requester PII / narrative / signature / authority — those live in the restricted
// `/private/requester` subdoc.
//
// The public post-submission tracking tail (status page / status route / supplement
// route / status token / public status projection) was removed (DJ 2026-07-02, feature
// never wanted): the public flow is submit-only, so the status-token fields and the
// `TakeItDownPublicStatusV1` projection no longer exist. Evidence folders re-key on the
// intake `idempotencyKey` (like `nciiAuthorityEvidence/`), so no `statusProjection`
// collection-group lookup remains.
//
// Every shape here is transcribed verbatim from the frozen Trust & Safety spec
// (Appendix A §A11 (2) + [C-02] + [F7] + [F10]) — no invented values, no
// placeholders; the durable design owner is ttt-prod
// docs/design/nonconsensual-intimate-imagery-and-take-it-down.md.
//
// SHARED enums + locator types come from ../safety/foundation.js (the single
// source for every cross-cluster enum); they are NEVER redefined here. This
// cluster IMPORTS TakeItDownRequesterRoleSchema, TargetLocatorSummaryV1Schema,
// TakeItDownCompletenessStatusSchema, TakeItDownValidityStatusSchema,
// TakeItDownInvalidReasonCodeSchema, TakeItDownPublicStatusSchema,
// NciiRemovalCompletionOutcomeSchema, NciiActionTypeSchema, NciiActionResultSchema,
// TakeItDownFieldCodeSchema, and SafetyReviewerCapabilitySchema.
//
// Collection note: this cluster introduces a NEW Firestore collection plus several
// subcollections (private/requester, submissions, validityDecisions, actions,
// evidence). Wiring collections.ts / path-builders.ts / registry.ts is deferred to
// the app leg (the orchestrator binds the schemas + path builders there); the doc-id
// shapes (including the deterministic intake requestId [H-07]) are documented on each
// schema below.

import { z } from 'zod';
import { MAX_NCII_ACTION_SUMMARY_LENGTH } from '../../constants/business.js';
import {
  TakeItDownRequesterRoleSchema,
  TargetLocatorV1Schema,
  TargetLocatorSummaryV1Schema,
  TakeItDownCompletenessStatusSchema,
  TakeItDownValidityStatusSchema,
  TakeItDownInvalidReasonCodeSchema,
  TakeItDownPublicStatusSchema,
  NciiRemovalCompletionOutcomeSchema,
  NciiActionTypeSchema,
  NciiActionResultSchema,
  TakeItDownFieldCodeSchema,
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

/** [H-02] Server-owned scan status for the optional authority-proof photo.
 * Written by `onNciiEvidenceUploaded` when the authority-evidence prefix is
 * matched. `pending` until the scan resolves; `clean` = safe for operator
 * review; `matched` = PhotoDNA hit (converges to child-safety path); `rejected`
 * = spoof/magic-byte rejection; `unavailable` = scan could not produce a
 * verdict (fail-closed until resolved). Absence of the photo leaves the status
 * absent — operators must not be shown/allowed to act on proof until `clean`. */
export const AuthorityProofScanStatusSchema = z.enum([
  'pending',
  'clean',
  'matched',
  'rejected',
  'unavailable',
]);
export type AuthorityProofScanStatus = z.infer<typeof AuthorityProofScanStatusSchema>;

/** [H-02] Server-owned authority-proof scan state. Embedded on the authorized-
 * representative block; written by the `onNciiEvidenceUploaded` trigger (never
 * by the client). Present only when an authority-proof photo was uploaded. */
export const AuthorityProofScanStateV1Schema = z.object({
  scanStatus: AuthorityProofScanStatusSchema,
  objectGeneration: z.string().min(1),
  objectHash: z.string().min(1),
  scannedAt: z.number().optional(),
}).strict();
export type AuthorityProofScanStateV1 = z.infer<typeof AuthorityProofScanStateV1Schema>;

/** The authorized-representative block — present only for an
 * `authorizedRepresentative` requester.
 * [H-03] `authorityCertification` is a required good-faith attestation of
 * authority; `authorityEvidenceRef` + `authorityProofScan` are OPTIONAL
 * (presence is supporting material; absence never blocks completeness or the
 * 48h clock). */
export const TakeItDownAuthorizedRepresentativeV1Schema = z.object({
  representedPersonName: z.string(),
  authorityBasis: z.string(),
  authorityCertification: z.boolean(),
  authorityEvidenceRef: z.string().min(1).optional(),
  authorityProofScan: AuthorityProofScanStateV1Schema.optional(),
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
  accuracyCertification: z.boolean().optional(), // NOT a hard validity gate by default — counsel decides
  // The EXACT validated locator the requester submitted (restricted; operator-only — never on the
  // PII-free root, which keeps only TargetLocatorSummaryV1). For the public no-login url-only intake
  // this is the raw `{ kind:'url', url }` so the operator can FIND the on-platform content and
  // mark + link it as NCII evidence (the public intake never auto-resolves a TTT target — C-03
  // anti-abuse). Optional so a not-yet-backfilled request still validates; intake always writes it.
  targetLocator: TargetLocatorV1Schema.optional(),
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
  summary: z.string().max(MAX_NCII_ACTION_SUMMARY_LENGTH), // BOUNDED, non-sensitive
  detailRef: z.string().min(1), // pointer to a RESTRICTED detail row holding any sensitive rationale
}).strict();
export type TakeItDownRequestActionV1 = z.infer<typeof TakeItDownRequestActionV1Schema>;

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
// [H-01] nciiRetainedEvidenceInventory/{inventoryId} = NciiRetainedEvidenceInventoryV1
// — a durable, OPERATOR-VISIBLE inventory row for an NCII-evidence object that the
// onNciiEvidenceUploaded scan RETAINED but did NOT record as evidence (orphan /
// oversized / spoof / malformed / archive-polyglot). The bytes are preserved (NO
// auto-delete EVER — disposal stays verified-LE-only); this row makes the retained
// object visible + accountable in the admin console instead of living only in a log
// line. METADATA only — never bytes, never a served URL.
// ===========================================================================

/** Why an evidence object was retained without an evidence record. */
export const NciiRetainedEvidenceReasonSchema = z.enum([
  'orphan', // requestReference matched no real request
  'fileTooLarge', // over maxEvidenceFileBytes
  'imageTooLarge', // over the decode pixel / dimension budget
  'archiveOrPolyglot', // archive/polyglot signature
  'malformedPath', // not a 3-segment nciiEvidence/{ref}/{file} key
  'scanRejected', // PhotoDNA scan rejected it as a spoof (magic bytes / kind)
  'capOverflow', // past the per-request count or total-bytes cap — retained but not recorded as evidence
]);
export type NciiRetainedEvidenceReason = z.infer<typeof NciiRetainedEvidenceReasonSchema>;

/** `nciiRetainedEvidenceInventory/{inventoryId}` — the [H-01] retained-object row.
 * Doc id is deterministic on bucket+key+generation (idempotent re-fire). */
export const NciiRetainedEvidenceInventoryV1Schema = z.object({
  schemaVersion: z.literal(1),
  inventoryId: z.string().min(1),
  reason: NciiRetainedEvidenceReasonSchema,
  bucket: z.string().min(1),
  key: z.string().min(1),
  generation: z.string().min(1),
  /** The path segment (an orphan reference matches no request). */
  requestReference: z.string().min(1).optional(),
  contentType: z.string().min(1).optional(),
  sizeBytes: z.number().optional(),
  detectedAt: z.number(),
  createdAt: z.number(),
}).strict();
export type NciiRetainedEvidenceInventoryV1 = z.infer<typeof NciiRetainedEvidenceInventoryV1Schema>;

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

/** [C-02 / H-03] Required field codes for an `authorizedRepresentative` request =
 * depicted-person set ∪ { authorityBasis, authorityCertification }.
 * `authorityEvidence` (the optional documentary photo) is NOT required;
 * absence or pending scan never blocks completeness or the 48h clock. */
export const REQUIRED_FIELD_CODES_AUTHORIZED_REPRESENTATIVE = [
  ...REQUIRED_FIELD_CODES_DEPICTED_PERSON,
  'authorityBasis',
  'authorityCertification',
] as const satisfies readonly TakeItDownFieldCode[];

/** [C-02] The contact one-of: at least ONE of these must be present (neither is
 * individually required; either alone satisfies it). */
export const CONTACT_ONE_OF_FIELD_CODES = [
  'contactEmail',
  'contactPhone',
] as const satisfies readonly TakeItDownFieldCode[];

/** [C-02 / H-03] `requiredFieldCodes(requesterRole)` — the required set.
 * `supportingFacts` is collected but is NOT a completeness gate; `contactEmail` /
 * `contactPhone` are governed by the contact one-of (see CONTACT_ONE_OF_FIELD_CODES),
 * never individually required. `authorityEvidence` (the optional documentary photo)
 * is NOT required; absence or a pending/unavailable scan never blocks completeness
 * or the 48h clock. The implementer uses EXACTLY this set and never hard-requires
 * `contactPhone` or the authorizedRepresentative block on a depicted-person request. */
export function requiredFieldCodes(
  requesterRole: TakeItDownRequesterRole,
): readonly TakeItDownFieldCode[] {
  return requesterRole === 'authorizedRepresentative'
    ? REQUIRED_FIELD_CODES_AUTHORIZED_REPRESENTATIVE
    : REQUIRED_FIELD_CODES_DEPICTED_PERSON;
}

/** [C-02 / H-02 / H-03] `computeCompleteness` — returns `complete` iff every code in
 * `requiredFieldCodes(requesterRole)` is supplied AND the contact one-of holds;
 * otherwise `incomplete` with the missing codes surfaced (those become
 * `TakeItDownPublicStatusV1.missingFieldCodes`). The missing-set lists the role's
 * unmet required codes, plus a `contactEmail`/`contactPhone` representative for an
 * unmet contact one-of (the implementer/UI decides which contact code to surface;
 * here we surface `contactEmail` as the canonical missing-contact marker).
 * [H-02] The optional authority-proof photo's presence, absence, or pending scan
 * (`authorityProofScan.scanStatus`) is NEVER a gate — completeness is purely the
 * written statutory elements + the authority certification. */
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

// ===========================================================================
// §A11 [C-02 / H-03] — intake field-code derivation + completeness (SINGLE-SOURCED).
// `NciiIntakeFacts`, `suppliedFieldCodes`, and `deriveCompleteness` are pure and sit
// beside `computeCompleteness` so BOTH the public route graph (src/) and the functions
// graph (functions/src/) import the ONE implementation — the two "byte-identical"
// intakeShared mirrors that had already drifted ([H-03] authorityCertification existed
// on only one side) are eliminated. These are EMBEDDED / NON-DOC shapes (not Firestore
// documents).
// ===========================================================================

/** The decoded intake payload the field-code extractor inspects. The route/callable
 *  maps the raw body onto this AFTER zod-validating it. */
export interface NciiIntakeFacts {
  readonly requesterRole: TakeItDownRequesterRole;
  readonly requesterName?: string;
  readonly contactEmail?: string;
  readonly contactPhone?: string;
  readonly electronicSignature?: { signedName: string; signatureMethod: string };
  readonly nonconsentStatement?: string;
  readonly supportingFacts?: string;
  readonly goodFaithCertification?: boolean;
  readonly authorityBasis?: string;
  /** [H-03] The required good-faith authority certification. Arms completeness alongside
   *  authorityBasis; the optional documentary photo never gates completeness. */
  readonly authorityCertification?: boolean;
  /** [H-03] Optional documentary authority-proof photo ref. Present/absent never blocks
   *  completeness or the 48h clock; it is supporting material only. */
  readonly authorityEvidenceRef?: string;
  /** Present only for a resolvable/recorded locator (TTT-hosted or external). */
  readonly hasLocator: boolean;
}

function nonEmpty(s: string | undefined): boolean {
  return typeof s === 'string' && s.trim().length > 0;
}

/**
 * Derive the set of supplied `TakeItDownFieldCode`s from the decoded facts. This is
 * the bridge between the raw form fields and the enumerated codes the
 * `computeCompleteness` predicate consumes — completeness is NEVER "every field code
 * arrived", it is exactly the counsel-ratified required set (handled by
 * `computeCompleteness`) over THIS supplied set.
 */
export function suppliedFieldCodes(facts: NciiIntakeFacts): TakeItDownFieldCode[] {
  const codes: TakeItDownFieldCode[] = [];
  if (nonEmpty(facts.requesterName)) codes.push('requesterName');
  if (nonEmpty(facts.contactEmail)) codes.push('contactEmail');
  if (nonEmpty(facts.contactPhone)) codes.push('contactPhone');
  // requesterRole is always present (it is required to even shape the request).
  codes.push('requesterRole');
  if (facts.electronicSignature && nonEmpty(facts.electronicSignature.signedName)) {
    codes.push('electronicSignature');
  }
  if (facts.hasLocator) codes.push('targetLocator');
  if (nonEmpty(facts.nonconsentStatement)) codes.push('nonconsentStatement');
  if (nonEmpty(facts.supportingFacts)) codes.push('supportingFacts');
  if (facts.goodFaithCertification === true) codes.push('goodFaithCertification');
  if (nonEmpty(facts.authorityBasis)) codes.push('authorityBasis');
  // [H-03] authorityCertification is the required authority attestation that arms completeness.
  if (facts.authorityCertification === true) codes.push('authorityCertification');
  // [H-03] authorityEvidence (documentary photo) is OPTIONAL — recorded when present but
  // never a completeness gate; absence never blocks the 48h clock.
  if (nonEmpty(facts.authorityEvidenceRef)) codes.push('authorityEvidence');
  return codes;
}

/** The full completeness determination: status + the supplied set + the missing set. */
export interface NciiCompletenessOutcome {
  readonly status: 'incomplete' | 'complete';
  readonly suppliedFieldCodes: TakeItDownFieldCode[];
  readonly missingFieldCodes: TakeItDownFieldCode[];
}

/**
 * Compute completeness from the decoded facts using the shared `computeCompleteness`
 * predicate ([C-02]). One call so every intake (public route + logged-in callable +
 * any functions-graph recompute) uses an identical determination.
 */
export function deriveCompleteness(facts: NciiIntakeFacts): NciiCompletenessOutcome {
  const supplied = suppliedFieldCodes(facts);
  const { status, missingFieldCodes } = computeCompleteness({
    requesterRole: facts.requesterRole,
    suppliedFieldCodes: supplied,
  });
  return { status, suppliedFieldCodes: supplied, missingFieldCodes };
}
