// Trust & Safety — NCII durable evidence-scan state machine + holdable evidence
// object (Appendix A §A11 [H5]).
//
// `nciiEvidenceSafetyScans/{requestId}__{evidenceId}` — the scan begins
// AUTOMATICALLY after upload finalization (NOT when an operator opens it).
// Evidence is NOT shown to a human until the scan reaches a safe terminal state
// (except a designed controlled-review override). A `validatedHashMatch` records
// the detector signal + case link + hold BEFORE any cleanup can run;
// abandoned/failed-request cleanup checks the safety-hold aggregate and FAILS
// CLOSED. Child-safety retention OVERRIDES NCII minimize-retention for that
// evidence object. Reporter identity stays separate from offender attribution.
//
// LEGAL TRANSITIONS [H5]:
//   queued → running
//   running → noHit | validatedHashMatch | notApplicable | retryableFailure
//   retryableFailure → queued | deadLetter
//   deadLetter → queued  (ONLY through an audited replay, which increments
//                         `replayGeneration` → a NEW `commandId`)
//
// ONE ATOMIC VALIDATED-MATCH TRANSACTION: on `validatedHashMatch`, a SINGLE
// Firestore transaction idempotently writes ALL of: the detector signal + the
// incident/case claim + the actual-knowledge transition (`actualKnowledgeAt`,
// earliest-wins) + the AUTHORITATIVE A3 hold ref (`safetyHoldRefs`, with
// `safetyHoldResources` aggregate-counter increments) + the NCMEC submission job
// (§A4/§A5) + the scan terminal state. An AMBIGUOUS transaction result is
// reconciled by the DETERMINISTIC IDs (`commandId` + `childSafetyCaseId` +
// `externalResultFingerprint`) BEFORE any retry creates a second legal action.
//
// Scan dead-letters MUST: keep evidence unserved + unavailable to ordinary
// reviewers, BLOCK cleanup, trigger the external critical alarm, and are NEVER
// treated as `noHit`. The §A3 hold resource enum gains `'storageObject'` and
// `'reportEvidenceObject'` (canonical bucket/key/generation identity) as holdable
// resource types.
//
// Every shape here is transcribed verbatim from docs/code_changes_needed/
// trust-and-safety/IMPLEMENTATION_PLAN.md Appendix A §A11 [H5] — no invented
// values, no placeholders.
//
// Collection note: this cluster introduces a NEW Firestore collection; wiring
// collections.ts / path-builders.ts / registry.ts is deferred to the app leg (the
// orchestrator binds the schema + path builders there); the deterministic doc-id
// shape is documented on the schema below. No shared enum is imported — the scan
// status set is scan-local.

import { z } from 'zod';

// ===========================================================================
// §A11 [H5] — scan status state machine
// ===========================================================================

/** Evidence-scan status. LEGAL TRANSITIONS:
 * `queued → running`; `running → noHit | validatedHashMatch | notApplicable |
 * retryableFailure`; `retryableFailure → queued | deadLetter`;
 * `deadLetter → queued` ONLY through an audited replay (increments
 * `replayGeneration` → a new `commandId`). A dead-letter is NEVER `noHit`. */
export const NciiEvidenceSafetyScanStatusSchema = z.enum([
  'queued',
  'running',
  'noHit',
  'validatedHashMatch',
  'notApplicable',
  'retryableFailure',
  'deadLetter',
]);
export type NciiEvidenceSafetyScanStatus = z.infer<typeof NciiEvidenceSafetyScanStatusSchema>;

// ===========================================================================
// §A11 [H5] — nciiEvidenceSafetyScans/{requestId}__{evidenceId}
// Deterministic per (request, evidence). `scanId = requestId + '__' + evidenceId`
// (the doc id). `commandId` deterministic per (scanId, replayGeneration) — the
// idempotent transaction key for the ONE atomic validated-match transaction.
// ===========================================================================

/** `nciiEvidenceSafetyScans/{requestId}__{evidenceId}` — durable evidence-scan
 * state machine + holdable evidence object. Doc id `scanId` is the deterministic
 * composite `requestId + '__' + evidenceId`. The scan begins AUTOMATICALLY after
 * upload finalization; evidence is not shown to a human until a safe terminal
 * state. */
export const NciiEvidenceSafetyScanV1Schema = z.object({
  schemaVersion: z.literal(1),
  requestId: z.string().min(1),
  evidenceId: z.string().min(1),
  // = requestId + '__' + evidenceId (the deterministic doc id)
  scanId: z.string().min(1),
  // deterministic per (scanId, replayGeneration) — idempotent transaction key
  commandId: z.string().min(1),
  // canonical storage-object identity of the scanned evidence
  bucket: z.string().min(1),
  key: z.string().min(1),
  generation: z.string().min(1),
  status: NciiEvidenceSafetyScanStatusSchema,
  detectorProvider: z.literal('photoDna'),
  detectorListVersion: z.string().min(1).optional(),
  detectorSignalId: z.string().min(1).optional(),
  validationReference: z.string().min(1).optional(),
  // stable fingerprint of the external detector response (ambiguity reconciliation)
  externalResultFingerprint: z.string().min(1).optional(),
  attemptCount: z.number(),
  nextAttemptAt: z.number().optional(),
  lastErrorCode: z.string().optional(),
  leaseOwner: z.string().min(1).optional(),
  leaseExpiresAt: z.number().optional(),
  deadLetterAt: z.number().optional(),
  replayGeneration: z.number(),
  childSafetyCaseId: z.string().min(1).optional(),
  safetyHoldRefId: z.string().min(1).optional(),
  createdAt: z.number(),
  updatedAt: z.number(),
  completedAt: z.number().optional(),
}).strict();
export type NciiEvidenceSafetyScanV1 = z.infer<typeof NciiEvidenceSafetyScanV1Schema>;
