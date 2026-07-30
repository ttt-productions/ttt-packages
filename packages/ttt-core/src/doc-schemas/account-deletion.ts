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
 * ACTIVE = the request is still OPEN and still cancellable. This is the one predicate the
 * lifecycle's enforcement points share — `requestAccountDeletion`'s idempotent re-return of the
 * existing schedule, `cancelAccountDeletion`'s cancel gate, the scrub worker's due-request query,
 * and the client's live own-request read — each of which previously restated
 * `status === 'pending' || status === 'parkedOnHold'` locally (ARCH-102).
 *
 * Declared as an EXHAUSTIVE Record over the status union, not as a subset array: a subset array
 * only catches a REMOVED member, whereas adding a lifecycle status must be a compile error here
 * until that status is classified. A new status silently defaulting to "not active" is exactly the
 * drift this classification exists to prevent.
 *
 * `scrubbing` / `leased` are deliberately NOT active — the destructive erasure has already begun,
 * so there is no schedule left to re-offer and nothing left to cancel. `cancelled` / `completed` /
 * `superseded` are terminal.
 */
const DELETION_REQUEST_STATUS_IS_ACTIVE = {
  pending: true,
  cancelled: false,
  scrubbing: false,
  leased: false,
  parkedOnHold: true,
  completed: false,
  superseded: false,
} as const satisfies Record<AccountDeletionRequestStatus, boolean>;

/** The statuses classified ACTIVE above, as a literal union — derived, never restated. */
export type ActiveDeletionRequestStatus = {
  [K in AccountDeletionRequestStatus]: (typeof DELETION_REQUEST_STATUS_IS_ACTIVE)[K] extends true ? K : never;
}[AccountDeletionRequestStatus];

/** The ACTIVE (open, still-cancellable) deletion-request statuses, projected from the
 *  classification above in union-declaration order — so it can also feed a Firestore
 *  `where('status', 'in', ACTIVE_DELETION_REQUEST_STATUSES)` query directly. */
export const ACTIVE_DELETION_REQUEST_STATUSES: readonly ActiveDeletionRequestStatus[] = (
  Object.keys(DELETION_REQUEST_STATUS_IS_ACTIVE) as AccountDeletionRequestStatus[]
).filter((status): status is ActiveDeletionRequestStatus => DELETION_REQUEST_STATUS_IS_ACTIVE[status]);

/** True for an ACTIVE (open, still-cancellable) deletion request. Takes `unknown` because every
 *  caller reads the status off an unvalidated Firestore doc: anything outside the canonical active
 *  set — a terminal/mid-scrub status, an unrecognized value, a missing field — is false. */
export function isActiveDeletionRequest(status: unknown): status is ActiveDeletionRequestStatus {
  return typeof status === 'string' && (ACTIVE_DELETION_REQUEST_STATUSES as readonly string[]).includes(status);
}

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
    // Token-revocation obligation — the request doc IS the durable ledger (BACKEND-302 /
    // QUALITY-104); no separate queue, worker collection, or dead-letter state exists.
    //
    // `tokenRevocationNextAttemptAt` is the DRAIN KEY: present ⇔ the revocation is still
    // OWED. Set to `now` when the request is created; the scheduled worker's revocation
    // drain queries `tokenRevocationNextAttemptAt <= now` (single-field range — deliberately
    // no status clause and no composite index; every terminal transition clears the field,
    // and the drain clears it on any non-active doc it meets, so "owed" means exactly
    // "field present"). A failed attempt moves it forward (bounded backoff); a successful
    // revoke DELETES it and stamps `tokensRevokedAt` in the same fenced update.
    //
    // The stamp is GENERATION-FENCED on `requestedAt`: the revoker snapshots `requestedAt`
    // before calling Auth and stamps transactionally only if the doc still carries that
    // value with an active status — a delayed revoke from a cancelled request must never
    // mark a newly reopened request satisfied. Revocation is idempotent, so a skipped or
    // lost stamp merely causes one redundant re-revoke.
    tokenRevocationNextAttemptAt: z.number().optional(),
    // When the user's refresh tokens were revoked for THIS request ("account deletion signs
    // the user out of every session everywhere"). The callable's immediate revoke is only
    // the accelerator (BACKEND-301); the worker drain above is the guarantee.
    tokensRevokedAt: z.number().optional(),
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
