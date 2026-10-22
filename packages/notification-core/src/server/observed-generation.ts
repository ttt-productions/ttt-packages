import type { ServerFirestore, ServerDocRef, ServerTransaction } from './types.js';

export type MarkSeenOutcome = 'seen' | 'generation-mismatch' | 'missing';

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

export type ArchiveOutcome =
  'archived' | 'replayed' | 'conflict' | 'generation-mismatch' | 'missing';

export async function archiveNotificationWithGeneration(
  db: ServerFirestore,
  params: {
    activeRef: ServerDocRef;
    historyRef: ServerDocRef;
    requestId: string;
    observedActivityGeneration: string;
    payloadHash: string;
    category: string;
    audienceScope: string;
    expireAtMs: number;
    timestampFromMillis: (ms: number) => unknown;
    handledBy?: string;
    /** Runs in the write phase, so it must not read (Firestore reads-before-writes). */
    auditWrite?: (txn: ServerTransaction) => void | Promise<void>;
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
    // Firestore transactions take every read before any write.
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
    await auditWrite?.(tx);
    return 'archived';
  });
}
