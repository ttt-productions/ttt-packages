// Trust & Safety — durable uploader-notice delivery state machine (Appendix A
// §A11 [H-10]).
//
// `nciiCases/{caseId}/uploaderNotices/{noticeId}` — the uploader notice is a
// first-class durable delivery record like every other NCII workflow object (NOT
// just two bare enums). NOTE: this notices cluster OWNS the
// `nciiCases/{caseId}/uploaderNotices/{noticeId}` subcollection schema even though
// the `nciiCases` root doc itself is owned by the requests cluster.
//
// Deterministic `noticeId = sha256('ncii-uploader-notice-v1:' + caseId + ':' +
// recipientUid + ':' + removalGeneration)`. The client-supplied ≥128-bit
// `idempotencyKey` together with the deterministic noticeId guarantees one record
// per retry.
//
// TRANSITIONS [H-10]:
//   pending → sent | delayed | suppressed | notApplicable
//   delayed → sent  (when `delayedUntil` elapses and no suppression applies)
//   delayed → suppressed
// A failed delivery re-drives through `command` (retry/dead-letter), never silently
// drops. Each terminal/transition writes the matching NciiActionType
// (`uploaderNoticeSent` / `uploaderNoticeDelayed` / `uploaderNoticeSuppressed` /
// `uploaderNoticeNotApplicable`) to the request `actions` log.
//
// Every shape here is transcribed verbatim from docs/code_changes_needed/
// trust-and-safety/IMPLEMENTATION_PLAN.md Appendix A §A11 [H-10] — no invented
// values, no placeholders.
//
// SHARED enums come from ../safety/foundation.js (the single source for every
// cross-cluster enum); they are NEVER redefined here. This cluster IMPORTS
// UploaderNoticeStatusSchema + UploaderNoticeReasonSchema.
//
// Collection note: this cluster owns a NEW subcollection of the requests-cluster
// `nciiCases` root (+ an append-only per-attempt ledger); wiring collections.ts /
// path-builders.ts / registry.ts is deferred to the app leg (the orchestrator
// binds the schemas + path builders there); the deterministic doc-id shape is
// documented on each schema below.

import { z } from 'zod';
import {
  UploaderNoticeStatusSchema,
  UploaderNoticeReasonSchema,
} from '../safety/foundation.js';

// ===========================================================================
// §A11 [H-10] — delivery channel + embedded shapes
// ===========================================================================

/** Notice delivery channel. */
export const NciiUploaderNoticeChannelSchema = z.enum(['inApp', 'email']);
export type NciiUploaderNoticeChannel = z.infer<typeof NciiUploaderNoticeChannelSchema>;

/** Who the notice is for, snapshotted at decision time (NEVER re-resolved). */
export const NciiUploaderNoticeRecipientSnapshotSchema = z.object({
  uid: z.string().min(1),
  deliveryAddressRef: z.string().min(1),
  capturedAt: z.number(),
}).strict();
export type NciiUploaderNoticeRecipientSnapshot = z.infer<typeof NciiUploaderNoticeRecipientSnapshotSchema>;

/** Durable retry/dead-letter delivery command on the notice. */
export const NciiUploaderNoticeCommandV1Schema = z.object({
  commandId: z.string().min(1),
  attemptCount: z.number(),
  nextAttemptAt: z.number().optional(),
  leaseOwner: z.string().min(1).optional(),
  leaseExpiresAt: z.number().optional(),
  lastErrorCode: z.string().optional(),
}).strict();
export type NciiUploaderNoticeCommandV1 = z.infer<typeof NciiUploaderNoticeCommandV1Schema>;

// ===========================================================================
// §A11 [H-10] — nciiCases/{caseId}/uploaderNotices/{noticeId}
// ===========================================================================

/** `nciiCases/{caseId}/uploaderNotices/{noticeId}` — durable uploader-notice
 * delivery record (OWNED by the notices cluster). Doc id `noticeId` is
 * deterministic:
 * `sha256('ncii-uploader-notice-v1:' + caseId + ':' + recipientUid + ':' + removalGeneration)`. */
export const NciiUploaderNoticeV1Schema = z.object({
  schemaVersion: z.literal(1),
  noticeId: z.string().min(1),
  caseId: z.string().min(1),
  requestIds: z.array(z.string().min(1)).max(16),
  removalGeneration: z.number(),
  // who, snapshotted at decision time (never re-resolved)
  recipientSnapshot: NciiUploaderNoticeRecipientSnapshotSchema,
  channel: NciiUploaderNoticeChannelSchema,
  // the notice template + version actually used
  templateId: z.string().min(1),
  templateVersion: z.number(),
  // 'pending'|'sent'|'delayed'|'suppressed'|'notApplicable'
  status: UploaderNoticeStatusSchema,
  // present ONLY when status='suppressed' (+ restricted rationale via rationaleRef + reviewer identity)
  suppressionReason: UploaderNoticeReasonSchema.optional(),
  // suppression/delay rationale (restricted) + reviewer identity
  rationaleRef: z.string().min(1).optional(),
  decidedByUid: z.string().min(1).optional(),
  // when status='delayed' — the scheduled re-evaluation time (delayed → sent transition)
  delayedUntil: z.number().optional(),
  // ≥128-bit; with the deterministic noticeId guarantees one record per retry
  idempotencyKey: z.string().min(1),
  // durable retry/dead-letter delivery command
  command: NciiUploaderNoticeCommandV1Schema,
  // proof of delivery (provider receipt / read marker), when available
  verifiedDeliveredAt: z.number().optional(),
  createdAt: z.number(),
  updatedAt: z.number(),
}).strict();
export type NciiUploaderNoticeV1 = z.infer<typeof NciiUploaderNoticeV1Schema>;

// ===========================================================================
// §A11 [H-10] — nciiCases/{caseId}/uploaderNotices/{noticeId}/attempts/{attemptId}
// IMMUTABLE append-only per-attempt ledger.
// ===========================================================================

/** Per-attempt delivery result. */
export const NciiUploaderNoticeAttemptResultSchema = z.enum(['queued', 'sent', 'failed', 'deferred']);
export type NciiUploaderNoticeAttemptResult = z.infer<typeof NciiUploaderNoticeAttemptResultSchema>;

/** `nciiCases/{caseId}/uploaderNotices/{noticeId}/attempts/{attemptId}` —
 * IMMUTABLE append-only per-attempt ledger. Doc id `attemptId` is a
 * deterministic/assigned id (z.string().min(1)). */
export const NciiUploaderNoticeAttemptV1Schema = z.object({
  schemaVersion: z.literal(1),
  attemptId: z.string().min(1),
  at: z.number(),
  channel: NciiUploaderNoticeChannelSchema,
  result: NciiUploaderNoticeAttemptResultSchema,
  providerRef: z.string().min(1).optional(),
  errorCode: z.string().optional(),
}).strict();
export type NciiUploaderNoticeAttemptV1 = z.infer<typeof NciiUploaderNoticeAttemptV1Schema>;
