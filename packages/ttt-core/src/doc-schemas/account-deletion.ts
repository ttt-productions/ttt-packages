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
//
// [C-02] Erasure-vs-safety-hold race fence. The destructive scrub and a safety
// hold landing mid-scrub race over the SAME account. The fence is an epoch LEASE
// stamped on THIS doc (`erasureLease`): the scrub transactionally acquires the
// lease ONLY when the account owns no active blocking hold; every destructive
// write re-checks the SAME epoch in its own transaction; and `commitSafetyHold`
// (the SINGLE shared hold authority) reads this doc's live lease and PARKS the
// erasure (revoking the epoch) before committing a hold against a leased account.
// A revoked epoch makes every still-running destructive step a no-op. The lease
// lives HERE — not a parallel safety-only deletion subsystem — so the one shared
// hold/destructive contract owns the fence (engineering-rules ARCH-001).

import { z } from 'zod';

/** Lifecycle of an account-deletion request. */
export const AccountDeletionRequestStatusSchema = z.enum([
  'pending', // grace window running; user can still cancel by logging in
  'cancelled', // user cancelled (logged back in) before the window elapsed
  'scrubbing', // the scrub worker has started the anonymize-in-place erasure
  // [C-02] the scrub holds an ACTIVE erasure lease and is mid-destruction. A hold
  // landing now revokes the lease (→ parkedOnHold) so the scrub aborts deterministically.
  'leased',
  'parkedOnHold', // erasure deferred — a blocking safety hold covers the user's data
  'completed', // erasure finished
  'superseded', // overridden by a ban-for-cause / evidence-preservation outcome
]);
export type AccountDeletionRequestStatus = z.infer<typeof AccountDeletionRequestStatusSchema>;

/**
 * [C-02] The erasure LEASE / epoch token — the race fence between the destructive
 * scrub and a mid-scrub safety hold.
 *
 * The scrub acquires this transactionally ONLY when the account owns no active
 * blocking hold; it then re-verifies the SAME `epoch` inside every destructive
 * Firestore transaction and immediately before AND after each non-transactional
 * external delete (Auth/Storage). `commitSafetyHold` reads this lease and, when it
 * is `active`, REVOKES it (sets `revokedByHold`/`revokedAt`, status → `parkedOnHold`)
 * in the SAME transaction that commits the hold — so a hold deterministically wins
 * the race and the scrub, finding its epoch revoked on the next check, aborts into
 * a recoverable parked state without finishing the destruction.
 */
export const ErasureLeaseV1Schema = z
  .object({
    /** Monotonic acquisition token. The "live lease" identity: every destructive step
     *  re-reads the doc and proceeds ONLY if this still equals the epoch it acquired. */
    epoch: z.number().int().nonnegative(),
    /** 'active' = the scrub holds the lease; 'revoked' = a hold reclaimed it mid-scrub
     *  (the scrub must abort); 'released' = the scrub finished/relinquished cleanly. */
    state: z.enum(['active', 'revoked', 'released']),
    acquiredAt: z.number(),
    /** Staleness boundary. A still-`active` lease past this is presumed crashed and may
     *  be safely superseded by a fresh acquisition (idempotent retry / crash recovery). */
    expiresAt: z.number(),
    /** Last destructive phase the scrub reached under this epoch (observability + recovery). */
    phase: z.string().optional(),
    /** Set when a hold revoked the lease — the caseId/refId of the winning hold (audit trail). */
    revokedByHoldRefId: z.string().min(1).optional(),
    revokedAt: z.number().optional(),
    releasedAt: z.number().optional(),
  })
  .strict();
export type ErasureLeaseV1 = z.infer<typeof ErasureLeaseV1Schema>;

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
    // [C-02] the erasure-vs-hold race fence (see ErasureLeaseV1). Absent until the
    // scrub first acquires the lease; thereafter it carries the live epoch + state.
    erasureLease: ErasureLeaseV1Schema.optional(),
    createdAt: z.number(),
    updatedAt: z.number(),
  })
  .strict();
export type AccountDeletionRequestV1 = z.infer<typeof AccountDeletionRequestV1Schema>;
