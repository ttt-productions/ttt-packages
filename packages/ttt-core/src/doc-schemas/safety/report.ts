// Trust & Safety — the report spine (Appendix A §A1, Finding-H1).
//
// The canonical report-target contract produced by the server `resolveReportTarget()`
// resolver plus the protected report root + public projection. Every shape here is
// transcribed verbatim from the frozen Trust & Safety spec (Appendix A §A1) — no
// invented values, no placeholders; the durable design owner is ttt-prod
// docs/design/content-moderation-and-reporting.md.
//
// SHARED enums + the target locator come from ./foundation.js (the single source for
// every cross-cluster enum); they are NEVER redefined here.
//
// Collection bindings (../registry.ts): `contentReports/{reportId}` →
// `ProtectedReportRootV1Schema`, `contentReports/{reportId}/publicProjection/{reportId}`
// → `ReportPublicProjectionV1Schema`, and `activeReportGroups/{groupKey}` →
// `ReportGroupV1Schema`. These REPLACED the legacy loose-string report/group schemas; the
// report DOC shape now lives entirely in this file.

import { z } from 'zod';
import {
  ReportReasonSchema,
  ReportableItemTypeSchema,
  ProtectedForkSchema,
  TargetLocatorV1Schema,
} from './foundation.js';
import {
  MAX_REPORT_NARRATIVE_LENGTH,
  MAX_REPORT_SNAPSHOT_TEXT_LENGTH,
} from '../../constants/business.js';
import { MediaAssetOwnerTypeSchema } from '../media-assets.js';
import { ModerationEdgeSyncOpSchema, ModerationEdgeSyncStateSchema } from '../moderation.js';

// ===========================================================================
// Canonical-key version token. The key formulas are DEFINED below as comments
// (deterministic IDs are documented, never computed in this schema layer); the
// server resolver/writer computes them. Bump this token if any formula input
// set or hashing scheme changes.
// ===========================================================================

/** Version token folded into every canonical key formula below.
 *
 * v2 (pre-launch, no migration): two coordinated formula-input changes ride this
 * single bump —
 *   (1) `canonicalTargetKey` composition is now INJECTIVE: each field is
 *       length-prefixed (`len:value`) before joining, so no pair of adjacent
 *       attacker-controlled fields (chat `canonicalParentPath` + `canonicalItemId`)
 *       can produce a colliding preimage across different (channel, message) pairs.
 *   (2) `revision` is derived from CONTENT-relevant state only (the content-edit
 *       stamp `updatedAt`, falling back to `createdAt`) — NEVER the Firestore write
 *       clock (`updateTime`). Counter writes (likes/votes/follows) no longer fragment
 *       report groups or defeat per-reporter dedupe. */
export const REPORT_CANONICAL_KEY_VERSION = 'v2';

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
  revision: z.number(), // reported content revision — derived from the content-edit stamp
                        // (updatedAt, falling back to createdAt), NEVER the write clock (updateTime)
  ownerUid: z.string(), // server-derived owner/sender uid (NOT client-supplied)
  ownerBlockKey: z.string(), // derived owner block key
  mediaAssetId: z.string().optional(), // typed per surface
  channelId: z.string().optional(),
  messageId: z.string().optional(),
  // (There is no `attachmentId` mirror: chat carries no media, and a Conversation File is
  // identified by its `conversationFile` locator + the `mediaAssetId` field above.)
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
  // [H-11/EUAS-013/R14] The sanitized REPORTED CONTENT captured at report time, so an author can't edit
  // the violating text/media out before review and have the operator see only the cleaned live doc
  // (edit-to-evade). `capturedText` = the bounded reported text/title/description (NO PII);
  // `capturedMediaAssetIds` = the reported media asset ids. Frozen + immutable like the rest.
  capturedText: z.string().max(MAX_REPORT_SNAPSHOT_TEXT_LENGTH).optional(),
  capturedMediaAssetIds: z.array(z.string()).max(32).optional(),
  capturedAt: z.number(),
}).strict();
export type ReportTargetSnapshotV1 = z.infer<typeof ReportTargetSnapshotV1Schema>;

// ===========================================================================
// A1 — Segregated reporter narrative (NarrativeRecordV1)
// ===========================================================================

/** The reporter's free-text narrative — segregated reporter PII. Lives in a
 * restricted subcollection (`contentReports/{reportId}/privateDetails/narrative`),
 * admin-read-only, client-write-forbidden; NEVER inlined on the report root or
 * the public projection. The frozen target snapshot is stored alongside it at
 * `contentReports/{reportId}/privateDetails/snapshot` (ReportTargetSnapshotV1). */
export const NarrativeRecordV1Schema = z.object({
  schemaVersion: z.literal(1),
  reportId: z.string().min(1),
  reporterUid: z.string().min(1), // stored so account-erasure can scrub the narrative
  text: z.string().min(1).max(MAX_REPORT_NARRATIVE_LENGTH),
  createdAt: z.number(),
}).strict();
export type NarrativeRecordV1 = z.infer<typeof NarrativeRecordV1Schema>;

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
  reportId: z.string().min(1), // = sha256(lp(version) + lp(reporterUid) + lp(canonicalTargetKey)) — see injective formulas below
  reporterUid: z.string().min(1),
  reason: ReportReasonSchema,
  resolvedTarget: ResolvedReportTargetV1Schema,
  snapshotRef: z.string(), // → ReportTargetSnapshotV1
  canonicalTargetKey: z.string(), // see formula below
  narrativeRef: z.string().optional(),
  protectedFork: ProtectedForkSchema.optional(), // set ONLY by the protected branch (Phase 1 step 2a)
  // Set when this ordinary report was escalated into its authoritative protected
  // safety case. The root remains a durable reporter record, not a second case.
  escalatedToCase: z.string().min(1).optional(),
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
// A1 — Report group (ReportGroupV1) — dedup/count group keyed by canonicalTargetKey
// ===========================================================================

/** What an admin's content action left the reported content as. `admin_hidden` = hidden pending
 * a final call; `resolved_removed` = permanently removed; `resolved_restored` = put back. */
export const ReportGroupModerationStateSchema = z.enum([
  'admin_hidden',
  'resolved_restored',
  'resolved_removed',
]);
export type ReportGroupModerationState = z.infer<typeof ReportGroupModerationStateSchema>;

/** founded = the report was substantiated; unfounded = no violation on review. */
export const ReportGroupResolutionOutcomeSchema = z.enum(['founded', 'unfounded']);
export type ReportGroupResolutionOutcome = z.infer<typeof ReportGroupResolutionOutcomeSchema>;

/** The dedup/count group for all reports of the same target+revision. The group key
 * IS the `canonicalTargetKey` (== reportGroupKey). NO trusted client owner field — the
 * owner lives on the restricted ProtectedReportRootV1 (resolvedTarget.ownerUid), never
 * here. An app-side trigger maintains the counts; this is the public-ish group surface
 * the admin browse + admin-task queue read. Bound to `activeReportGroups/{groupKey}`.
 *
 * This is the WHOLE stored document. The required fields are the counting core the intake
 * trigger writes on the first report; every optional field below is lifecycle state a later
 * server writer merges onto the same document, grouped by the writer that owns it. All of it is
 * server-derived — nothing here is ever a client hint. */
export const ReportGroupV1Schema = z.object({
  schemaVersion: z.literal(1),
  groupKey: z.string().min(1), // = canonicalTargetKey
  itemType: ReportableItemTypeSchema,
  totalReports: z.number(),
  highestReasonScore: z.number(),
  lastReportAt: z.number(),
  latestReason: ReportReasonSchema,
  // [R12] close-lifecycle states. An ordinary report's admin close (hide/remove/restore) moves the
  // group to `processing` and STAYS in the queue — it is NEVER cleared on the click. The group flips
  // to the terminal `resolved` ONLY when the edge serving-deny (hide/remove) or block-clear (restore)
  // VERIFIES. If the content-serving-sync saga exhausts its retries (dead-letter), the group moves to
  // `failed` — kept in the queue, surfaced in the Safety Console failed-jobs view, with a Restart that
  // re-arms the job. Both are explicit values (never derived).
  status: z.enum(['pending', 'reviewing', 'processing', 'failed', 'resolved']),

  // --- Moderation locator (intake trigger) — where the reported content lives, derived from the
  // report's server-resolved target. `reportedItemId` keys the moderation doc; `parentItemId` is
  // its parent (audition id for an entry, hall item id for a sub-item, channel ref for a chat
  // message) or null; `reportedUserId` is the content owner and is omitted when it could not be
  // resolved, so an earlier resolution is never clobbered by an empty one.
  reportedItemId: z.string().min(1).optional(),
  parentItemId: z.string().nullable().optional(),
  reportedUserId: z.string().min(1).optional(),

  // --- Content action (moderateReportedContent) — what the admin's hide/remove/restore left.
  moderationState: ReportGroupModerationStateSchema.optional(),
  contentHidden: z.boolean().optional(),
  moderatedAt: z.number().optional(),

  // --- Edge-sync obligation (moderateReportedContent, replayed by adminReplayDeadLetter). Co-written
  // with the content action so edge state is never silently lost. Owner-keyed types persist
  // ownerType + ownerId; asset-level types persist only the asset ids. The params are deleted
  // once the obligation settles and `edgeSyncState` is set to null.
  edgeSyncState: ModerationEdgeSyncStateSchema.nullable().optional(),
  edgeSyncProcessingAt: z.number().optional(),
  edgeSyncOp: ModerationEdgeSyncOpSchema.optional(),
  edgeSyncOwnerType: MediaAssetOwnerTypeSchema.optional(),
  edgeSyncOwnerId: z.string().min(1).optional(),
  edgeSyncAssetIds: z.array(z.string().min(1)).optional(),
  edgeSyncError: z.string().optional(),
  edgeSyncFailedAt: z.number().optional(),

  // --- Resolution (resolveAdminTask) — the admin's recorded outcome. The reason fields hold the
  // reason CODE and the optional free-text detail shown to the affected user.
  resolutionOutcome: ReportGroupResolutionOutcomeSchema.optional(),
  resolvedBy: z.string().min(1).optional(),
  resolvedAt: z.number().optional(),
  resolutionUserFacingReasonCode: z.string().optional(),
  resolutionUserFacingReasonDetail: z.string().optional(),
  resolutionAdminNote: z.string().optional(),

  // --- Chat tombstone lane (processChatAdminCommands, reset by adminReplayDeadLetter). A chat
  // report's close-out waits on the tombstone command; a dead-lettered command moves the group to
  // `failed` with the reason, and a Restart nulls the failure fields.
  tombstoneAppliedAt: z.number().optional(),
  lastError: z.string().nullable().optional(),
  failedAt: z.number().nullable().optional(),
  failedCommandDocId: z.string().min(1).optional(),

  // --- Escalation to a protected case (escalationReconciliation). A group whose only report was
  // escalated is parked `resolved` with the case it moved to; a group that keeps other reports
  // records only that one was taken out of the count.
  supersededByCaseId: z.string().min(1).optional(),
  supersededAt: z.number().optional(),
  supersededPartialAt: z.number().optional(),

  // --- Ordinary-report account hold (checkinTask). True from the moment a resolved close-out
  // begins releasing the hold until the idempotent release succeeds; the cleanup schedule
  // re-issues the release for any group still carrying true.
  pendingHoldRelease: z.boolean().optional(),
}).strict();
export type ReportGroupV1 = z.infer<typeof ReportGroupV1Schema>;

/** `activeReportGroups/{groupKey}/reportGroupCountedReports/{reportId}` — the per-report
 * idempotency marker stamped in the SAME transaction as the group's totalReports increment;
 * its existence is what makes a redelivered create event a no-op. Backend-only. */
export const ReportGroupCountedReportSchema = z.object({
  reportId: z.string().min(1),
  countedAt: z.number(),
}).strict();
export type ReportGroupCountedReport = z.infer<typeof ReportGroupCountedReportSchema>;

// ===========================================================================
// Canonical keys (DEFINED — not inline prose). Computed server-side by the
// resolver/writer; documented here, NOT computed in this schema layer. The
// `version` token in each formula is `REPORT_CANONICAL_KEY_VERSION` above (now v2).
//
//   canonicalTargetKey = sha256( lp(version) + lp(itemType) + lp(canonicalParentPath)
//                                + lp(canonicalItemId) + lp(String(revision)) )
//                        // v2: INJECTIVE composition. lp(s) length-prefixes each field
//                        // as `<byteLength>:<s>` (or hash each field separately) so no ':'
//                        // ambiguity can straddle two adjacent attacker-controlled fields.
//                        // The old `[...].join(':')` was collision-prone for chat targets,
//                        // whose canonicalParentPath + canonicalItemId are BOTH client-
//                        // derived strings (synthetic:chat:<channelRef> / <messageId>).
//                        // `revision` is the CONTENT revision (content-edit stamp, never
//                        // the Firestore write clock) — see REPORT_CANONICAL_KEY_VERSION.
//
//   reportId           = sha256( lp(version) + lp(reporterUid) + lp(canonicalTargetKey) )
//                        // deterministic dup-key: one report per reporter+target+revision.
//                        // This determinism is what makes the protected branch's retry a
//                        // no-op on the already-committed hold (Phase 1 step 2a).
//
//   reportGroupKey     = canonicalTargetKey
//                        // grouping key: all reporters of the same target+revision.
// ===========================================================================
