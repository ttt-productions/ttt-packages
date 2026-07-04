// Trust & Safety — three independent durable sagas + the closure coordinator
// (Appendix A §A5, Finding-H5 / Finding-H6).
//
// Quarantine, NCMEC reporting, and account action are THREE independent durable
// sagas. The quarantine job NEVER folds reporting or account action into its
// phases — it can be `quarantineComplete` while the other two are still open, so
// no doc ever lies about quarantine completion. Each saga is idempotent by
// `commandId`; the reconciler verifies external state, never a prior response.
//
// Every shape here is transcribed verbatim from docs/code_changes_needed/
// trust-and-safety/IMPLEMENTATION_PLAN.md Appendix A §A5 — no invented values, no
// placeholders.
//
// SHARED enums come from ./foundation.js (the single source for every
// cross-cluster enum); they are NEVER redefined here. This cluster IMPORTS
// NcmecSubmissionStateSchema (the §A9 reporting lifecycle) from foundation.
//
// Collection note: this cluster introduces THREE NEW Firestore collections plus
// one overflow subcollection under `quarantineSagaJobs`. Wiring collections.ts /
// path-builders.ts / registry.ts is deferred to the app leg (the orchestrator
// binds the schemas + path builders there); the composite doc-id shapes are
// documented on each schema below.
//
// CLOSURE COORDINATOR — there is NO doc for it. The case is "operationally
// resolvable" via a PROJECTION computed on the case root from the three
// independent statuses (see the closure predicate comment at the bottom of this
// file). Do NOT create a closure-coordinator document.

import { z } from 'zod';
import { NcmecSubmissionStateSchema } from './foundation.js';

// ===========================================================================
// A5 — quarantineSagaJobs/{caseId}
// Quarantine ONLY (hold → serving-deny → evidence → active-byte removal). Never
// folds reporting / account action. Doc id is the `caseId`.
// ===========================================================================

/** Top-level run status of the quarantine saga. */
export const QuarantineStatusSchema = z.enum([
  'running',
  'quarantineComplete',
  'deadLetter',
]);
export type QuarantineStatus = z.infer<typeof QuarantineStatusSchema>;

/** The FULL quarantine phase enum. `servingDeny*` precede `evidenceCopying`;
 * `activeCopiesRemoval*` require `evidenceVerified`. */
export const QuarantinePhaseSchema = z.enum([
  'holdCommitted',
  'sourceManifestCaptured',
  'servingDenyRequested',
  'servingDenyVerified',
  'evidenceCopying',
  'evidenceVerified',
  'activeCopiesRemovalRequested',
  'activeCopiesRemovalVerified',
  'quarantineComplete',
]);
export type QuarantinePhase = z.infer<typeof QuarantinePhaseSchema>;

/** `quarantineSagaJobs/{caseId}` — quarantine-only durable saga. Doc id is the
 * `caseId`. `commandId` is deterministic per `(caseId, phase)`. `relatedAssetIds`
 * is bounded at MAX 256; overflow → `…/relatedAssets/{assetId}`. */
export const QuarantineSagaJobV1Schema = z.object({
  schemaVersion: z.literal(1),
  caseId: z.string().min(1),
  quarantineStatus: QuarantineStatusSchema,
  phase: QuarantinePhaseSchema,
  phaseVersion: z.number(),
  commandId: z.string().min(1), // deterministic per (caseId, phase)
  relatedAssetIds: z.array(z.string().min(1)).max(256), // bounded; overflow → …/relatedAssets/{assetId}
  attemptCount: z.number(),
  nextAttemptAt: z.number(),
  leaseOwner: z.string().min(1).optional(),
  leaseExpiresAt: z.number().optional(),
  lastError: z.string().optional(),
  createdAt: z.number(),
  updatedAt: z.number(),
  completedAt: z.number().optional(),
}).strict();
export type QuarantineSagaJobV1 = z.infer<typeof QuarantineSagaJobV1Schema>;

/** `quarantineSagaJobs/{caseId}/relatedAssets/{assetId}` — overflow beyond
 * `relatedAssetIds` MAX 256. Doc id is the `assetId`. */
export const QuarantineSagaRelatedAssetV1Schema = z.object({
  rootIngestId: z.string().min(1),
  addedAt: z.number(),
}).strict();
export type QuarantineSagaRelatedAssetV1 = z.infer<typeof QuarantineSagaRelatedAssetV1Schema>;

// ===========================================================================
// A5 — ncmecSubmissionJobs/{caseId}__{submissionId}
// The API/manual reporting lifecycle. Drives the …/ncmecSubmissions/{submissionId}
// records + …/attempts; owns retries, ambiguity reconciliation, manual-portal
// fallback, supplemental/correction. Doc id is the deterministic composite
// `{caseId}__{submissionId}`.
// ===========================================================================

/** `ncmecSubmissionJobs/{caseId}__{submissionId}` — reporting-lifecycle durable
 * saga. Doc id is the deterministic composite `{caseId}__{submissionId}`.
 * `commandId` is the saga's idempotency key. `state` is the §A9
 * NcmecSubmissionState (NO `notRequired` — that lives on ReportDisposition). */
export const NcmecSubmissionJobV1Schema = z.object({
  schemaVersion: z.literal(1),
  caseId: z.string().min(1),
  submissionId: z.string().min(1),
  state: NcmecSubmissionStateSchema, // §A9 NcmecSubmissionState
  commandId: z.string().min(1),
  attemptCount: z.number(),
  nextAttemptAt: z.number(),
  leaseOwner: z.string().min(1).optional(),
  leaseExpiresAt: z.number().optional(),
  lastErrorCode: z.string().optional(),
  createdAt: z.number(),
  updatedAt: z.number(),
  completedAt: z.number().optional(),
}).strict();
export type NcmecSubmissionJobV1 = z.infer<typeof NcmecSubmissionJobV1Schema>;

// ===========================================================================
// A5 — accountActionCommands/{caseId}__{uid}
// The per-account safety-action lifecycle. Doc id is the deterministic composite
// `{caseId}__{uid}`. A dead-letter replay never re-issues a second ban
// (idempotent `commandId` + merge-generation check).
// ===========================================================================

/** The per-account safety action this command applies. `reinstate` is the inverse of a
 *  restriction: it restores `status:'active'`, clears `privateData.safetyLocked`, and
 *  re-enables a disabled Auth account (used to lift a safety-lock / ban when a case is
 *  closed as a false positive). The case's safety HOLDS are released separately by the
 *  case-close path, not by this action. */
export const AccountActionSchema = z.enum([
  'ban',
  'suspend',
  'watch',
  'safetyLocked',
  'reinstate',
  'none',
]);
export type AccountAction = z.infer<typeof AccountActionSchema>;

/** Where the action originated. */
export const AccountActionSourceSchema = z.enum(['autoHash', 'operator']);
export type AccountActionSource = z.infer<typeof AccountActionSourceSchema>;

/** Command lifecycle status. `deadLetter` parks a command whose attempt budget is
 * exhausted (the drain query stops matching it); an operator replays it via
 * `adminReplayDeadLetter` (generic reset to `pending`). */
export const AccountActionStatusSchema = z.enum(['pending', 'applied', 'reverted', 'deadLetter']);
export type AccountActionStatus = z.infer<typeof AccountActionStatusSchema>;

/** `accountActionCommands/{caseId}__{uid}` — per-account safety-action durable
 * saga. Doc id is the deterministic composite `{caseId}__{uid}`. `commandId` is
 * the saga's idempotency key. */
export const AccountActionCommandV1Schema = z.object({
  schemaVersion: z.literal(1),
  caseId: z.string().min(1),
  targetUid: z.string().min(1),
  action: AccountActionSchema,
  source: AccountActionSourceSchema,
  status: AccountActionStatusSchema,
  commandId: z.string().min(1),
  attemptCount: z.number(),
  nextAttemptAt: z.number(),
  leaseOwner: z.string().min(1).optional(),
  leaseExpiresAt: z.number().optional(),
  lastError: z.string().optional(),
  createdAt: z.number(),
  updatedAt: z.number(),
  completedAt: z.number().optional(),
}).strict();
export type AccountActionCommandV1 = z.infer<typeof AccountActionCommandV1Schema>;

// ===========================================================================
// A5 — CLOSURE COORDINATOR (a PROJECTION on the case root, NOT a doc).
//
// There is NO closure-coordinator document. The case is OPERATIONALLY RESOLVABLE
// only when ALL THREE independent statuses agree:
//
//   1. quarantine          : QuarantineSagaJobV1.quarantineStatus === 'quarantineComplete'
//   2. account action      : case-root accountActionStatus ∈ { 'noAccountActionRequired', 'resolved' }
//   3. reporting predicate  (Finding-H6):
//        ( case-root reportDisposition === 'notRequired' AND no NCMEC submission was ever opened )
//        OR ( the submission's state === 'completed' )
//
// Reporting closure keys on the case-root `reportDisposition` (§A9
// ReportDisposition), NOT on a `notRequired` submission state (that value no
// longer exists on NcmecSubmissionState). A `notRequired`-disposed case is never
// blocked on a non-existent report; a human-review case stays
// `operatorDecisionPending` until the operator commands the action.
// ===========================================================================
