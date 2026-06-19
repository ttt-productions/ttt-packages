// Trust & Safety — NCII allegations (Appendix A §A11, concept (1)).
//
// `nciiAllegations/{allegationId}` — ANY user (authenticated or anonymous public)
// may allege NCII. An allegation may justify platform-policy hiding but does NOT
// by itself satisfy the statute or arm the 48h clock; it NEVER auto-becomes a
// statutory `takeItDownRequest`. The discriminated locator is the ONE typed
// locator (TargetLocatorV1) — never an all-optional contentRef.
//
// Every shape here is transcribed verbatim from docs/code_changes_needed/
// trust-and-safety/IMPLEMENTATION_PLAN.md Appendix A §A11 (1) — no invented
// values, no placeholders.
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
// §A11 (1) — nciiAllegations/{allegationId}
// ===========================================================================

/** Who alleged: an authenticated user or an anonymous member of the public. */
export const NciiAllegationReporterTypeSchema = z.enum(['authenticatedUser', 'anonymousPublic']);
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
}).strict();
export type NciiAllegationV1 = z.infer<typeof NciiAllegationV1Schema>;
