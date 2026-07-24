// Trust & Safety — safety holds + resource-scoped destructive commands (Appendix
// A §A3, Finding-H1 / [C-01] / [M-05]).
//
// The SINGLE destructive-guard authority: a `safetyHoldRefs/{caseId}__{resourceKeyHash}`
// row is the only doc that ever authorizes/denies a destructive byte-op; the
// `safetyHoldResources/{resourceKeyHash}` aggregate carries per-flag counters for
// O(1) destructive checks; and `safetyResourceCommands/{resourceKeyHash}__{commandId}`
// is the resource-scoped destructive command that resolves the release-before-delete
// race. Every shape here is transcribed verbatim from the frozen Trust & Safety
// spec (Appendix A §A3) — no invented values, no placeholders; the durable design
// owners are ttt-prod docs/design/csam-detection-and-response.md and
// docs/design/nonconsensual-intimate-imagery-and-take-it-down.md.
//
// SHARED enums come from ./foundation.js (the single source for every cross-cluster
// enum); they are NEVER redefined here. The hold-ref/aggregate resource type uses
// SafetyHoldResourceTypeSchema (the H1 enum that carries the NCII/storage types); the
// resource-command's `resourceType` uses TargetLocatorKindSchema (the [C-01] serving-
// vs-evidence resource = `TargetLocatorV1['kind']`).
//
// Collection note: this cluster introduces three NEW Firestore collections plus two
// overflow subcollections under `safetyResourceCommands`. Wiring collections.ts /
// path-builders.ts / registry.ts is deferred to the app leg (the orchestrator binds
// the schemas + path builders there); the composite doc-id shapes are documented on
// each schema below.

import { z } from 'zod';
import {
  SafetyHoldResourceTypeSchema,
  SafetyHoldClassSchema,
  SafetyCommandKindSchema,
  TargetLocatorKindSchema,
} from './foundation.js';

// ===========================================================================
// A3 — safetyHoldRefs/{caseId}__{resourceKeyHash}
// Mutable lifecycle row; the SINGLE destructive-guard hold authority (H1). Every
// hold — child-safety AND NCII-temporary — is one of these refs; no other doc is
// ever the authority. There is NO `holdSources[]` authority array.
// ===========================================================================

/** Lifecycle state of a hold ref. CAS release is on `state='active'`. */
export const SafetyHoldRefStateSchema = z.enum(['active', 'released']);
export type SafetyHoldRefState = z.infer<typeof SafetyHoldRefStateSchema>;

/** `safetyHoldRefs/{caseId}__{resourceKeyHash}` — mutable lifecycle row; the SINGLE
 * destructive-guard hold authority (H1). Doc id is the deterministic composite
 * `{caseId}__{resourceKeyHash}`. */
export const SafetyHoldRefV1Schema = z.object({
  schemaVersion: z.literal(1),
  caseId: z.string().min(1),
  resourceType: SafetyHoldResourceTypeSchema,
  resourceId: z.string().min(1),
  resourceKeyHash: z.string().min(1),
  canonicalResourceKey: z.string().min(1),
  // [C-07] The uid that OWNS the held resource (the content uploader / account subject),
  // when one is resolvable. NOT load-bearing for the destructive guard (that reads ONLY
  // the resourceKeyHash aggregate) — this is an admin-observability index so active holds
  // can be listed per account ("does this account have pending safety actions?"). Optional:
  // some resources have no single owning uid, and the `account` key already encodes the uid.
  ownerUid: z.string().min(1).optional(),
  blocksDeletion: z.boolean(),
  blocksAnonymization: z.boolean(),
  blocksReplacementCleanup: z.boolean(),
  state: SafetyHoldRefStateSchema,
  holdClass: SafetyHoldClassSchema, // lifecycle/retention regime; FULL set governed by the A3 compatibility matrix
  createdAt: z.number(),
  releasedAt: z.number().optional(),
  releaseReason: z.string().optional(),
  sourceRequestId: z.string().min(1).optional(), // the statutory request that created an nciiTemporary hold (H1)
  expiresAt: z.number().optional(), // minimize-retention expiry for nciiTemporary holds; ABSENT for childSafety / legalRetention / preservationEvidence
  releaseCommandId: z.string().min(1).optional(), // deterministic id of the CAS release/consume command (H1)
}).strict();
export type SafetyHoldRefV1 = z.infer<typeof SafetyHoldRefV1Schema>;

// ===========================================================================
// A3 — safetyHoldResources/{resourceKeyHash}
// Aggregate for O(1) destructive checks; per-flag counters. Create-ref +
// increment in ONE tx; release decrements the exact ref's counters in the same
// CAS transaction. Counters never go below zero. A destructive op is denied when
// its relevant count > 0 and FAILS CLOSED on lookup error.
// ===========================================================================

/** `safetyHoldResources/{resourceKeyHash}` — aggregate per-flag counters for O(1)
 * destructive checks. Doc id is the `resourceKeyHash`. */
export const SafetyHoldResourceV1Schema = z.object({
  schemaVersion: z.literal(1),
  resourceKeyHash: z.string().min(1),
  canonicalResourceKey: z.string().min(1),
  activeRefCount: z.number(),
  blocksDeletionCount: z.number(),
  blocksAnonymizationCount: z.number(),
  blocksReplacementCleanupCount: z.number(),
  updatedAt: z.number(),
}).strict();
export type SafetyHoldResourceV1 = z.infer<typeof SafetyHoldResourceV1Schema>;

// ===========================================================================
// A3 — safetyResourceCommands/{resourceKeyHash}__{commandId}
// Resource-scoped destructive command (the release-before-delete race fix).
// `commandId` is deterministic per `(resourceKeyHash, commandKind)`, so every
// compatible ref over the SAME bytes joins ONE command. Inline caps:
// authorizedFor.requestIds MAX 64, bypassHoldRefIds MAX 256; overflow moves to the
// child collections below and flips the matching `*Overflowed` flag.
// ===========================================================================

/** Command lifecycle state. The destructive byte-op runs ONLY under a command in
 * `authorized`/`executing`; a `failed` delete keeps the command + refs active for
 * idempotent retry (failed → re-lease → retry). */
export const SafetyResourceCommandStateSchema = z.enum([
  'authorized',
  'executing',
  'verifiedRemoved',
  'failed',
]);
export type SafetyResourceCommandState = z.infer<typeof SafetyResourceCommandStateSchema>;

/** The obligation(s) that authorized this destructive op. Overflow beyond
 * `requestIds` MAX 64 moves to the `authorizedRequests` child collection and sets
 * `requestIdsOverflowed=true`. */
export const SafetyResourceCommandAuthorizedForV1Schema = z.object({
  requestIds: z.array(z.string().min(1)).max(64),
  caseId: z.string().min(1).optional(),
  /** Additional case ids this command is authorized to bypass SERVING holds for — the
   *  LINKED child-safety case(s) in an NCII↔child-safety crossover (C-08). An
   *  `nciiRemoval` command authorized for the NCII `caseId` may bypass the linked
   *  child-safety case's hold on the SERVING resource so the 48h removal isn't stalled;
   *  the evidence-vault preservation hold has a DISTINCT resource key and is never
   *  bypassable. Bounded — a crossover links at most a handful of cases. */
  linkedCaseIds: z.array(z.string().min(1)).max(32).optional(),
  requestIdsOverflowed: z.boolean().optional(),
}).strict();
export type SafetyResourceCommandAuthorizedForV1 = z.infer<typeof SafetyResourceCommandAuthorizedForV1Schema>;

/** `safetyResourceCommands/{resourceKeyHash}__{commandId}` — resource-scoped
 * destructive command. Doc id is the deterministic composite
 * `{resourceKeyHash}__{commandId}` where `commandId` is deterministic per
 * `(resourceKeyHash, commandKind)`. */
export const SafetyResourceCommandV1Schema = z.object({
  schemaVersion: z.literal(1),
  resourceKeyHash: z.string().min(1),
  canonicalResourceKey: z.string().min(1),
  commandId: z.string().min(1), // deterministic per (resourceKeyHash, commandKind)
  commandKind: SafetyCommandKindSchema,
  resourceType: TargetLocatorKindSchema, // [C-01] the SERVING vs evidence-vault resource this command targets
  authorizedFor: SafetyResourceCommandAuthorizedForV1Schema, // overflow → authorizedRequests child collection
  bypassHoldRefIds: z.array(z.string().min(1)).max(256), // ONLY the bypassable refs per the compatibility matrix; overflow → bypassRefs child collection
  bypassHoldRefsOverflowed: z.boolean().optional(),
  state: SafetyResourceCommandStateSchema,
  attemptCount: z.number(),
  leaseOwner: z.string().min(1).optional(),
  leaseExpiresAt: z.number().optional(),
  lastErrorCode: z.string().optional(),
  createdAt: z.number(),
  updatedAt: z.number(),
  verifiedRemovedAt: z.number().optional(),
}).strict();
export type SafetyResourceCommandV1 = z.infer<typeof SafetyResourceCommandV1Schema>;

// ===========================================================================
// A3 [M-05] — overflow child collections under a resource command (mirror the
// `relatedAssets` overflow pattern). A `*Overflowed` flag means the inline array
// is NOT the complete set and the child collection MUST be consulted.
// ===========================================================================

/** `safetyResourceCommands/{resourceKeyHash}__{commandId}/authorizedRequests/{requestId}`
 * — overflow beyond `authorizedFor.requestIds` MAX 64. Doc id is the `requestId`. */
export const SafetyResourceCommandAuthorizedRequestV1Schema = z.object({
  requestId: z.string().min(1),
  caseId: z.string().min(1).optional(),
  addedAt: z.number(),
}).strict();
export type SafetyResourceCommandAuthorizedRequestV1 = z.infer<typeof SafetyResourceCommandAuthorizedRequestV1Schema>;

/** `safetyResourceCommands/{resourceKeyHash}__{commandId}/bypassRefs/{refId}` —
 * overflow beyond `bypassHoldRefIds` MAX 256. Doc id is the `refId`. */
export const SafetyResourceCommandBypassRefV1Schema = z.object({
  refId: z.string().min(1),
  holdClass: SafetyHoldClassSchema,
  addedAt: z.number(),
}).strict();
export type SafetyResourceCommandBypassRefV1 = z.infer<typeof SafetyResourceCommandBypassRefV1Schema>;
