// Trust & Safety — the report spine (Appendix A §A1, Finding-H1).
//
// The canonical report-target contract produced by the server `resolveReportTarget()`
// resolver (Phase 1 step 2) plus the protected report root + public projection. Every
// shape here is transcribed verbatim from docs/code_changes_needed/trust-and-safety/
// IMPLEMENTATION_PLAN.md Appendix A §A1 — no invented values, no placeholders.
//
// SHARED enums + the target locator come from ./foundation.js (the single source for
// every cross-cluster enum); they are NEVER redefined here.
//
// Collection note: `ProtectedReportRootV1` is the FUTURE shape of the EXISTING
// `contentReports/{reportId}` collection — that collection is currently bound to the
// legacy `ReportSchema` (../report-docs.ts). This cluster introduces NO new Firestore
// collection; rebinding `contentReports` to `ProtectedReportRootV1` is deferred to the
// app leg (orchestrator wires collections.ts / path-builders.ts / registry.ts).

import { z } from 'zod';
import {
  ReportReasonSchema,
  ReportableItemTypeSchema,
  ProtectedForkSchema,
  TargetLocatorV1Schema,
} from './foundation.js';

// ===========================================================================
// Canonical-key version token. The key formulas are DEFINED below as comments
// (deterministic IDs are documented, never computed in this schema layer); the
// server resolver/writer computes them. Bump this token if any formula input
// set or hashing scheme changes.
// ===========================================================================

/** Version token folded into every canonical key formula below. */
export const REPORT_CANONICAL_KEY_VERSION = 'v1';

// ===========================================================================
// A1 — Server resolver result (ResolvedReportTargetV1)
// ===========================================================================

/** The server resolver result. The client `reportedItemId`/`reportedUserId` are
 * hints only; every field here is re-derived server-side at the reported revision. */
export const ResolvedReportTargetV1Schema = z.object({
  schemaVersion: z.literal(1),
  itemType: ReportableItemTypeSchema,
  canonicalParentPath: z.string(), // server-derived parent doc path
  canonicalItemId: z.string(), // server-derived item id (NEVER the client hint)
  revision: z.number(), // the reported revision/generation
  ownerUid: z.string(), // server-derived owner/sender uid (NOT client-supplied)
  ownerBlockKey: z.string(), // derived owner block key
  mediaAssetId: z.string().optional(), // typed per surface
  channelId: z.string().optional(),
  messageId: z.string().optional(),
  attachmentId: z.string().optional(),
  locator: TargetLocatorV1Schema, // the §A11 discriminated locator for downstream hold/removal
  resolvedAt: z.number(),
}).strict();
export type ResolvedReportTargetV1 = z.infer<typeof ResolvedReportTargetV1Schema>;

// ===========================================================================
// A1 — Sanitized frozen snapshot (ReportTargetSnapshotV1)
// ===========================================================================

/** The sanitized frozen snapshot captured at resolve time — no reporter identity,
 * no PII; immutable. */
export const ReportTargetSnapshotV1Schema = z.object({
  schemaVersion: z.literal(1),
  itemType: ReportableItemTypeSchema,
  canonicalItemId: z.string(),
  revision: z.number(),
  contentSummaryRef: z.string(), // pointer to a sanitized content snapshot (restricted)
  contentHashes: z.array(z.string()).max(16).optional(),
  capturedAt: z.number(),
}).strict();
export type ReportTargetSnapshotV1 = z.infer<typeof ReportTargetSnapshotV1Schema>;

// ===========================================================================
// A1 — Protected report root (ProtectedReportRootV1)
// ===========================================================================

/** Cluster-local lifecycle status of the protected report root. */
export const ProtectedReportRootStatusSchema = z.enum([
  'pending_review',
  'grouped',
  'actioned',
  'dismissed',
]);
export type ProtectedReportRootStatus = z.infer<typeof ProtectedReportRootStatusSchema>;

/** The protected report root (restricted — reporter identity + narrative segregated).
 * FUTURE shape of the EXISTING `contentReports/{reportId}` collection (rebinding
 * deferred to the app leg). `protectedFork` is set ONLY by the protected branch
 * (Phase 1 step 2a). */
export const ProtectedReportRootV1Schema = z.object({
  schemaVersion: z.literal(1),
  reportId: z.string().min(1), // = sha256(version + ':' + reporterUid + ':' + canonicalTargetKey) — see formulas below
  reporterUid: z.string().min(1),
  reason: ReportReasonSchema,
  resolvedTarget: ResolvedReportTargetV1Schema,
  snapshotRef: z.string(), // → ReportTargetSnapshotV1
  canonicalTargetKey: z.string(), // see formula below
  narrativeRef: z.string().optional(),
  protectedFork: ProtectedForkSchema.optional(), // set ONLY by the protected branch (Phase 1 step 2a)
  status: ProtectedReportRootStatusSchema,
  createdAt: z.number(),
  updatedAt: z.number(),
}).strict();
export type ProtectedReportRootV1 = z.infer<typeof ProtectedReportRootV1Schema>;

// ===========================================================================
// A1 — Public projection (ReportPublicProjectionV1)
// ===========================================================================

/** Public projection — no reporter identity / narrative. */
export const ReportPublicProjectionV1Schema = z.object({
  schemaVersion: z.literal(1),
  reportId: z.string().min(1),
  itemType: ReportableItemTypeSchema,
  reason: ReportReasonSchema,
  status: ProtectedReportRootStatusSchema,
  createdAt: z.number(),
}).strict();
export type ReportPublicProjectionV1 = z.infer<typeof ReportPublicProjectionV1Schema>;

// ===========================================================================
// Canonical keys (DEFINED — not inline prose). Computed server-side by the
// resolver/writer; documented here, NOT computed in this schema layer. The
// `version` token in each formula is `REPORT_CANONICAL_KEY_VERSION` above.
//
//   canonicalTargetKey = sha256(version + ':' + itemType + ':' + canonicalParentPath
//                               + ':' + canonicalItemId + ':' + revision)
//
//   reportId           = sha256(version + ':' + reporterUid + ':' + canonicalTargetKey)
//                        // deterministic dup-key: one report per reporter+target+revision.
//                        // This determinism is what makes the protected branch's retry a
//                        // no-op on the already-committed hold (Phase 1 step 2a).
//
//   reportGroupKey     = canonicalTargetKey
//                        // grouping key: all reporters of the same target+revision.
// ===========================================================================
