import type {
  ServerFirestore,
  ServerReportCoreConfig,
  AdminAuthConfig,
  OnAuditEvent,
  ServerDocRef,
} from './types.js';
import { ReportCoreTaskError } from './taskError.js';
import type { CheckoutTaskRequest } from '../schemas/index.js';

export interface CheckoutTaskHandlerConfig {
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
 * Factory that returns the handler for the checkoutTask callable function.
 *
 * Behavior:
 * 1. Verifies admin auth (requireAdmin function or adminUserIds fallback)
 * 2. If specificTaskId provided, checks out that task
 * 3. Otherwise finds the highest-priority pending task of the given type
 * 4. Falls back to expired checked-out tasks
 * 5. Sets checkout details with expiration
 * 6. Logs activity
 *
 * @returns An async handler: (data, authContext) => Promise<result>
 */
export function createCheckoutTaskHandler({
  config,
  db,
  auth,
  onAuditEvent,
}: CheckoutTaskHandlerConfig) {
  const verifyAdmin = async (uid: string, authToken: unknown): Promise<void> => {
    // Try requireAdmin first
    if (auth.requireAdmin) {
      try {
        await auth.requireAdmin(uid, authToken);
        return;
      } catch {
        // Fall through to adminUserIds check
      }
    }

    // Fallback to hardcoded list
    if (auth.adminUserIds?.includes(uid)) return;

    throw new ReportCoreTaskError('permission-denied', 'Administrator access required');
  };

  return async (
    data: CheckoutTaskRequest,
    authContext: { uid: string; token: unknown },
  ): Promise<Record<string, unknown>> => {
    const { taskType, specificTaskId } = data;
    const userId = authContext.uid;

    await verifyAdmin(userId, authContext.token);

    const queueConfig = config.taskQueues[taskType];
    if (!queueConfig) {
      throw new ReportCoreTaskError('invalid-argument', 'Invalid task type specified.');
    }

    /**
     * Claim ONE specific task doc in a doc-level transaction, re-checking its status
     * inside the transaction. `onConflict: 'throw'` (the specificTaskId path) surfaces
     * the precise rejection to the caller; `onConflict: 'skip'` (the queue path)
     * returns null so the caller re-queries for the next candidate.
     */
    const claimTask = (
      taskRef: ServerDocRef,
      opts: { onConflict: 'throw' | 'skip' },
    ): Promise<Record<string, unknown> | null> =>
      db.runTransaction(async (transaction) => {
        const now = Date.now();

        // ── READS (all reads must happen before any writes in a Firestore transaction) ──
        const taskDoc = await transaction.get(taskRef);

        if (!taskDoc.exists) {
          if (opts.onConflict === 'skip') return null;
          throw new ReportCoreTaskError('not-found', 'The requested task could not be found.');
        }

        const taskData = taskDoc.data()!;
        // Status guard: only a `pending` task, or a `checkedOut`/`workLater` task whose
        // lock has EXPIRED (the legitimate steal), may be checked out here. A `completed`
        // (resolved) task — or any other status — must be rejected, otherwise a stale
        // preview lets an admin re-check-out and re-work an already-resolved task
        // (re-applying its actions on the underlying group / racing another admin's close).
        const status = taskData.status;
        const lockExpiresAt = (taskData.checkoutDetails as Record<string, unknown> | undefined)?.expiresAt as
          | number
          | undefined;
        const lockActive =
          (status === 'checkedOut' || status === 'workLater') &&
          typeof lockExpiresAt === 'number' &&
          lockExpiresAt > now;
        const stealableExpired =
          (status === 'checkedOut' || status === 'workLater') && !lockActive;

        if (status !== 'pending' && !stealableExpired) {
          if (opts.onConflict === 'skip') return null;
          if (lockActive) {
            throw new ReportCoreTaskError('failed-precondition', 'This task is already checked out by another admin.');
          }
          // completed / resolved / unknown terminal — nothing to check out.
          throw new ReportCoreTaskError('failed-precondition', 'This task has already been resolved.');
        }
        if (opts.onConflict === 'skip' && lockActive) {
          // Queue candidate stolen between the query and this transaction.
          return null;
        }

        // Fetch original document (must read before any writes in the transaction)
        const originalDocRef = db.doc(taskData.originalPath as string);
        const originalDoc = await transaction.get(originalDocRef);

        // Audit auto-release if previously checked out
        if (taskData.checkoutDetails) {
          const prevCheckout = taskData.checkoutDetails as Record<string, unknown>;
          if (onAuditEvent) {
            await onAuditEvent(
              {
                action: 'auto_released',
                adminUserId: prevCheckout.userId as string,
                taskType: taskData.taskType as string,
                taskId: taskData.taskId as string,
                timestamp: now,
              },
              transaction,
            );
          }
        }

        const expiresAt = now + queueConfig.defaultCheckoutMinutes * 60 * 1000;
        const checkoutDetails = {
          userId,
          checkedOutAt: now,
          expiresAt,
          workLaterUntil: null,
        };

        // ── WRITES (no more reads after this point) ──
        transaction.update(taskRef, {
          status: 'checkedOut',
          checkoutDetails,
        });

        if (onAuditEvent) {
          await onAuditEvent(
            {
              action: 'checkout',
              adminUserId: userId,
              taskType: taskData.taskType as string,
              taskId: taskData.taskId as string,
              timestamp: now,
            },
            transaction,
          );
        }

        return {
          success: true,
          task: {
            id: taskDoc.id,
            taskType: taskData.taskType,
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

    const tasksRef = db.collection(config.collections.adminTasks);

    if (specificTaskId) {
      // Doc-level transaction on the named task; the status guard throws the precise error.
      return (await claimTask(tasksRef.doc(specificTaskId), { onConflict: 'throw' }))!;
    }

    for (let round = 0; round < MAX_CLAIM_ROUNDS; round++) {
      // Candidate discovery — OUTSIDE the transaction (see MAX_CLAIM_ROUNDS).
      // Find highest-priority pending task
      const pendingSnap = await tasksRef
        .where('taskType', '==', taskType)
        .where('status', '==', 'pending')
        .orderBy('priority', 'desc')
        .orderBy('createdAt', 'asc')
        .limit(1)
        .get();

      let candidateRef = pendingSnap.empty ? undefined : pendingSnap.docs[0].ref;

      if (!candidateRef) {
        // Try expired checked-out tasks
        const expiredSnap = await tasksRef
          .where('taskType', '==', taskType)
          .where('status', '==', 'checkedOut')
          .where('checkoutDetails.expiresAt', '<', Date.now())
          .orderBy('checkoutDetails.expiresAt', 'asc')
          .limit(1)
          .get();
        candidateRef = expiredSnap.empty ? undefined : expiredSnap.docs[0].ref;
      }

      if (!candidateRef) {
        throw new ReportCoreTaskError('not-found', 'No available tasks in this queue.');
      }

      const result = await claimTask(candidateRef, { onConflict: 'skip' });
      if (result) return result;
    }

    throw new ReportCoreTaskError('aborted', 'The task queue is busy right now — please try again.');
  };
}
