// Admin-SDK transaction wrappers for the pending-media lifecycle. The decisions are the
// pure ones in `@ttt-productions/media-schemas` (`decidePendingMediaClaim`,
// `decidePendingMediaFinalize`); these read the CURRENT row inside a transaction,
// decide, and write. Everything app-specific is injected: the row's `DocumentReference`
// (so no collection name lives here), the row schema, the claim policy, the extra
// writes a terminal transition carries, and the clock.

import type { DocumentReference, DocumentSnapshot, Firestore, Transaction } from "firebase-admin/firestore";
import {
  buildPendingMediaTerminalFields,
  decidePendingMediaClaim,
  decidePendingMediaFinalize,
  isPendingMediaNonTerminalStatus,
  PendingMediaStatusSchema,
  type ClaimablePendingMedia,
  type PendingMediaClaimOutcome,
  type PendingMediaClaimPolicy,
  type PendingMediaFinalizeResult,
  type PendingMediaTerminalStatus,
} from "@ttt-productions/media-schemas";

// ---------------------------------------------------------------------------
// Claim
// ---------------------------------------------------------------------------

/** The app's pending-media row schema — anything with zod's `safeParse` shape. */
export interface PendingMediaRowParser<TRow> {
  safeParse(data: unknown): { success: true; data: TRow } | { success: false };
}

export interface ClaimPendingMediaOptions<TRow> {
  schema: PendingMediaRowParser<TRow>;
  policy: PendingMediaClaimPolicy;
  /** Epoch ms; defaults to `Date.now()`. */
  now?: number;
}

/**
 * Claim a row for processing inside `transaction`, driven by the CURRENT row (never a
 * frozen event snapshot). Reads before any write. A row that no longer parses is
 * `missing` and never dispatched: a corrupt row must not drive the processor.
 */
export async function claimPendingMediaForProcessing<TRow extends ClaimablePendingMedia>(
  transaction: Transaction,
  pendingMediaRef: DocumentReference,
  options: ClaimPendingMediaOptions<TRow>,
): Promise<PendingMediaClaimOutcome<TRow>> {
  const snap = await transaction.get(pendingMediaRef);
  if (!snap.exists) return { kind: "missing" };

  const parsed = options.schema.safeParse(snap.data());
  if (!parsed.success) return { kind: "missing" };

  const { outcome, write } = decidePendingMediaClaim(parsed.data, options.now ?? Date.now(), options.policy);
  // Spread into a literal: the Admin SDK's update() wants an UpdateData-compatible object.
  if (write) transaction.update(pendingMediaRef, { ...write });
  return outcome;
}

// ---------------------------------------------------------------------------
// Finalize
// ---------------------------------------------------------------------------

export interface PendingMediaFinalizeContext {
  targetStatus: PendingMediaTerminalStatus;
  /** True when the row failed schema validation and is being failed as unparsable. */
  unparsable: boolean;
}

/**
 * Caller-owned writes that must commit atomically with a terminal transition, and only
 * when it applies (releasing a quota reservation, for example — exactly once, because
 * the compare-and-set gates it). It runs in the transaction's READ phase and may
 * `transaction.get`; it returns the WRITE-phase step, or undefined when there is nothing
 * to write. The step runs after the terminal write, and its return value is surfaced as
 * the outcome's `extra`.
 */
export type PendingMediaExtraWrites<TExtra> = (
  transaction: Transaction,
  snapshot: DocumentSnapshot,
  context: PendingMediaFinalizeContext,
) => Promise<(() => TExtra) | undefined>;

export interface FinalizePendingMediaOptions<TExtra> {
  /** Merged into the terminal fields (`result`, `errorCategory`, `errorMessage`, …). */
  extraFields?: Record<string, unknown>;
  extraWrites?: PendingMediaExtraWrites<TExtra>;
  /** Epoch ms; defaults to `Date.now()`. */
  now?: number;
}

export interface PendingMediaFinalizeOutcome<TExtra> extends PendingMediaFinalizeResult {
  /** What the extra writes returned — present only on `applied`, when they wrote. */
  extra?: TExtra;
}

/**
 * Compare-and-set finalize inside the caller's transaction: re-read the row, decide,
 * and write the terminal fields (plus any extra writes) only on `applied`. An
 * already-terminal row is never overwritten. Reads-before-writes holds as long as the
 * caller has issued no write on `transaction` yet.
 */
export async function finalizePendingMediaInTransaction<TExtra = never>(
  transaction: Transaction,
  ref: DocumentReference,
  targetStatus: PendingMediaTerminalStatus,
  options: FinalizePendingMediaOptions<TExtra> = {},
): Promise<PendingMediaFinalizeOutcome<TExtra>> {
  const snap = await transaction.get(ref);
  const result = decidePendingMediaFinalize(snap.exists ? (snap.data() ?? {}) : undefined, targetStatus);
  if (result.decision !== "applied") return result;

  const applyExtra = await options.extraWrites?.(transaction, snap, { targetStatus, unparsable: false });
  transaction.update(
    ref,
    buildPendingMediaTerminalFields(targetStatus, options.extraFields ?? {}, options.now ?? Date.now()),
  );
  return applyExtra ? { ...result, extra: applyExtra() } : result;
}

/** Standalone compare-and-set finalize, in its own transaction. */
export function finalizePendingMedia<TExtra = never>(
  db: Firestore,
  ref: DocumentReference,
  targetStatus: PendingMediaTerminalStatus,
  options: FinalizePendingMediaOptions<TExtra> = {},
): Promise<PendingMediaFinalizeOutcome<TExtra>> {
  return db.runTransaction((transaction) => finalizePendingMediaInTransaction(transaction, ref, targetStatus, options));
}

/**
 * Fail a row that no longer passes schema validation, so the transition table cannot
 * be applied (it may carry no readable `status`). One transaction: the row is failed —
 * with any extra writes — only while it has no status or a `pending` / `processing`
 * one, so an already-terminal row is never touched and extra writes run exactly once.
 */
export async function finalizeUnparsablePendingMedia<TExtra = never>(
  db: Firestore,
  ref: DocumentReference,
  options: FinalizePendingMediaOptions<TExtra> = {},
): Promise<void> {
  await db.runTransaction(async (transaction) => {
    const snap = await transaction.get(ref);
    if (!snap.exists) return;
    const status = (snap.data() as { status?: unknown } | undefined)?.status;
    if (status !== undefined && !isPendingMediaNonTerminalStatus(status)) return;

    const failed = PendingMediaStatusSchema.enum.failed;
    const applyExtra = await options.extraWrites?.(transaction, snap, { targetStatus: failed, unparsable: true });
    transaction.update(ref, buildPendingMediaTerminalFields(failed, options.extraFields ?? {}, options.now ?? Date.now()));
    applyExtra?.();
  });
}
