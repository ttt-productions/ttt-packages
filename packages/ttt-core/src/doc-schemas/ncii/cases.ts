// Trust & Safety — NCII operational case (Appendix A §A11, concept (3)) + the
// multi-hash block ([F8]).
//
// `nciiCases/{caseId}` — the internal operational record linking allegations +
// requests; minimize-retention (NOT NCMEC, NOT 1-yr). It uses bounded CHILD-LINK
// ROWS, never unbounded root arrays. Locked invariant [H7]: an NCII case NEVER
// "reclassifies to CSAM" — a linked child-safety case independently owns
// preservation / CyberTipline / child-safety account actions; child-safety
// linkage can never close/pause/replace/delete the NCII request or its 48h
// deadline.
//
// Every shape here is transcribed verbatim from the frozen Trust & Safety spec
// (Appendix A §A11 (3) + [F8]) — no invented values, no placeholders; the durable
// design owner is ttt-prod
// docs/design/nonconsensual-intimate-imagery-and-take-it-down.md.
//
// SHARED enums come from ../safety/foundation.js (the single source for every
// cross-cluster enum); they are NEVER redefined here. This cluster IMPORTS
// NciiInternalStatusSchema, NciiChildSafetyLinkStatusSchema, and
// NciiChildSafetyCrossoverSchema.
//
// Collection note: this cluster introduces a NEW Firestore collection plus child
// subcollections (allegationLinks / requestLinks / removalActions / blockedHashes).
// Wiring collections.ts / path-builders.ts / registry.ts is deferred to the app leg;
// the doc-id shapes are documented on each schema below.

import { z } from 'zod';
import {
  NciiInternalStatusSchema,
  NciiChildSafetyLinkStatusSchema,
  NciiChildSafetyCrossoverSchema,
  SafetyCaseClosureV1Schema,
  TargetLocatorV1Schema,
} from '../safety/foundation.js';

// ===========================================================================
// §A11 (3) — nciiCases/{caseId}
// ===========================================================================

/** Case lane — adult NCII vs likeness/depiction. */
export const NciiCaseLaneSchema = z.enum(['ncii', 'likeness']);
export type NciiCaseLane = z.infer<typeof NciiCaseLaneSchema>;

/** `nciiCases/{caseId}` — the operational record; minimize-retention; child-link
 * rows, never unbounded root arrays. Doc id `caseId` is a deterministic/assigned
 * id (z.string().min(1)). NO case-level `fileDeleteAfter` [M3]: a single
 * case-level timestamp could wrongly override a LATER-linked request, so each
 * evidence row owns its own `deleteAfter` and each request owns its own
 * PII/status/token schedule. */
export const NciiCaseV1Schema = z.object({
  schemaVersion: z.literal(1),
  caseId: z.string().min(1),
  revision: z.number(),
  lane: NciiCaseLaneSchema,
  // [H7] internal operational case status
  internalStatus: NciiInternalStatusSchema,
  // [H7] child-safety linkage status
  childSafetyLinkStatus: NciiChildSafetyLinkStatusSchema,
  // [F4] the possible-minor assessment; childSafetyCaseId lives HERE ([H7], one canonical place)
  crossover: NciiChildSafetyCrossoverSchema,
  // OPTIONAL labeled repairable PROJECTION of crossover.childSafetyCaseId — never the source of truth
  childSafetyCaseId: z.string().min(1).optional(),
  // NON-AUTHORITATIVE projection of the minimum active request monitor ([H4]); source of truth =
  // safetySlaMonitors/{requestId}__nciiRemovalDeadline
  nciiRemovalDeadlineAt: z.number().optional(),
  // [EUAS-008] the structured operator closure record, set when the case is closed via the guided
  // resolution flow. The terminal `internalStatus: 'closed'` flip is the lifecycle status; THIS is
  // who closed it, why, and with what outcome. Absent until closed.
  closure: SafetyCaseClosureV1Schema.optional(),
  // [F-014] Protected chat-report context recovery — parity with the child-safety case
  // (doc-schemas/safety/case.ts). When an NCII case opens from a chat report while the chat Worker is
  // unavailable, the immutable channel/message locator is preserved here and `contextResolutionPending`
  // flags that surrounding context still needs an operator re-fetch. Both optional; absent for
  // non-chat NCII cases.
  chatMessageLocator: TargetLocatorV1Schema.optional(),
  contextResolutionPending: z.boolean().optional(),
  createdAt: z.number(),
  updatedAt: z.number(),
}).strict();
export type NciiCaseV1 = z.infer<typeof NciiCaseV1Schema>;

// ===========================================================================
// §A11 (3) — child-link rows (bounded; NEVER root arrays)
// ===========================================================================

/** `nciiCases/{caseId}/allegationLinks/{allegationId}` — links an allegation to
 * the case. Doc id is the `allegationId`. */
export const NciiCaseAllegationLinkV1Schema = z.object({
  allegationId: z.string().min(1),
  linkedAt: z.number(),
  linkedByUid: z.string().min(1),
  // [EUAS-016/R4] The originating in-app report id, so a case close can flip the protected report
  // root(s) terminal (the child-safety path resolves this via sourceSignals; NCII via this field).
  // Optional for backward compat — a link written before this field simply yields no flip.
  reportId: z.string().min(1).optional(),
}).strict();
export type NciiCaseAllegationLinkV1 = z.infer<typeof NciiCaseAllegationLinkV1Schema>;

/** `nciiCases/{caseId}/requestLinks/{requestId}` — links a statutory request to
 * the case. Doc id is the `requestId`. */
export const NciiCaseRequestLinkV1Schema = z.object({
  requestId: z.string().min(1),
  linkedAt: z.number(),
  linkedByUid: z.string().min(1),
}).strict();
export type NciiCaseRequestLinkV1 = z.infer<typeof NciiCaseRequestLinkV1Schema>;

/** Removal-action method on a `removalActions` row. */
export const NciiCaseRemovalActionMethodSchema = z.enum(['tombstone', 'accountAction', 'assetBlock']);
export type NciiCaseRemovalActionMethod = z.infer<typeof NciiCaseRemovalActionMethodSchema>;

/** `nciiCases/{caseId}/removalActions/{actionId}` — append-only removal-action
 * row. Doc id is the `actionId`. */
export const NciiCaseRemovalActionV1Schema = z.object({
  at: z.number(),
  actorId: z.string().min(1),
  surface: z.string(),
  targetItemType: z.string(),
  targetItemId: z.string().min(1),
  method: NciiCaseRemovalActionMethodSchema,
  result: z.string(),
}).strict();
export type NciiCaseRemovalActionV1 = z.infer<typeof NciiCaseRemovalActionV1Schema>;

// ===========================================================================
// §A11 (4) [F8] — nciiCases/{caseId}/blockedHashes/{hashId} (multi-hash block;
// exact-hash blocks only; replaces the singular `reUploadBlock`)
// ===========================================================================

/** Provenance of a blocked exact hash. Transformed / non-identical content is
 * NEVER auto-claimed identical. */
export const NciiBlockedHashSourceSchema = z.enum([
  'requestEvidence',
  'platformOriginal',
  'platformCopy',
  'knownIdenticalCopy',
]);
export type NciiBlockedHashSource = z.infer<typeof NciiBlockedHashSourceSchema>;

/** Blocked-hash lifecycle. Reversal is restricted + audited; adult NCII hashes do
 * NOT enter the CSAM hash system unless child-safety criteria independently
 * apply. */
export const NciiBlockedHashStatusSchema = z.enum(['active', 'reversed']);
export type NciiBlockedHashStatus = z.infer<typeof NciiBlockedHashStatusSchema>;

/** `nciiCases/{caseId}/blockedHashes/{hashId}` [F8] — exact-hash block. Doc id is
 * the `hashId`. */
export const NciiBlockedHashV1Schema = z.object({
  hashId: z.string().min(1),
  algorithm: z.literal('sha256'),
  digest: z.string().min(1),
  source: NciiBlockedHashSourceSchema,
  createdAt: z.number(),
  createdByUid: z.string().min(1),
  status: NciiBlockedHashStatusSchema,
  reversedAt: z.number().optional(),
  reversedByUid: z.string().min(1).optional(),
  reversalReason: z.string().optional(),
}).strict();
export type NciiBlockedHashV1 = z.infer<typeof NciiBlockedHashV1Schema>;
