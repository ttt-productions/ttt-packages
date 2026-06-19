// Trust & Safety — the provenance cluster (Appendix A §A6, Finding-M2 concrete
// retention profile).
//
// `eventProvenance/{eventId}` — server-only, restricted provenance for source
// events (upload/message/login/report). On a hold the record is copied/linked into
// the evidence manifest (retentionClass='casePromoted', hold-governed). A scheduled
// deletion worker enforces the routine TTLs with a hold-aware no-delete guard.
//
// Every shape here is transcribed verbatim from docs/code_changes_needed/
// trust-and-safety/IMPLEMENTATION_PLAN.md Appendix A §A6 — no invented values, no
// placeholders.
//
// Collection note: this cluster introduces ONE NEW Firestore collection. Wiring
// collections.ts / path-builders.ts / registry.ts is deferred to the app leg (the
// orchestrator binds the schema + path builder there); the deterministic doc-id
// shape is documented on the schema below.

import { z } from 'zod';

// ===========================================================================
// §A6 — eventProvenance/{eventId}
// `eventId` is DETERMINISTIC per source event (e.g. the upload event id, the
// message-send seq key, the login session key, or the report id) so a replayed
// source event converges on the same provenance doc — never a duplicate.
// ===========================================================================

/** §A6 source-event kind. */
export const EventProvenanceKindSchema = z.enum([
  'uploadInit',
  'uploadFinalize',
  'messageSend',
  'login',
  'reportSubmit',
]);
export type EventProvenanceKind = z.infer<typeof EventProvenanceKindSchema>;

/** §A6 retention class. Build defaults (counsel may only SHORTEN):
 *   routine uploadInit/uploadFinalize/messageSend = 90 days;
 *   login = 30 days;
 *   reportSubmit = retained with the case.
 * On a hold the record is copied/linked into the evidence manifest as
 * 'casePromoted' (hold-governed); the scheduled deletion worker's hold-aware
 * no-delete guard never deletes a casePromoted record while a hold exists. */
export const EventProvenanceRetentionClassSchema = z.enum(['routine', 'casePromoted']);
export type EventProvenanceRetentionClass = z.infer<typeof EventProvenanceRetentionClassSchema>;

/** §A6 `subjectRefs` — a TYPED object, NOT an open array. Each field is the
 * relevant id for the source event's kind. */
export const EventProvenanceSubjectRefsSchema = z.object({
  uid: z.string().min(1).optional(),
  assetId: z.string().min(1).optional(),
  channelId: z.string().min(1).optional(),
  messageSeq: z.number().optional(),
  reportId: z.string().min(1).optional(),
}).strict();
export type EventProvenanceSubjectRefs = z.infer<typeof EventProvenanceSubjectRefsSchema>;

/** `eventProvenance/{eventId}` — server-only, restricted provenance row. Doc id is
 * deterministic per source event. `trustedClientIp` is derived behind Firebase/
 * Cloudflare and is a restricted, INDEX-EXEMPT field; `userAgent` is truncated to
 * 256 chars + normalized. NO reuse for ads/engagement-profiling/analytics. */
export const EventProvenanceV1Schema = z.object({
  schemaVersion: z.literal(1),
  kind: EventProvenanceKindSchema,
  subjectRefs: EventProvenanceSubjectRefsSchema, // typed object, not an open array
  trustedClientIp: z.string(), // derived behind Firebase/Cloudflare; restricted, INDEX-EXEMPT field
  userAgent: z.string().max(256), // truncated to 256 chars, normalized
  at: z.number(),
  sessionId: z.string(),
  retentionClass: EventProvenanceRetentionClassSchema,
}).strict();
export type EventProvenanceV1 = z.infer<typeof EventProvenanceV1Schema>;

// ===========================================================================
// §A6 — routine-retention build defaults (counsel may only SHORTEN). These are the
// hold-aware deletion worker's TTL inputs; days, not ms. `reportSubmit` has NO
// routine TTL — it is retained with the case.
// ===========================================================================

/** Routine TTL (days) by kind — build default; counsel may only shorten. */
export const EVENT_PROVENANCE_ROUTINE_TTL_DAYS = {
  uploadInit: 90,
  uploadFinalize: 90,
  messageSend: 90,
  login: 30,
  // reportSubmit: retained with the case — no routine TTL.
} as const;
