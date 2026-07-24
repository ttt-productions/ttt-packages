// Trust & Safety — NCII temporary preservation holds (Appendix A §A11, the
// synchronous public-intake snapshot + temporary NCII hold [H3]).
//
// `nciiTemporaryHolds/{holdId}` — a TEMPORARY, minimize-retention preservation
// reference that BLOCKS destructive cleanup/replacement of a request target while
// a request is being processed. This is NOT the 1-yr CSAM hold: exact purpose,
// short expiry, extension rules for valid/pending, release rules for
// incomplete/invalid, hold-aware deletion.
//
// NON-AUTHORITATIVE PROJECTION [H1]: this row is a workflow/projection only.
// `assertNoBlockingSafetyHold` consults the §A3 `safetyHoldResources` aggregate
// via `safetyHoldRefId`'s ref — NEVER this row. Expiry/release goes through the
// A3 CAS release command (no silent TTL on an `active` ref).
//
// Every shape here is transcribed verbatim from the frozen Trust & Safety spec
// (Appendix A §A11) — no invented values, no placeholders; the durable design
// owner is ttt-prod docs/design/nonconsensual-intimate-imagery-and-take-it-down.md.
//
// SHARED enums + the locator come from ../safety/foundation.js (the single source
// for every cross-cluster enum); they are NEVER redefined here. This cluster
// IMPORTS TargetLocatorV1Schema.
//
// Collection note: this cluster introduces a NEW Firestore collection; wiring
// collections.ts / path-builders.ts / registry.ts is deferred to the app leg (the
// orchestrator binds the schema + path builders there); the doc-id shape is
// documented on the schema below.

import { z } from 'zod';
import { TargetLocatorV1Schema } from '../safety/foundation.js';

// ===========================================================================
// §A11 [H3] — nciiTemporaryHolds/{holdId}
// ===========================================================================

/** Temp-hold lifecycle. CAS release runs through the A3 command (no silent TTL on
 * an `active` ref). Extended while the request is valid/pending. */
export const NciiTemporaryHoldStatusSchema = z.enum(['active', 'extended', 'released']);
export type NciiTemporaryHoldStatus = z.infer<typeof NciiTemporaryHoldStatusSchema>;

/** `nciiTemporaryHolds/{holdId}` — NON-AUTHORITATIVE workflow/projection of the
 * authoritative A3 hold (via `safetyHoldRefId`). Doc id `holdId` is a
 * deterministic/assigned id (z.string().min(1)). */
export const NciiTemporaryHoldV1Schema = z.object({
  schemaVersion: z.literal(1),
  holdId: z.string().min(1),
  requestId: z.string().min(1),
  caseId: z.string().min(1).optional(),
  resourceType: z.literal('nciiTemporaryTarget'),
  // [H1] pointer to the AUTHORITATIVE safetyHoldRefs entry — this row is a NON-AUTHORITATIVE projection
  safetyHoldRefId: z.string().min(1),
  // [H4] the discriminated locator — NOT an all-optional contentRef
  target: TargetLocatorV1Schema,
  rootLineageRef: z.string().min(1).optional(),
  contentHashes: z.array(z.string().min(1)).max(16).optional(),
  ownerUid: z.string().min(1).optional(),
  capturedRevision: z.number().optional(),
  capturedGeneration: z.string().min(1).optional(),
  // pointer to the immutable request-target snapshot
  snapshotRef: z.string().min(1),
  purpose: z.literal('nciiTemporaryPreservation'),
  createdAt: z.number(),
  // short minimize-retention expiry; extended while request valid/pending
  expiresAt: z.number(),
  status: NciiTemporaryHoldStatusSchema,
  releasedAt: z.number().optional(),
  releaseReason: z.string().optional(),
}).strict();
export type NciiTemporaryHoldV1 = z.infer<typeof NciiTemporaryHoldV1Schema>;
