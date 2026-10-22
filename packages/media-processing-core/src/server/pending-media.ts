import type {
  DocumentReference,
  DocumentSnapshot,
  Firestore,
  Transaction,
} from 'firebase-admin/firestore';
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
} from '@ttt-productions/media-schemas';

export interface PendingMediaRowParser<TRow> {
  safeParse(data: unknown): { success: true; data: TRow } | { success: false };
}

export interface ClaimPendingMediaOptions<TRow> {
  schema: PendingMediaRowParser<TRow>;
  policy: PendingMediaClaimPolicy;
  now?: number;
}

export async function claimPendingMediaForProcessing<TRow extends ClaimablePendingMedia>(
  transaction: Transaction,
  pendingMediaRef: DocumentReference,
  options: ClaimPendingMediaOptions<TRow>,
): Promise<PendingMediaClaimOutcome<TRow>> {
  const snap = await transaction.get(pendingMediaRef);
  if (!snap.exists) return { kind: 'missing' };

  const parsed = options.schema.safeParse(snap.data());
  if (!parsed.success) return { kind: 'missing' };

  const { outcome, write } = decidePendingMediaClaim(
    parsed.data,
    options.now ?? Date.now(),
    options.policy,
  );
  // Spread into a literal: the Admin SDK's update() wants an UpdateData-compatible object.
  if (write) transaction.update(pendingMediaRef, { ...write });
  return outcome;
}

export interface PendingMediaFinalizeContext {
  targetStatus: PendingMediaTerminalStatus;
  unparsable: boolean;
}

export type PendingMediaExtraWrites<TExtra> = (
  transaction: Transaction,
  snapshot: DocumentSnapshot,
  context: PendingMediaFinalizeContext,
) => Promise<(() => TExtra) | undefined>;

export interface FinalizePendingMediaOptions<TExtra> {
  extraFields?: Record<string, unknown>;
  extraWrites?: PendingMediaExtraWrites<TExtra>;
  now?: number;
}

export interface PendingMediaFinalizeOutcome<TExtra> extends PendingMediaFinalizeResult {
  extra?: TExtra;
}

/** The caller must not have written on `transaction` yet: a Firestore transaction reads before its first write. */
export async function finalizePendingMediaInTransaction<TExtra = never>(
  transaction: Transaction,
  ref: DocumentReference,
  targetStatus: PendingMediaTerminalStatus,
  options: FinalizePendingMediaOptions<TExtra> = {},
): Promise<PendingMediaFinalizeOutcome<TExtra>> {
  const snap = await transaction.get(ref);
  const result = decidePendingMediaFinalize(
    snap.exists ? (snap.data() ?? {}) : undefined,
    targetStatus,
  );
  if (result.decision !== 'applied') return result;

  const applyExtra = await options.extraWrites?.(transaction, snap, {
    targetStatus,
    unparsable: false,
  });
  transaction.update(
    ref,
    buildPendingMediaTerminalFields(
      targetStatus,
      options.extraFields ?? {},
      options.now ?? Date.now(),
    ),
  );
  return applyExtra ? { ...result, extra: applyExtra() } : result;
}

export function finalizePendingMedia<TExtra = never>(
  db: Firestore,
  ref: DocumentReference,
  targetStatus: PendingMediaTerminalStatus,
  options: FinalizePendingMediaOptions<TExtra> = {},
): Promise<PendingMediaFinalizeOutcome<TExtra>> {
  return db.runTransaction((transaction) =>
    finalizePendingMediaInTransaction(transaction, ref, targetStatus, options),
  );
}

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
    const applyExtra = await options.extraWrites?.(transaction, snap, {
      targetStatus: failed,
      unparsable: true,
    });
    transaction.update(
      ref,
      buildPendingMediaTerminalFields(failed, options.extraFields ?? {}, options.now ?? Date.now()),
    );
    applyExtra?.();
  });
}
