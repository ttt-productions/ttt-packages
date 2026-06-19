// Trust & Safety — durable uploader-removal appeal (Appendix A §A11 [H-09]).
//
// `nciiAppeals/{appealId}` — the `uploaderRemovalAppeal` is a first-class durable,
// append-only record exactly like every other NCII workflow object. The mutable
// `nciiCases.appealState` is a labeled NON-AUTHORITATIVE PROJECTION of this record,
// NEVER the authority.
//
// This schema is the UPLOADER appeal ONLY (`appealKind:'uploaderRemovalAppeal'`).
// The authenticated uploader whose content was removed appeals here; ONLY
// `nciiAppealReviewer` may grant it (reinstate content / reverse an NCII hash
// block), and a child-safety hold is NEVER reversible through it. A requester's
// `requesterValidityCorrection` (status-token supplement) is NOT an appeal, carries
// NO reinstatement power, and is NOT modeled by this schema.
//
// Deterministic `appealId = sha256('ncii-appeal-v1:' + caseId + ':' + appellantUid
// + ':' + removalGeneration)` (a retried submit resolves to the same doc —
// idempotent). The client-supplied ≥128-bit `idempotencyKey` together with the
// deterministic appealId guarantees one record per retry.
//
// Every shape here is transcribed verbatim from docs/code_changes_needed/
// trust-and-safety/IMPLEMENTATION_PLAN.md Appendix A §A11 [H-09] — no invented
// values, no placeholders.
//
// Collection note: this cluster introduces a NEW Firestore collection (+ two
// append-only child subcollections); wiring collections.ts / path-builders.ts /
// registry.ts is deferred to the app leg (the orchestrator binds the schemas +
// path builders there); the deterministic doc-id shape is documented on each
// schema below. No shared enum is imported — the appeal kind/state/command/result
// vocabularies are appeal-local literals (the cross-cluster NciiAppealKind enum
// has two members; this schema pins the single literal it owns).

import { z } from 'zod';

// ===========================================================================
// §A11 [H-09] — appeal state + command vocabularies
// ===========================================================================

/** The AUTHORITATIVE appeal state (`nciiCases.appealState` projects this). */
export const NciiAppealStateSchema = z.enum([
  'submitted',
  'underReview',
  'granted',
  'denied',
  'withdrawn',
]);
export type NciiAppealState = z.infer<typeof NciiAppealStateSchema>;

/** Durable command/retry/dead-letter status for the reinstatement/denial effect. */
export const NciiAppealCommandStatusSchema = z.enum([
  'pending',
  'executing',
  'applied',
  'deadLetter',
]);
export type NciiAppealCommandStatus = z.infer<typeof NciiAppealCommandStatusSchema>;

/** Durable command sub-record on the appeal — drives the reinstatement/denial
 * effect with retry/dead-letter. */
export const NciiAppealCommandV1Schema = z.object({
  commandId: z.string().min(1),
  status: NciiAppealCommandStatusSchema,
  attemptCount: z.number(),
  nextAttemptAt: z.number().optional(),
  leaseOwner: z.string().min(1).optional(),
  leaseExpiresAt: z.number().optional(),
  lastErrorCode: z.string().optional(),
}).strict();
export type NciiAppealCommandV1 = z.infer<typeof NciiAppealCommandV1Schema>;

// ===========================================================================
// §A11 [H-09] — nciiAppeals/{appealId}
// ===========================================================================

/** `nciiAppeals/{appealId}` — durable, append-only uploader-removal appeal. Doc id
 * `appealId` is deterministic:
 * `sha256('ncii-appeal-v1:' + caseId + ':' + appellantUid + ':' + removalGeneration)`
 * (a retried submit resolves to the same doc — idempotent). */
export const NciiAppealV1Schema = z.object({
  schemaVersion: z.literal(1),
  // = sha256('ncii-appeal-v1:' + caseId + ':' + appellantUid + ':' + removalGeneration)
  appealId: z.string().min(1),
  caseId: z.string().min(1),
  // the request(s)/removal this appeal contests
  requestIds: z.array(z.string().min(1)).max(16),
  // this schema is the uploader appeal ONLY
  appealKind: z.literal('uploaderRemovalAppeal'),
  // ties the appeal to the specific NciiRemovalJobV1 generation that removed the content
  removalGeneration: z.number(),
  // the AUTHENTICATED uploader whose content was removed
  appellantUid: z.string().min(1),
  // client-supplied, ≥128-bit; together with the deterministic appealId guarantees one record per retry
  idempotencyKey: z.string().min(1),
  // the AUTHORITATIVE appeal state (appealState projects this)
  state: NciiAppealStateSchema,
  // per-appeal review SLA (NciiPolicyConfigV1.uploaderRemovalAppealWindowDays); UI-independent monitor may arm on it
  deadlineAt: z.number().optional(),
  // durable command/retry/dead-letter state for the reinstatement/denial effect
  command: NciiAppealCommandV1Schema,
  createdAt: z.number(),
  updatedAt: z.number(),
  decidedAt: z.number().optional(),
}).strict();
export type NciiAppealV1 = z.infer<typeof NciiAppealV1Schema>;

// ===========================================================================
// §A11 [H-09] — nciiAppeals/{appealId}/submissions/{submissionId}
// IMMUTABLE append-only — the appellant's reason + evidence.
// ===========================================================================

/** Who created the submission. */
export const NciiAppealSubmissionAuthorSchema = z.enum(['appellant', 'operator']);
export type NciiAppealSubmissionAuthor = z.infer<typeof NciiAppealSubmissionAuthorSchema>;

/** `nciiAppeals/{appealId}/submissions/{submissionId}` — IMMUTABLE append-only
 * record of the appellant's reason + evidence. Doc id `submissionId` is a
 * deterministic/assigned id (z.string().min(1)). */
export const NciiAppealSubmissionV1Schema = z.object({
  schemaVersion: z.literal(1),
  submissionId: z.string().min(1),
  sequence: z.number(),
  receivedAt: z.number(),
  appellantStatement: z.string(),
  evidenceIds: z.array(z.string().min(1)).max(16),
  createdBy: NciiAppealSubmissionAuthorSchema,
}).strict();
export type NciiAppealSubmissionV1 = z.infer<typeof NciiAppealSubmissionV1Schema>;

// ===========================================================================
// §A11 [H-09] — nciiAppeals/{appealId}/decisions/{decisionId}
// IMMUTABLE append-only — ONLY `nciiAppealReviewer` may write a decision; a
// `granted` decision drives the reinstatement command + a child-safety hold is
// NEVER reversible through it.
// ===========================================================================

/** Appeal decision result. */
export const NciiAppealDecisionResultSchema = z.enum(['granted', 'denied']);
export type NciiAppealDecisionResult = z.infer<typeof NciiAppealDecisionResultSchema>;

/** `nciiAppeals/{appealId}/decisions/{decisionId}` — IMMUTABLE append-only
 * decision. ONLY `nciiAppealReviewer` may write a decision (capability pinned by
 * literal). Doc id `decisionId` is a deterministic/assigned id (z.string().min(1)). */
export const NciiAppealDecisionV1Schema = z.object({
  schemaVersion: z.literal(1),
  decisionId: z.string().min(1),
  result: NciiAppealDecisionResultSchema,
  reviewerUid: z.string().min(1),
  capability: z.literal('nciiAppealReviewer'),
  basisSubmissionIds: z.array(z.string().min(1)).max(16),
  rationaleRef: z.string(),
  decidedAt: z.number(),
}).strict();
export type NciiAppealDecisionV1 = z.infer<typeof NciiAppealDecisionV1Schema>;
