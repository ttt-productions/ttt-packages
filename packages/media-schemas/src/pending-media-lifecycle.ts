// Pending-media lifecycle decisions — PURE (no I/O, no clock of their own).
//
// A pending-media row moves `pending → processing → completed | failed | rejected`
// (the status branches of `createPendingMediaSchemas`). Two decisions govern it, and
// both must be taken over the CURRENT row read inside a transaction:
//
//  - the CLAIM: at-least-once delivery means a processor can be invoked again for a row
//    another attempt already owns, finished, or crashed on (a hard-killed attempt leaves
//    the row stuck at `processing`). A bounded attempt count plus a lease lets a crashed
//    attempt be reclaimed while a live one is never double-dispatched or failed.
//  - the FINALIZE: every terminal writer transitions only from a non-terminal status, so
//    a late writer can never overwrite a terminal state another writer already set.
//
// The consuming app supplies policy (lease length, attempt ceiling) and the clock; the
// Admin-SDK transaction wrappers live in `@ttt-productions/media-processing-core/server`.

import type { z } from "zod";
import { PendingMediaStatusSchema } from "./factories/pending-media.js";

// Every status value below derives from the one declaration, PendingMediaStatusSchema.
const STATUS = PendingMediaStatusSchema.enum;

export type PendingMediaStatus = z.infer<typeof PendingMediaStatusSchema>;
export type PendingMediaNonTerminalStatus = typeof STATUS.pending | typeof STATUS.processing;
export const PENDING_MEDIA_TERMINAL_STATUSES = [STATUS.completed, STATUS.failed, STATUS.rejected] as const;
export type PendingMediaTerminalStatus = (typeof PENDING_MEDIA_TERMINAL_STATUSES)[number];

/** True for `completed` / `failed` / `rejected`; false for anything else, including a missing status. */
export function isPendingMediaTerminalStatus(status: unknown): status is PendingMediaTerminalStatus {
  return (PENDING_MEDIA_TERMINAL_STATUSES as readonly unknown[]).includes(status);
}

/** True for `pending` / `processing` — the only statuses a row may transition from. */
export function isPendingMediaNonTerminalStatus(status: unknown): status is PendingMediaNonTerminalStatus {
  return status === STATUS.pending || status === STATUS.processing;
}

// ---------------------------------------------------------------------------
// Claim
// ---------------------------------------------------------------------------

/** App policy for processing claims. */
export interface PendingMediaClaimPolicy {
  /** How long a processing claim owns the row before a redelivery may reclaim it (ms). */
  leaseMs: number;
  /** Total processing attempts allowed, the first included. */
  maxAttempts: number;
}

/** The lifecycle fields the claim reads — every `createPendingMediaSchemas` row carries them. */
export interface ClaimablePendingMedia {
  status: PendingMediaStatus;
  createdAt: number;
  processingStartedAt?: number;
  processingAttemptCount?: number;
  processingLeaseExpiresAt?: number;
}

/** The exact update written when a row is claimed or reclaimed. */
export interface PendingMediaClaimWrite {
  status: typeof STATUS.processing;
  processingAttemptCount: number;
  processingStartedAt: number;
  processingLeaseExpiresAt: number;
  updatedAt: number;
}

/** A claimable (non-terminal) row with the claim write applied. */
export type ClaimedPendingMedia<TRow extends ClaimablePendingMedia> =
  Extract<TRow, { status: PendingMediaNonTerminalStatus }> extends infer T
    ? T extends unknown
      ? Omit<T, keyof PendingMediaClaimWrite> & PendingMediaClaimWrite
      : never
    : never;

/**
 * - `claimed`   — fresh `pending`, or `processing` under an EXPIRED lease with attempts
 *                 left: the caller applies `write` and dispatches the processor once.
 * - `busy`      — `processing` under a still-ACTIVE lease: a live attempt owns the row.
 *                 No write; the caller asks for redelivery later and must NOT fail the row.
 * - `terminal`  — already terminal: acknowledge, no dispatch.
 * - `exhausted` — expired lease with the attempt ceiling reached: do not reprocess;
 *                 the caller finalizes the row as failed.
 * - `missing`   — no row, or a row that no longer parses (the wrapper decides this).
 */
export type PendingMediaClaimOutcome<TRow extends ClaimablePendingMedia> =
  | { kind: "claimed"; pendingFile: ClaimedPendingMedia<TRow>; attempt: number }
  | { kind: "busy"; leaseExpiresAt: number }
  | { kind: "terminal"; status: PendingMediaTerminalStatus }
  | { kind: "exhausted"; pendingFile: TRow; attempts: number }
  | { kind: "missing" };

export interface PendingMediaClaimDecision<TRow extends ClaimablePendingMedia> {
  outcome: PendingMediaClaimOutcome<TRow>;
  /** Present iff the row is being claimed or reclaimed — the caller applies it as the CAS write. */
  write?: PendingMediaClaimWrite;
}

function buildClaimWrite(attempt: number, now: number, policy: PendingMediaClaimPolicy): PendingMediaClaimWrite {
  return {
    status: STATUS.processing,
    processingAttemptCount: attempt,
    processingStartedAt: now,
    processingLeaseExpiresAt: now + policy.leaseMs,
    updatedAt: now,
  };
}

/**
 * Lease expiry of a `processing` row, tolerating rows written before leases existed:
 * the explicit `processingLeaseExpiresAt`, else `processingStartedAt + leaseMs`, else
 * `createdAt + leaseMs` (a row that never recorded its start).
 */
export function effectivePendingMediaLeaseExpiry(
  current: ClaimablePendingMedia,
  policy: Pick<PendingMediaClaimPolicy, "leaseMs">,
): number {
  if (typeof current.processingLeaseExpiresAt === "number") return current.processingLeaseExpiresAt;
  if (typeof current.processingStartedAt === "number") return current.processingStartedAt + policy.leaseMs;
  return current.createdAt + policy.leaseMs;
}

/** The claim decision over the CURRENT parsed row. */
export function decidePendingMediaClaim<TRow extends ClaimablePendingMedia>(
  current: TRow,
  now: number,
  policy: PendingMediaClaimPolicy,
): PendingMediaClaimDecision<TRow> {
  const claim = (attempt: number): PendingMediaClaimDecision<TRow> => {
    const write = buildClaimWrite(attempt, now, policy);
    const pendingFile = { ...current, ...write } as unknown as ClaimedPendingMedia<TRow>;
    return { outcome: { kind: "claimed", pendingFile, attempt }, write };
  };

  switch (current.status) {
    case STATUS.completed:
    case STATUS.failed:
    case STATUS.rejected:
      return { outcome: { kind: "terminal", status: current.status } };

    case STATUS.pending:
      return claim((current.processingAttemptCount ?? 0) + 1);

    case STATUS.processing: {
      const leaseExpiresAt = effectivePendingMediaLeaseExpiry(current, policy);
      if (leaseExpiresAt > now) return { outcome: { kind: "busy", leaseExpiresAt } };
      // A `processing` row with no attempt count was claimed once before counts existed.
      const attemptsSoFar = current.processingAttemptCount ?? 1;
      if (attemptsSoFar >= policy.maxAttempts) {
        return { outcome: { kind: "exhausted", pendingFile: current, attempts: attemptsSoFar } };
      }
      return claim(attemptsSoFar + 1);
    }
  }
}

// ---------------------------------------------------------------------------
// Finalize
// ---------------------------------------------------------------------------

/**
 * - `applied`  — the row was non-terminal: perform the terminal write.
 * - `noop`     — the row already holds the SAME terminal status (an idempotent replay).
 * - `conflict` — the row already holds a DIFFERENT terminal status: write nothing (the
 *                caller alerts and retires anything produced for the losing write).
 * - `missing`  — no row: write nothing.
 */
export type PendingMediaFinalizeDecision = "applied" | "noop" | "conflict" | "missing";

export interface PendingMediaFinalizeResult {
  decision: PendingMediaFinalizeDecision;
  /** The status on the row for a `noop` / `conflict` decision. */
  currentStatus?: string;
}

/**
 * The allowed-transition table over the CURRENT row (`undefined` = no row). Only a
 * `pending` / `processing` row may transition.
 */
export function decidePendingMediaFinalize(
  current: { status?: unknown } | undefined,
  targetStatus: PendingMediaTerminalStatus,
): PendingMediaFinalizeResult {
  if (current === undefined) return { decision: "missing" };
  const status = current.status;
  if (isPendingMediaNonTerminalStatus(status)) return { decision: "applied" };
  if (status === targetStatus) return { decision: "noop", currentStatus: targetStatus };
  return { decision: "conflict", currentStatus: status === undefined ? undefined : String(status) };
}

// The literal terminal field set each status writes. Plain object types rather than
// interfaces: an interface is not assignable to an index-signature type (a Firestore
// update's data, `Record<string, unknown>`), and a plain object type reads statically
// from the shipped declarations, key by key.

/** The terminal field set a `completed` transition writes. */
export type PendingMediaCompletedTerminalFields = {
  status: typeof STATUS.completed;
  completedAt: number;
  terminalAt: number;
  updatedAt: number;
};

/** The terminal field set a `failed` transition writes. */
export type PendingMediaFailedTerminalFields = {
  status: typeof STATUS.failed;
  failedAt: number;
  terminalAt: number;
  updatedAt: number;
};

/** The terminal field set a `rejected` transition writes. */
export type PendingMediaRejectedTerminalFields = {
  status: typeof STATUS.rejected;
  rejectedAt: number;
  terminalAt: number;
  updatedAt: number;
};

/** The terminal field set for `S`; a union of statuses gives the union of their sets. */
export type PendingMediaTerminalFields<S extends PendingMediaTerminalStatus = PendingMediaTerminalStatus> =
  S extends typeof STATUS.completed
    ? PendingMediaCompletedTerminalFields
    : S extends typeof STATUS.failed
      ? PendingMediaFailedTerminalFields
      : PendingMediaRejectedTerminalFields;

/**
 * The terminal field set for a status — the status, its `completedAt` / `failedAt` /
 * `rejectedAt`, `terminalAt`, and `updatedAt`, all at `now` — merged with the caller's
 * fields (`result`, `errorCategory`, `errorMessage`, `rejectionType`, …).
 *
 * With no extra fields (`{}`) and one known status, the declared result is exactly that
 * status's literal field set — the first three signatures, one per status. With extra
 * fields it is that set intersected with them. Extra fields are merged after `status`,
 * `terminalAt`, and `updatedAt` and before the status's own `*At` stamp.
 */
export function buildPendingMediaTerminalFields(
  status: typeof STATUS.completed,
  extraFields: Record<string, never>,
  now: number,
): PendingMediaCompletedTerminalFields;
export function buildPendingMediaTerminalFields(
  status: typeof STATUS.failed,
  extraFields: Record<string, never>,
  now: number,
): PendingMediaFailedTerminalFields;
export function buildPendingMediaTerminalFields(
  status: typeof STATUS.rejected,
  extraFields: Record<string, never>,
  now: number,
): PendingMediaRejectedTerminalFields;
export function buildPendingMediaTerminalFields<S extends PendingMediaTerminalStatus, E extends Record<string, unknown>>(
  status: S,
  extraFields: E,
  now: number,
): PendingMediaTerminalFields<S> & E;
export function buildPendingMediaTerminalFields(
  status: PendingMediaTerminalStatus,
  extraFields: Record<string, unknown>,
  now: number,
): PendingMediaTerminalFields & Record<string, unknown> {
  switch (status) {
    case STATUS.completed:
      return { status, terminalAt: now, updatedAt: now, ...extraFields, completedAt: now };
    case STATUS.failed:
      return { status, terminalAt: now, updatedAt: now, ...extraFields, failedAt: now };
    case STATUS.rejected:
      return { status, terminalAt: now, updatedAt: now, ...extraFields, rejectedAt: now };
  }
}
