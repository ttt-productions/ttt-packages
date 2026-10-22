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
