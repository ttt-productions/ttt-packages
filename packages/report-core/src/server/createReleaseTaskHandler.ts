import type { ServerFirestore, ServerReportCoreConfig, OnAuditEvent } from './types.js';
import { ReportCoreTaskError } from './taskError.js';
import type { ReleaseTaskRequest } from '../schemas/index.js';

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
  ): Promise<{ success: boolean }> => {
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
        throw new ReportCoreTaskError('not-found', 'Task not found.');
      }

      const taskData = taskDoc.data()!;
      const checkoutDetails = taskData.checkoutDetails as Record<string, unknown> | null;

      // Idempotent no-op: no live checkout means the caller's goal state already
      // holds (the checkout lapsed/expired, an earlier release landed, or the task
      // was resolved). Throwing here surfaced as a spurious 'internal' 500 to
      // clients draining stale checkout cards whose server-side checkout had
      // already lapsed (live: TTT hosted-dev admin drain, 2026-07-20). A checkout
      // held by ANOTHER admin is still a real conflict and still throws.
      if (!checkoutDetails) {
        return { success: true };
      }
      if (checkoutDetails.userId !== userId) {
        throw new ReportCoreTaskError('failed-precondition', 'You do not have this task checked out.');
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
