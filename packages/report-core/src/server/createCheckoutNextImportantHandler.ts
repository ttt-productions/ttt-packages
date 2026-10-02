import type {
  ServerFirestore,
  ServerReportCoreConfig,
  AdminAuthConfig,
  OnAuditEvent,
  TaskClaimGuard,
} from './types.js';
import { ReportCoreTaskError } from './taskError.js';
import { createCandidateCursor } from './claimCandidates.js';

export interface CheckoutNextImportantHandlerConfig {
  config: ServerReportCoreConfig;
  db: ServerFirestore;
  auth: AdminAuthConfig;
  onAuditEvent?: OnAuditEvent;
  /** The app's in-transaction check that a task may be claimed now (see `TaskClaimGuard`). */
  assertTaskClaimable?: TaskClaimGuard;
  logger?: { info: (...args: unknown[]) => void; error: (...args: unknown[]) => void };
}

type ClaimOutcome =
  | { kind: 'claimed'; result: Record<string, unknown> }
  | { kind: 'contended' }
  | { kind: 'refused' };

/**
 * Query→claim rounds attempted before reporting contention. Candidate discovery runs
 * OUTSIDE the transaction: a range query inside it takes a range lock over the whole
 * pending queue, so every concurrent status flip (any checkout or release) becomes a
 * transaction conflict and all admin queue mutations serialize. Each round re-queries,
 * then claims the specific candidate doc with an in-transaction status re-check —
 * doc-level conflicts only. A candidate the claim guard refuses does not use a round: the
 * queue's cursor moves past it, so each refusal costs one one-document read.
 */
const MAX_CLAIM_ROUNDS = 5;

/**
 * Factory that returns the handler for checkoutNextImportantTask.
 * Finds the single highest-priority pending task across ALL queues that the app's claim
 * guard (asked inside the claim transaction) does not refuse, and checks it out to the
 * current admin.
 */
export function createCheckoutNextImportantHandler({
  config,
  db,
  auth,
  onAuditEvent,
  assertTaskClaimable,
}: CheckoutNextImportantHandlerConfig) {
  const verifyAdmin = async (uid: string, authToken: unknown): Promise<void> => {
    if (auth.requireAdmin) {
      try {
        await auth.requireAdmin(uid, authToken);
        return;
      } catch {
        // Fall through
      }
    }
    if (auth.adminUserIds?.includes(uid)) return;
    throw new ReportCoreTaskError('permission-denied', 'Administrator access required');
  };

  return async (
    _data: unknown,
    authContext: { uid: string; token: unknown },
  ): Promise<Record<string, unknown>> => {
    const userId = authContext.uid;
    await verifyAdmin(userId, authContext.token);

    // Candidate discovery — OUTSIDE the transaction (see MAX_CLAIM_ROUNDS).
    const pending = createCandidateCursor(() =>
      db
        .collection(config.collections.adminTasks)
        .where('status', '==', 'pending')
        .orderBy('priority', 'desc')
        .orderBy('createdAt', 'asc'),
    );

    let contendedRounds = 0;
    while (contendedRounds < MAX_CLAIM_ROUNDS) {
      const candidate = await pending.next();
      if (!candidate) {
        throw new ReportCoreTaskError('not-found', 'No pending tasks available! All caught up! 🎉');
      }
      const candidateRef = candidate.ref;

      const claim = await db.runTransaction(async (transaction): Promise<ClaimOutcome> => {
        const now = Date.now();

        // ── READS (all reads must happen before any writes in a Firestore transaction) ──
        // Re-read the SPECIFIC candidate doc and re-check its status: if another admin
        // claimed it between the query and this transaction, back off to the next round.
        const taskDoc = await transaction.get(candidateRef);
        if (!taskDoc.exists) return { kind: 'contended' };
        const taskData = taskDoc.data()!;
        if (taskData.status !== 'pending') return { kind: 'contended' };

        // Fetch original document (READ — must happen before writes)
        const originalDocRef = db.doc(taskData.originalPath as string);
        const originalDoc = await transaction.get(originalDocRef);

        // The app's claim guard: the last of the reads, before the first write.
        if (assertTaskClaimable) {
          const verdict = await assertTaskClaimable({
            taskDocId: taskDoc.id,
            taskData,
            originalData: originalDoc.exists ? originalDoc.data() ?? null : null,
            transaction,
          });
          if (!verdict.claimable) return { kind: 'refused' };
        }

        // ── COMPUTE ──
        const taskType = taskData.taskType as string;
        const queueConfig = config.taskQueues[taskType];
        const checkoutMinutes = queueConfig?.defaultCheckoutMinutes ?? 60;
        const expiresAt = now + checkoutMinutes * 60 * 1000;

        const checkoutDetails = {
          userId,
          checkedOutAt: now,
          expiresAt,
          workLaterUntil: null,
        };

        // ── WRITES (no more reads after this point) ──
        transaction.update(candidateRef, {
          status: 'checkedOut',
          checkoutDetails,
        });

        if (onAuditEvent) {
          await onAuditEvent(
            {
              action: 'checkout_next_important',
              adminUserId: userId,
              taskType,
              taskId: taskData.taskId as string,
              priority: taskData.priority as number,
              timestamp: now,
            },
            transaction,
          );
        }

        return {
          kind: 'claimed',
          result: {
            success: true,
            task: {
              id: taskDoc.id,
              taskType,
              taskId: taskData.taskId,
              originalPath: taskData.originalPath,
              summary: taskData.summary,
              priority: taskData.priority,
              checkedOutAt: now,
              expiresAt,
              status: 'checkedOut',
              checkoutDetails,
              itemData: originalDoc.exists ? originalDoc.data() : null,
            },
          },
        };
      });

      if (claim.kind === 'claimed') return claim.result;
      if (claim.kind === 'refused') pending.skip(candidate);
      else contendedRounds++;
    }

    throw new ReportCoreTaskError('aborted', 'The task queue is busy right now — please try again.');
  };
}
