/**
 * Mark-seen helper — used by the app's `markNotificationsSeen` callable.
 * Batches `seenAt = now` writes for a set of active notification doc refs.
 */

import type { ServerFirestore, ServerDocRef } from './types.js';

/** Firestore hard limit on writes per batch. */
const MAX_BATCH_WRITES = 500;

/**
 * Stamp `seenAt` on a set of active notification doc refs, writing in
 * ≤500-write chunks per commit (the Firestore batch limit).
 *
 * Generic — no domain knowledge. The consuming app's callable supplies the
 * ownership-filtered set of refs (personal `targetUserId == uid`); this helper
 * just stamps them. It does not archive and writes no audit event.
 */
export async function markSeenHelper(
  db: ServerFirestore,
  docRefs: ServerDocRef[],
  seenAt: number,
): Promise<{ updated: number }> {
  if (docRefs.length === 0) {
    return { updated: 0 };
  }

  for (let i = 0; i < docRefs.length; i += MAX_BATCH_WRITES) {
    const chunk = docRefs.slice(i, i + MAX_BATCH_WRITES);
    const batch = db.batch();
    for (const ref of chunk) {
      batch.update(ref, { seenAt });
    }
    await batch.commit();
  }

  return { updated: docRefs.length };
}
