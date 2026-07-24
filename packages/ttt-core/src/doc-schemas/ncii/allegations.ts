// Trust & Safety — NCII allegations (Appendix A §A11, concept (1)).
//
// `nciiAllegations/{allegationId}` — ANY user (authenticated or anonymous public)
// may allege NCII. An allegation may justify platform-policy hiding but does NOT
// by itself satisfy the statute or arm the 48h clock; it NEVER auto-becomes a
// statutory `takeItDownRequest`. The discriminated locator is the ONE typed
// locator (TargetLocatorV1) — never an all-optional contentRef.
//
// Every shape here is transcribed verbatim from the frozen Trust & Safety spec
// (Appendix A §A11 (1)) — no invented values, no placeholders; the durable design
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
import { ResolvedReportTargetV1Schema } from '../safety/report.js';

// ===========================================================================
// §A11 (1) — nciiAllegations/{allegationId}
// ===========================================================================

/** Who alleged: an authenticated user, an anonymous member of the public, or an `operator` — an
 *  admin who found existing on-platform content and marked it as NCII-linked evidence (the
 *  admin-only "NCII linked evidence" report option). Operator allegations are the unlinked
 *  evidence POOL (status `received`, no `caseId`) until an operator links one to a case. */
export const NciiAllegationReporterTypeSchema = z.enum(['authenticatedUser', 'anonymousPublic', 'operator']);
export type NciiAllegationReporterType = z.infer<typeof NciiAllegationReporterTypeSchema>;

/** Allegation lifecycle status — `received` until triaged into one of the
 * terminal/linked states. An allegation NEVER becomes a statutory request. */
export const NciiAllegationStatusSchema = z.enum(['received', 'linked', 'dismissed', 'escalated']);
export type NciiAllegationStatus = z.infer<typeof NciiAllegationStatusSchema>;

/** `nciiAllegations/{allegationId}` — any user may allege; does NOT by itself
 * satisfy the statute or arm the 48h clock. Doc id `allegationId` is a
 * deterministic/assigned id (z.string().min(1)). */
export const NciiAllegationV1Schema = z.object({
  schemaVersion: z.literal(1),
  allegationId: z.string().min(1),
  caseId: z.string().min(1).optional(),
  reporterType: NciiAllegationReporterTypeSchema,
  submittedAt: z.number(),
  // the discriminated locator (the ONE typed locator) — never an all-optional contentRef
  targetLocator: TargetLocatorV1Schema,
  allegationReason: z.string(), // free-text reason; NEVER substitutes for a statutory request
  status: NciiAllegationStatusSchema,
  // For an OPERATOR-marked evidence allegation (reporterType 'operator'): the server-resolved
  // target captured at mark time (owner / canonical parent+item / revision). Carried so the
  // link-to-case step can arm the `nciiTemporary` preservation hold and pre-fill the ban target
  // WITHOUT re-resolving (a TargetLocatorV1 kind does not map cleanly back to a report itemType).
  // Absent on authenticatedUser / anonymousPublic allegations.
  resolvedTarget: ResolvedReportTargetV1Schema.optional(),
}).strict();
export type NciiAllegationV1 = z.infer<typeof NciiAllegationV1Schema>;
