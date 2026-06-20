// Account-deletion / GDPR-erasure request SCHEMA — `accountDeletionRequests/{uid}`.
//
// N3 data-deletion flow. A user clicks "delete account" on their profile → a
// request doc is created (one per user, doc id = uid, create-if-absent) and the
// account is immediately deactivated/locked out. The request runs a 30-day grace
// window (logging back in CANCELS it). After the window, the scheduled scrub
// worker checks for any BLOCKING safety hold over the user's data:
//   - no hold  → anonymize-in-place (scrub PII, release reserved name, anonymize
//                chat history, tombstone memberships) → `completed`.
//   - hold     → `parkedOnHold` (re-checked periodically): resumes + `completed`
//                once cleared, or → `superseded` if it becomes a ban-for-cause /
//                evidence-preservation outcome (the erasure is overridden and the
//                data retained as evidence).
//
// The scrub itself deletes/anonymizes data across many collections; this doc is
// ONLY the request lifecycle + the worker's resumable cursor.

import { z } from 'zod';

/** Lifecycle of an account-deletion request. */
export const AccountDeletionRequestStatusSchema = z.enum([
  'pending', // grace window running; user can still cancel by logging in
  'cancelled', // user cancelled (logged back in) before the window elapsed
  'scrubbing', // the scrub worker has started the anonymize-in-place erasure
  'parkedOnHold', // erasure deferred — a blocking safety hold covers the user's data
  'completed', // erasure finished
  'superseded', // overridden by a ban-for-cause / evidence-preservation outcome
]);
export type AccountDeletionRequestStatus = z.infer<typeof AccountDeletionRequestStatusSchema>;

/** `accountDeletionRequests/{uid}` — one per user; doc id IS the uid. */
export const AccountDeletionRequestV1Schema = z
  .object({
    schemaVersion: z.literal(1),
    uid: z.string().min(1),
    status: AccountDeletionRequestStatusSchema,
    requestedAt: z.number(),
    // requestedAt + graceDays; the scrub worker queries status='pending' AND
    // scheduledScrubAt <= now (composite index, ttt-prod firestore.indexes.json).
    scheduledScrubAt: z.number(),
    graceDays: z.number(), // recorded for the audit/compliance trail (30 at launch)
    cancelledAt: z.number().optional(),
    scrubStartedAt: z.number().optional(),
    // Why a scrub is parked (e.g. 'blocking safety hold over user data') — kept for
    // the GDPR compliance record so a deferred erasure is explainable.
    parkedReason: z.string().optional(),
    parkedAt: z.number().optional(),
    lastHoldCheckAt: z.number().optional(),
    completedAt: z.number().optional(),
    supersededAt: z.number().optional(),
    supersededReason: z.string().optional(),
    createdAt: z.number(),
    updatedAt: z.number(),
  })
  .strict();
export type AccountDeletionRequestV1 = z.infer<typeof AccountDeletionRequestV1Schema>;
