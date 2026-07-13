import type {
  ServerFirestore,
  ServerReportCoreConfig,
  AdminAuthConfig,
  OnAuditEvent,
} from './types.js';

export interface CheckoutNextImportantHandlerConfig {
  config: ServerReportCoreConfig;
  db: ServerFirestore;
  auth: AdminAuthConfig;
  onAuditEvent?: OnAuditEvent;
  logger?: { info: (...args: unknown[]) => void; error: (...args: unknown[]) => void };
}

/**
 * Query→claim rounds attempted before reporting contention. Candidate discovery runs
 * OUTSIDE the transaction: a range query inside it takes a range lock over the whole
 * pending queue, so every concurrent status flip (any checkout or release) becomes a
 * transaction conflict and all admin queue mutations serialize. Each round re-queries,
 * then claims the specific candidate doc with an in-transaction status re-check —
 * doc-level conflicts only.
 */
const MAX_CLAIM_ROUNDS = 5;

/**
 * Factory that returns the handler for checkoutNextImportantTask.
 * Finds the single highest-priority pending task across ALL queues
 * and checks it out to the current admin.
 */
export function createCheckoutNextImportantHandler({
  config,
  db,
  auth,
  onAuditEvent,
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
    throw new Error('Administrator access required');
  };

  return async (
    _data: unknown,
    authContext: { uid: string; token: unknown },
  ): Promise<Record<string, unknown>> => {
    const userId = authContext.uid;
    await verifyAdmin(userId, authContext.token);

    for (let round = 0; round < MAX_CLAIM_ROUNDS; round++) {
      // Candidate discovery — OUTSIDE the transaction (see MAX_CLAIM_ROUNDS).
      const snapshot = await db
        .collection(config.collections.adminTasks)
        .where('status', '==', 'pending')
        .orderBy('priority', 'desc')
        .orderBy('createdAt', 'asc')
        .limit(1)
        .get();

      if (snapshot.empty) {
        throw new Error('No pending tasks available! All caught up! 🎉');
      }

      const candidateRef = snapshot.docs[0].ref;

      const result = await db.runTransaction(async (transaction) => {
        const now = Date.now();

        // ── READS (all reads must happen before any writes in a Firestore transaction) ──
        // Re-read the SPECIFIC candidate doc and re-check its status: if another admin
        // claimed it between the query and this transaction, back off to the next round.
        const taskDoc = await transaction.get(candidateRef);
        if (!taskDoc.exists) return null;
        const taskData = taskDoc.data()!;
        if (taskData.status !== 'pending') return null;

        // Fetch original document (READ — must happen before writes)
        const originalDocRef = db.doc(taskData.originalPath as string);
        const originalDoc = await transaction.get(originalDocRef);

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
        };
      });

      if (result) return result;
    }

    throw new Error('The task queue is busy right now — please try again.');
  };
}
