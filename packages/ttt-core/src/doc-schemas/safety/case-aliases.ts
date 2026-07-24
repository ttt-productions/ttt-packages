// Trust & Safety — child-safety case OWNING ALIASES (§A2, Finding-H2/H3).
//
// The owning-alias registry is a 1:1 claim map: `childSafetyOwningAliases/{aliasId}`.
// Intake READS this registry inside the case-open transaction; an alias already
// claimed by a DIFFERENT case is NOT a `tx.create` throw — the two cases are
// cross-linked instead (a `relatedCaseIds` reference stamped on both cases so the
// operator sees they're related), and the ORIGINAL owner is kept.
//
// The "one case per incident" MERGE protocol (merge jobs, correlations, mergeState)
// was ripped out (DJ 2026-07-02): it existed only as schema, nothing ever created a
// merge job or wrote a correlation. PhotoDNA is pre-publication, so the report+hash
// collision only arises via the rare operator NCII-crossover re-scan; two console
// rows for one rare incident is acceptable, and cross-linking covers the operator's
// need to see related cases.
//
// Every shape here is transcribed verbatim from the frozen Trust & Safety spec
// (Appendix A §A2) — no invented values, no placeholders; the durable design
// owner is ttt-prod docs/design/csam-detection-and-response.md. Deterministic
// IDs are documented as comments; the server computes them (never this schema
// layer).

import { z } from 'zod';

// ===========================================================================
// Canonical-key version token (folded into the deterministic id formula below).
// Bump if its formula input set or hashing scheme changes.
// ===========================================================================

/** Version token folded into `aliasId` and `incidentKey`. */
export const SAFETY_ALIAS_VERSION = 'v1';

// ===========================================================================
// Cluster-local enum (§A2).
// ===========================================================================

/** OWNING alias types — ONLY these four. */
export const ChildSafetyOwningAliasTypeSchema = z.enum([
  'incidentKey',
  'rootIngest',
  'canonicalTarget',
  'messageRange',
]);
export type ChildSafetyOwningAliasType = z.infer<typeof ChildSafetyOwningAliasTypeSchema>;

// ===========================================================================
// §A2 — OWNING aliases: childSafetyOwningAliases/{aliasId}
//   aliasId = sha256(SAFETY_ALIAS_VERSION + ':' + aliasType + ':' + canonicalValueHash)
//   incidentKey = sha256('incident-v1:' + normalizedRootIngestId + ':' +
//                        normalizedOriginatingUploaderUid)   (Finding-H3 hard key)
// ===========================================================================

export const ChildSafetyOwningAliasV1Schema = z.object({
  schemaVersion: z.literal(1),
  caseId: z.string().min(1),
  aliasType: ChildSafetyOwningAliasTypeSchema,
  canonicalValueHash: z.string(),
  createdAt: z.number(),
}).strict();
export type ChildSafetyOwningAliasV1 = z.infer<typeof ChildSafetyOwningAliasV1Schema>;
