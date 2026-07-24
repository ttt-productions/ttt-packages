// Trust & Safety — NCII per-request removal deadline + durable removal saga
// (Appendix A §A11 [H4]).
//
// The removal job is REQUEST-scoped, not case-scoped: the deadline monitor lives
// at `safetySlaMonitors/{requestId}__nciiRemovalDeadline` and a monitor can never
// be resolved by finishing a DIFFERENT linked request. The case-level
// `nciiRemovalDeadlineAt` MAY mirror the minimum active deadline but is NOT the
// source of truth.
//
// COMPLETION PREDICATE [H4]: completion is derived ONLY from verified target rows
// + approved legal outcomes — a request is `completed` ONLY when the reported
// target AND every known identical copy reaches `verificationState='verifiedGone'`
// OR carries an approved `NciiTerminalException`. A partial technical failure is
// the HONEST outcome `unableToComplete` (technical) or
// `completedWithApprovedException` (counsel-approved) — NEVER ordinary `completed`.
// A worker crash resumes idempotently (replay is idempotent by `targetKeyHash` +
// the job's deterministic `jobId`); a `leftover`/`failed` target re-drives from
// its last unverified sub-state.
//
// Every shape here is transcribed verbatim from the frozen Trust & Safety spec
// (Appendix A §A11 [H4]) — no invented values, no placeholders; the durable design
// owner is ttt-prod docs/design/nonconsensual-intimate-imagery-and-take-it-down.md.
//
// SHARED enums + the locator come from ../safety/foundation.js (the single source
// for every cross-cluster enum); they are NEVER redefined here. This cluster
// IMPORTS NciiTargetSurfaceSchema, NciiTargetOutcomeSchema, and TargetLocatorV1Schema.
//
// Collection note: this cluster introduces NEW Firestore collections (+ one child
// subcollection under `nciiRemovalJobs`); wiring collections.ts / path-builders.ts
// / registry.ts is deferred to the app leg (the orchestrator binds the schemas +
// path builders there); the deterministic doc-id shapes are documented on each
// schema below.

import { z } from 'zod';
import {
  NciiTargetSurfaceSchema,
  NciiTargetOutcomeSchema,
  TargetLocatorV1Schema,
} from '../safety/foundation.js';

// ===========================================================================
// §A11 [H4] — phase / status vocabularies for the removal saga
// ===========================================================================

/** The removal saga phase progression. `denyServing` precedes
 * `removeOrTombstone`; `verifyRemoval` precedes `complete`. */
export const NciiRemovalPhaseSchema = z.enum([
  'resolveTargets',
  'discoverKnownCopies',
  'denyServing',
  'removeOrTombstone',
  'writeHashBlocks',
  'verifyRemoval',
  'complete',
]);
export type NciiRemovalPhase = z.infer<typeof NciiRemovalPhaseSchema>;

/** Top-level durable run status of the removal job. */
export const NciiRemovalStatusSchema = z.enum([
  'pending',
  'running',
  'retryableFailure',
  'deadLetter',
  'completed',
]);
export type NciiRemovalStatus = z.infer<typeof NciiRemovalStatusSchema>;

// ===========================================================================
// §A11 [H4] — NciiDiscoveryCursorV1 (typed resumable discovery cursor — never an
// untyped blob). Embedded on NciiRemovalJobV1.cursor.
// ===========================================================================

/** Typed resumable discovery cursor. `phase` mirrors the job phase enum;
 * `lastSurface` is the cross-cluster NciiTargetSurface. */
export const NciiDiscoveryCursorV1Schema = z.object({
  phase: NciiRemovalPhaseSchema,
  lastSurface: NciiTargetSurfaceSchema,
  lastCursorToken: z.string().min(1).optional(),
}).strict();
export type NciiDiscoveryCursorV1 = z.infer<typeof NciiDiscoveryCursorV1Schema>;

// ===========================================================================
// §A11 [H4] — nciiRemovalJobs/{jobId}
// Deterministic `jobId = sha256('ncii-removal-v1:' + requestId + ':' + caseId +
// ':' + generation)` (racing workers create the SAME job — idempotent).
// ===========================================================================

/** `nciiRemovalJobs/{jobId}` — REQUEST-scoped durable removal saga. Doc id
 * `jobId` is deterministic:
 * `sha256('ncii-removal-v1:' + requestId + ':' + caseId + ':' + generation)`
 * (racing workers create the same job). */
export const NciiRemovalJobV1Schema = z.object({
  schemaVersion: z.literal(1),
  // = sha256('ncii-removal-v1:' + requestId + ':' + caseId + ':' + generation)
  jobId: z.string().min(1),
  caseId: z.string().min(1),
  requestId: z.string().min(1),
  generation: z.number(),
  phase: NciiRemovalPhaseSchema,
  status: NciiRemovalStatusSchema,
  // typed resumable discovery cursor — never an untyped blob
  cursor: NciiDiscoveryCursorV1Schema.optional(),
  leaseOwner: z.string().min(1).optional(),
  leaseExpiresAt: z.number().optional(),
  attemptCount: z.number(),
  nextAttemptAt: z.number().optional(),
  lastErrorCode: z.string().optional(),
  createdAt: z.number(),
  updatedAt: z.number(),
  completedAt: z.number().optional(),
  deadLetterAt: z.number().optional(),
}).strict();
export type NciiRemovalJobV1 = z.infer<typeof NciiRemovalJobV1Schema>;

// ===========================================================================
// §A11 [H4] — nciiRemovalJobs/{jobId}/targets/{targetKeyHash}
// Per-target child row. `targetKeyHash` is the deterministic id derived from the
// canonical locator. Per-target transitions are independent sub-state machines.
// ===========================================================================

/** Serving-deny sub-state. */
export const NciiTargetServingDenyStateSchema = z.enum(['pending', 'denied', 'failed']);
export type NciiTargetServingDenyState = z.infer<typeof NciiTargetServingDenyStateSchema>;

/** Removal sub-state. */
export const NciiTargetRemovalStateSchema = z.enum(['pending', 'removed', 'tombstoned', 'failed']);
export type NciiTargetRemovalState = z.infer<typeof NciiTargetRemovalStateSchema>;

/** Verification sub-state. */
export const NciiTargetVerificationStateSchema = z.enum(['pending', 'verifiedGone', 'leftover']);
export type NciiTargetVerificationState = z.infer<typeof NciiTargetVerificationStateSchema>;

/** `nciiRemovalJobs/{jobId}/targets/{targetKeyHash}` — per-target removal row.
 * Doc id `targetKeyHash` is the deterministic id from the canonical locator.
 * Per-target transitions: `servingDeny (pending→denied | failed)`;
 * `removal (pending→removed | tombstoned | failed)`;
 * `verification (pending→verifiedGone | leftover)`. */
export const NciiRemovalTargetV1Schema = z.object({
  // deterministic id from the canonical locator
  targetKeyHash: z.string().min(1),
  locator: TargetLocatorV1Schema,
  surface: NciiTargetSurfaceSchema,
  expectedGeneration: z.number().optional(),
  servingDenyState: NciiTargetServingDenyStateSchema,
  removalState: NciiTargetRemovalStateSchema,
  verificationState: NciiTargetVerificationStateSchema,
  outcome: NciiTargetOutcomeSchema,
  attemptCount: z.number(),
  leaseOwner: z.string().min(1).optional(),
  leaseExpiresAt: z.number().optional(),
  lastErrorCode: z.string().optional(),
  updatedAt: z.number(),
}).strict();
export type NciiRemovalTargetV1 = z.infer<typeof NciiRemovalTargetV1Schema>;
