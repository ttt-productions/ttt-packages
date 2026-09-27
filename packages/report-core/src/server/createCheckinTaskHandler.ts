import type { ServerFirestore, ServerReportCoreConfig, OnAuditEvent } from './types.js';
import { ReportCoreTaskError } from './taskError.js';
import type { CheckinTaskRequest } from '../schemas/index.js';

export interface CheckinTaskHandlerConfig {
  config: ServerReportCoreConfig;
  db: ServerFirestore;
  logger?: { info: (...args: unknown[]) => void; error: (...args: unknown[]) => void };
  auth?: {
    requireAdmin: (uid: string, token?: unknown) => Promise<void>;
  };
  onAuditEvent?: OnAuditEvent;
  /**
   * Whether a resolved check-in may complete a task of this stored `taskType`. A type whose
   * resolution belongs to a domain resolver (a guided decision that writes its own outcome and
   * deletes the task) answers false, and a resolved check-in of it is refused — completing it
   * here would drop the decision its resolver owns. An unknown type should answer false.
   */
  isResolvedByCheckin: (taskType: string) => boolean;
  /** The refusal message a resolved check-in of such a task answers with (app copy). */
  domainResolutionRefusalMessage: string;
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
  isResolvedByCheckin,
  domainResolutionRefusalMessage,
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
        throw new ReportCoreTaskError('failed-precondition', 'You do not have this task checked out.');
      }

      if (resolved && !isResolvedByCheckin(String(taskData.taskType ?? ''))) {
        throw new ReportCoreTaskError('failed-precondition', domainResolutionRefusalMessage);
      }

      const timeSpentMinutes = Math.round(
        (now - (checkoutDetails.checkedOutAt as number)) / 60_000,
      );

      transaction.update(taskRef, {
        status: resolved ? 'completed' : 'pending',
        checkoutDetails: null,
        completedAt: resolved ? now : null,
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
