import type { ServerFirestore, ServerReportCoreConfig, OnAuditEvent } from './types.js';
import { ReportCoreTaskError } from './taskError.js';
import type { ReleaseTaskRequest } from '../schemas/requests.js';
import type { TaskLifecycleResult } from '../contracts/types-admin-task.js';

export interface ReleaseTaskHandlerConfig {
  config: ServerReportCoreConfig;
  db: ServerFirestore;
  auth?: {
    requireAdmin: (uid: string, token?: unknown) => Promise<void>;
  };
  onAuditEvent?: OnAuditEvent;
}

/**
 * Factory that returns the handler for the releaseTask callable function.
 * Releases a checked-out task back to the pending queue.
 *
 * IDEMPOTENT BY DESIGN. "Release" asks for one end state — *this admin holds no
 * checkout on this task* — so every way of already being in that state answers
 * success instead of an error:
 *
 *  - the task doc is GONE (`alreadyResolved: true`) — an auto-resolving writer
 *    deletes the task inside its own resolving transaction, so an admin holding
 *    a stale work view legitimately releases a task that no longer exists;
 *  - the task exists with no live `checkoutDetails` — the lock lapsed/expired,
 *    or an earlier release already landed.
 *
 * A checkout held by ANOTHER admin is a real conflict and still throws
 * `failed-precondition`; the admin gate still throws through `auth.requireAdmin`.
 *
 * The missing-doc branch cannot distinguish a deleted task from a nonexistent
 * `taskId` (the wire schema only requires a non-empty string), and that is safe:
 * releasing writes nothing and audits nothing on this branch, so a bogus id is a
 * pure no-op with no state to corrupt and no existence oracle to leak.
 */
export function createReleaseTaskHandler({
  config,
  db,
  auth,
  onAuditEvent,
}: ReleaseTaskHandlerConfig) {
  return async (
    data: ReleaseTaskRequest,
    authContext: { uid: string; token?: unknown },
  ): Promise<TaskLifecycleResult> => {
    const { taskId } = data;
    const userId = authContext.uid;

    // Defense-in-depth: admin check if provided by the consumer
    if (auth?.requireAdmin) {
      await auth.requireAdmin(userId, authContext.token);
    }

    return db.runTransaction(async (transaction) => {
      const taskRef = db.collection(config.collections.adminTasks).doc(taskId);
      const taskDoc = await transaction.get(taskRef);

      if (!taskDoc.exists) {
        // Idempotent no-op: the task is GONE, not never-held. An auto-resolving
        // writer deletes the adminTasks doc inside the same transaction as the
        // resolving write, so an admin whose work view went stale hits a task
        // that was correctly deleted — a designed terminal state, not an error.
        // Nothing is held, so the caller's goal state already holds. Same
        // contract (and same `alreadyResolved` discriminant) as
        // createCheckinTaskHandler; there is no task data left to update or
        // audit.
        return { success: true, alreadyResolved: true };
      }

      const taskData = taskDoc.data()!;
      const checkoutDetails = taskData.checkoutDetails as Record<string, unknown> | null;

      // Idempotent no-op: no live checkout means the caller's goal state already
      // holds (the checkout lapsed/expired, an earlier release landed, or the task
      // was resolved). A checkout held by ANOTHER admin is a real conflict and
      // throws.
      if (!checkoutDetails) {
        return { success: true };
      }
      if (checkoutDetails.userId !== userId) {
        throw new ReportCoreTaskError(
          'failed-precondition',
          'You do not have this task checked out.',
        );
      }

      transaction.update(taskRef, {
        status: 'pending',
        checkoutDetails: null,
      });

      const now = Date.now();
      if (onAuditEvent) {
        await onAuditEvent(
          {
            action: 'release',
            adminUserId: userId,
            taskType: taskData.taskType as string,
            taskId: taskData.taskId as string,
            timestamp: now,
          },
          transaction,
        );
      }

      return { success: true };
    });
  };
}
