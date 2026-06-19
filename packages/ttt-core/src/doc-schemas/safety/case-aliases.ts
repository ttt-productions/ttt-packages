// Trust & Safety — child-safety case ALIASES, CORRELATIONS, and MERGE (§A2,
// Finding-H2/H3).
//
// The alias model is SPLIT into two disjoint structures:
//   - OWNING aliases (1:1; the ONLY inputs to claim/merge) —
//     `childSafetyOwningAliases/{aliasId}`.
//   - CORRELATIONS (M:N; search/link only, NEVER inputs to claim/merge) —
//     `childSafetyCorrelations/{correlationKey}/cases/{caseId}`.
// A multi-case owning-alias collision spawns a deterministic, fenced merge job —
// `safetyCaseMergeJobs/{mergeJobId}`.
//
// Every shape here is transcribed verbatim from docs/code_changes_needed/
// trust-and-safety/IMPLEMENTATION_PLAN.md Appendix A §A2 — no invented values,
// no placeholders. Deterministic IDs are documented as comments; the server
// computes them (never this schema layer).

import { z } from 'zod';

// ===========================================================================
// Canonical-key version tokens (folded into the deterministic id formulas
// below). Bump a token if its formula input set or hashing scheme changes.
// ===========================================================================

/** Version token folded into `aliasId` and `incidentKey`. */
export const SAFETY_ALIAS_VERSION = 'v1';
/** Version token folded into `correlationKey`. */
export const SAFETY_CORRELATION_VERSION = 'v1';
/** Version token folded into `mergeJobId`. */
export const SAFETY_MERGE_VERSION = 'merge-v1';

// ===========================================================================
// Cluster-local enums (§A2).
// ===========================================================================

/** OWNING alias types — ONLY these four. (Correlation links are NEVER owning
 * aliases; see CorrelationType below.) */
export const ChildSafetyOwningAliasTypeSchema = z.enum([
  'incidentKey',
  'rootIngest',
  'canonicalTarget',
  'messageRange',
]);
export type ChildSafetyOwningAliasType = z.infer<typeof ChildSafetyOwningAliasTypeSchema>;

/** CORRELATION types — M:N, search/link only. NEVER select a winner, NEVER
 * trigger a merge, NEVER live as an owning alias. */
export const ChildSafetyCorrelationTypeSchema = z.enum(['exactSha256', 'detectorMatch']);
export type ChildSafetyCorrelationType = z.infer<typeof ChildSafetyCorrelationTypeSchema>;

/** `safetyCaseMergeJobs` lifecycle status. */
export const SafetyCaseMergeJobStatusSchema = z.enum([
  'pending',
  'fenced',
  'movingLinks',
  'reconcilingSubmissions',
  'complete',
  'deadLetter',
]);
export type SafetyCaseMergeJobStatus = z.infer<typeof SafetyCaseMergeJobStatusSchema>;

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

// ===========================================================================
// §A2 — CORRELATIONS (M:N): childSafetyCorrelations/{correlationKey}/cases/{caseId}
//   correlationKey = sha256(SAFETY_CORRELATION_VERSION + ':' + correlationType +
//                          ':' + canonicalValueHash)
//   A correlation key may list many cases; the child doc is keyed by caseId.
//   Correlations NEVER select a winner and NEVER trigger a merge.
// ===========================================================================

export const ChildSafetyCorrelationCaseV1Schema = z.object({
  schemaVersion: z.literal(1),
  caseId: z.string().min(1),
  correlationType: ChildSafetyCorrelationTypeSchema,
  canonicalValueHash: z.string(),
  rootIngestId: z.string().min(1),
  originatingUploaderUid: z.string().min(1),
  firstSeenAt: z.number(),
  sourceSignalId: z.string().min(1),
}).strict();
export type ChildSafetyCorrelationCaseV1 = z.infer<typeof ChildSafetyCorrelationCaseV1Schema>;

// ===========================================================================
// §A2 — MERGE jobs: safetyCaseMergeJobs/{mergeJobId}
//   mergeJobId = sha256(SAFETY_MERGE_VERSION + ':' + sortedCaseIds.join(','))
//   (deterministic — racing workers create the same job). Winner is selected and
//   FROZEN at merge-claim time (`mergeGeneration` stamped on every participant)
//   and never recalculated. participantCaseIds + losers each MAX 16.
// ===========================================================================

/** A losing participant of a merge job (frozen at claim time). */
export const SafetyCaseMergeLoserV1Schema = z.object({
  caseId: z.string().min(1),
  expectedRevision: z.number(),
  redirectWritten: z.boolean(),
}).strict();
export type SafetyCaseMergeLoserV1 = z.infer<typeof SafetyCaseMergeLoserV1Schema>;

export const SafetyCaseMergeJobV1Schema = z.object({
  schemaVersion: z.literal(1),
  mergeJobId: z.string().min(1),
  participantCaseIds: z.array(z.string().min(1)).max(16),
  winnerCaseId: z.string().min(1),
  mergeGeneration: z.number(),
  losers: z.array(SafetyCaseMergeLoserV1Schema).max(16),
  status: SafetyCaseMergeJobStatusSchema,
  leaseOwner: z.string().min(1).optional(),
  leaseExpiresAt: z.number().optional(),
  attemptCount: z.number(),
  nextAttemptAt: z.number().optional(),
  lastErrorCode: z.string().min(1).optional(),
  createdAt: z.number(),
  updatedAt: z.number(),
  completedAt: z.number().optional(),
}).strict();
export type SafetyCaseMergeJobV1 = z.infer<typeof SafetyCaseMergeJobV1Schema>;
