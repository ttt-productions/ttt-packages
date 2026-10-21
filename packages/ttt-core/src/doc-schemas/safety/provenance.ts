// Trust & Safety — the provenance cluster and its retention profile.
//
// `eventProvenance/{eventId}` — server-only, restricted provenance for source
// events (upload/message/report). On a hold the record is copied/linked into
// the evidence manifest (retentionClass='casePromoted', hold-governed). A scheduled
// deletion worker enforces the routine TTLs with a hold-aware no-delete guard.

import { z } from 'zod';

// ===========================================================================
// eventProvenance/{eventId}
// `eventId` is DETERMINISTIC per source event (e.g. the upload event id, the
// message-send seq key, or the report id) so a replayed
// source event converges on the same provenance doc — never a duplicate.
// ===========================================================================

/** Source-event kind. */
export const EventProvenanceKindSchema = z.enum([
  'uploadInit',
  'uploadFinalize',
  'messageSend',
  'reportSubmit',
]);
export type EventProvenanceKind = z.infer<typeof EventProvenanceKindSchema>;

/** Retention class. Build defaults (a later change may only SHORTEN them):
 *   routine uploadInit/uploadFinalize/messageSend = 90 days;
 *   reportSubmit = retained with the case.
 * On a hold the record is copied/linked into the evidence manifest as
 * 'casePromoted' (hold-governed); the scheduled deletion worker's hold-aware
 * no-delete guard never deletes a casePromoted record while a hold exists. */
export const EventProvenanceRetentionClassSchema = z.enum(['routine', 'casePromoted']);
export type EventProvenanceRetentionClass = z.infer<typeof EventProvenanceRetentionClassSchema>;

/** `subjectRefs` — a TYPED object, NOT an open array. Each field is the
 * relevant id for the source event's kind. */
export const EventProvenanceSubjectRefsSchema = z
  .object({
    uid: z.string().min(1).optional(),
    assetId: z.string().min(1).optional(),
    channelId: z.string().min(1).optional(),
    messageSeq: z.number().optional(),
    reportId: z.string().min(1).optional(),
  })
  .strict();
export type EventProvenanceSubjectRefs = z.infer<typeof EventProvenanceSubjectRefsSchema>;

/** `eventProvenance/{eventId}` — server-only, restricted provenance row. Doc id is
 * deterministic per source event. `trustedClientIp` is derived behind Firebase/
 * Cloudflare and is a restricted, INDEX-EXEMPT field; `userAgent` is truncated to
 * 256 chars + normalized. NO reuse for ads/engagement-profiling/analytics. */
export const EventProvenanceV1Schema = z
  .object({
    schemaVersion: z.literal(1),
    kind: EventProvenanceKindSchema,
    subjectRefs: EventProvenanceSubjectRefsSchema, // typed object, not an open array
    trustedClientIp: z.string(), // derived behind Firebase/Cloudflare; restricted, INDEX-EXEMPT field
    userAgent: z.string().max(256), // truncated to 256 chars, normalized
    at: z.number(),
    sessionId: z.string(),
    retentionClass: EventProvenanceRetentionClassSchema,
  })
  .strict();
export type EventProvenanceV1 = z.infer<typeof EventProvenanceV1Schema>;

// ===========================================================================
// Routine-retention build defaults (a later change may only SHORTEN them). These are the
// hold-aware deletion worker's TTL inputs; days, not ms. `reportSubmit` has NO
// routine TTL — it is retained with the case.
// ===========================================================================

/** Routine TTL (days) by kind — build default; may only be shortened. */
export const EVENT_PROVENANCE_ROUTINE_TTL_DAYS = {
  uploadInit: 90,
  uploadFinalize: 90,
  messageSend: 90,
  // reportSubmit: retained with the case — no routine TTL.
} as const;
