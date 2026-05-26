import type { ServerFirestore, ServerReportCoreConfig, OnAuditEvent } from './types.js';
import type { CheckinTaskRequest } from '../schemas/index.js';

export interface CheckinTaskHandlerConfig {
  config: ServerReportCoreConfig;
  db: ServerFirestore;
  logger?: { info: (...args: unknown[]) => void; error: (...args: unknown[]) => void };
  auth?: {
    requireAdmin: (uid: string, token?: unknown) => Promise<void>;
  };
  onAuditEvent?: OnAuditEvent;
}

/**
 * Factory that returns the handler for the checkinTask callable function.
 * Marks a task as completed (resolved) or returns it to pending (unresolved).
 */
export function createCheckinTaskHandler({
  config,
  db,
  auth,
  onAuditEvent,
}: CheckinTaskHandlerConfig) {
  return async (
    data: CheckinTaskRequest,
    authContext: { uid: string; token?: unknown },
  ): Promise<{ success: boolean; alreadyResolved?: true }> => {
    const { taskId, resolved, resolution } = data;
    const userId = authContext.uid;
    const now = Date.now();

    // Defense-in-depth: admin check if provided by the consumer
    if (auth?.requireAdmin) {
      await auth.requireAdmin(userId, authContext.token);
    }

    return db.runTransaction(async (transaction) => {
      const taskRef = db.collection(config.collections.adminTasks).doc(taskId);
      const taskDoc = await transaction.get(taskRef);

      if (!taskDoc.exists) {
        // Idempotent path: another writer (e.g. a backend trigger that
        // atomically resolves the task as part of its own transaction)
        // already deleted this task. Treat as success — there is no
        // activity log or audit event to write, since the task data
        // is gone. Return alreadyResolved so callers that care can
        // tell the difference.
        return { success: true, alreadyResolved: true };
      }

      const taskData = taskDoc.data()!;
      const checkoutDetails = taskData.checkoutDetails as Record<string, unknown> | null;

      if (!checkoutDetails || checkoutDetails.userId !== userId) {
        throw new Error('You do not have this task checked out.');
      }

      const timeSpentMinutes = Math.round(
        (now - (checkoutDetails.checkedOutAt as number)) / 60_000,
      );

      transaction.update(taskRef, {
        status: resolved ? 'completed' : 'pending',
        checkoutDetails: null,
        completedAt: resolved ? now : null,
      });

      const logRef = db.collection(config.collections.activityLog).doc();
      transaction.set(logRef, {
        id: logRef.id,
        adminUserId: userId,
        action: resolved ? 'checkin_resolved' : 'checkin_unresolved',
        taskType: taskData.taskType as string,
        taskId: taskData.taskId as string,
        timestamp: now,
        resolution: resolution ?? null,
        timeSpentMinutes,
      });
      if (onAuditEvent) {
        await onAuditEvent(
          {
            action: resolved ? 'checkin_resolved' : 'checkin_unresolved',
            adminUserId: userId,
            taskType: taskData.taskType as string,
            taskId: taskData.taskId as string,
            timestamp: now,
            resolution: resolution ?? null,
            timeSpentMinutes,
          },
          transaction,
        );
      }

      return { success: true };
    });
  };
}
