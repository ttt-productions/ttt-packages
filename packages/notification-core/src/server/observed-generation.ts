/**
 * Observed-generation seen/archive protocol (notification redesign — P1).
 *
 * The SEEN/ARCHIVE precondition compares the card's current opaque
 * `activityGeneration` against the generation the client actually observed when
 * it rendered the row — so activity arriving after render (or a delete+recreate
 * that rotated the token) is never silently swallowed. Archive additionally
 * carries a retry-stable `requestId`; the deterministic history doc id makes a
 * replay return the stored result and touch nothing.
 *
 * GENERIC: the app constructs the deterministic ids (`historyRef`, `payloadHash`)
 * via its own canonical hash (in the consuming app's core package) and passes the
 * refs in; this module owns only the transactional state machine, not the id formulas.
 */

import type { ServerFirestore, ServerDocRef, ServerTransaction } from './types.js';

export type MarkSeenOutcome = 'seen' | 'generation-mismatch' | 'missing';

/**
 * Set `seenAt`/`seenAtGeneration` ONLY if the card's current `activityGeneration`
 * still matches the observed one; otherwise no-op (the row stays unseen so newer
 * activity is never swallowed).
 */
export async function markNotificationSeenWithGeneration(
  db: ServerFirestore,
  activeRef: ServerDocRef,
  params: { observedActivityGeneration: string; now?: number },
): Promise<MarkSeenOutcome> {
  return db.runTransaction(async (tx) => {
    const snap = await tx.get(activeRef);
    if (!snap.exists) return 'missing';
    const data = (snap.data() ?? {}) as Record<string, unknown>;
    if ((data.activityGeneration as string | undefined) !== params.observedActivityGeneration) {
      return 'generation-mismatch';
    }
    tx.update(activeRef, {
      seenAt: params.now ?? Date.now(),
      seenAtGeneration: params.observedActivityGeneration,
    });
    return 'seen';
  });
}

export type ArchiveOutcome = 'archived' | 'replayed' | 'conflict' | 'generation-mismatch' | 'missing';

/**
 * Archive one active card into history, idempotently and replay-safely.
 *
 * - history doc already exists + same `payloadHash` ⇒ `replayed` (touch NOTHING).
 * - history doc already exists + DIFFERENT `payloadHash` ⇒ `conflict` (caller alerts).
 * - first-seen: archive only if the active card's `activityGeneration` still
 *   matches the observed generation; else `generation-mismatch` (leave it active).
 */
export async function archiveNotificationWithGeneration(
  db: ServerFirestore,
  params: {
    activeRef: ServerDocRef;
    /** Deterministic history doc id = hash('notification-archive', category, audienceScope, requestId) (app-built). */
    historyRef: ServerDocRef;
    requestId: string;
    observedActivityGeneration: string;
    /** Deterministic payload hash (app-built) — the replay-vs-conflict discriminator. */
    payloadHash: string;
    category: string;
    audienceScope: string;
    /** Native-TTL expiry for the history doc; converted to a Timestamp via the factory. */
    expireAtMs: number;
    timestampFromMillis: (ms: number) => unknown;
    /** Admin history quick-access field (admin category only). */
    handledBy?: string;
    /**
     * Optional hook to compose additional writes (e.g. an audit event) INTO the
     * same archive transaction, so they commit atomically with the active→history
     * move. Invoked in the write phase ONLY on the successful 'archived' path —
     * never on replay/conflict/generation-mismatch/missing — so the audit is
     * written iff the archive actually happens. Honor reads-before-writes: do not
     * read inside the hook.
     */
    auditWrite?: (txn: ServerTransaction) => void;
  },
): Promise<ArchiveOutcome> {
  const {
    activeRef,
    historyRef,
    requestId,
    observedActivityGeneration,
    payloadHash,
    category,
    audienceScope,
    expireAtMs,
    timestampFromMillis,
    handledBy,
    auditWrite,
  } = params;

  return db.runTransaction(async (tx) => {
    // Reads first (Firestore reads-before-writes).
    const historySnap = await tx.get(historyRef);
    if (historySnap.exists) {
      const existing = (historySnap.data() ?? {}) as Record<string, unknown>;
      return (existing.payloadHash as string | undefined) === payloadHash ? 'replayed' : 'conflict';
    }
    const activeSnap = await tx.get(activeRef);
    if (!activeSnap.exists) return 'missing';
    const activeData = (activeSnap.data() ?? {}) as Record<string, unknown>;
    if ((activeData.activityGeneration as string | undefined) !== observedActivityGeneration) {
      return 'generation-mismatch';
    }

    const now = Date.now();
    const historyDoc: Record<string, unknown> = {
      archiveOccurrenceId: historyRef.id,
      requestId,
      payloadHash,
      activeId: activeRef.id,
      observedActivityGeneration,
      category,
      audienceScope,
      archivedSnapshot: activeData,
      archivedAt: now,
      expireAt: timestampFromMillis(expireAtMs),
    };
    if (handledBy !== undefined) historyDoc.handledBy = handledBy;

    tx.set(historyRef, historyDoc);
    tx.delete(activeRef);
    // Compose any caller-supplied write (e.g. an audit event) into THIS
    // transaction so it commits atomically with the archive. Only reached on the
    // successful path, after all reads, so reads-before-writes is preserved.
    auditWrite?.(tx);
    return 'archived';
  });
}
