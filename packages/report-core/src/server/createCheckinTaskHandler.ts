import type { ServerFirestore, ServerReportCoreConfig, OnAuditEvent } from './types.js';
import { ReportCoreTaskError } from './taskError.js';
import type { CheckinTaskRequest } from '../schemas/requests.js';
import type { TaskLifecycleResult } from '../contracts/types-admin-task.js';

export interface CheckinTaskHandlerConfig {
  config: ServerReportCoreConfig;
  db: ServerFirestore;
  logger?: { info: (...args: unknown[]) => void; error: (...args: unknown[]) => void };
  auth?: {
    requireAdmin: (uid: string, token?: unknown) => Promise<void>;
  };
  onAuditEvent?: OnAuditEvent;
  isResolvedByCheckin: (taskType: string) => boolean;
  domainResolutionRefusalMessage: string;
}

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
  ): Promise<TaskLifecycleResult> => {
    const { taskId, resolved, resolution } = data;
    const userId = authContext.uid;
    const now = Date.now();

    if (auth?.requireAdmin) {
      await auth.requireAdmin(userId, authContext.token);
    }

    return db.runTransaction(async (transaction) => {
      const taskRef = db.collection(config.collections.adminTasks).doc(taskId);
      const taskDoc = await transaction.get(taskRef);

      if (!taskDoc.exists) {
        return { success: true, alreadyResolved: true };
      }

      const taskData = taskDoc.data()!;
      const checkoutDetails = taskData.checkoutDetails as Record<string, unknown> | null;

      if (!checkoutDetails || checkoutDetails.userId !== userId) {
        throw new ReportCoreTaskError(
          'failed-precondition',
          'You do not have this task checked out.',
        );
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
