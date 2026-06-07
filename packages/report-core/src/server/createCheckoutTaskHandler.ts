import type {
  ServerFirestore,
  ServerReportCoreConfig,
  AdminAuthConfig,
  OnAuditEvent,
} from './types.js';
import type { CheckoutTaskRequest } from '../schemas/index.js';

export interface CheckoutTaskHandlerConfig {
  config: ServerReportCoreConfig;
  db: ServerFirestore;
  auth: AdminAuthConfig;
  onAuditEvent?: OnAuditEvent;
  logger?: { info: (...args: unknown[]) => void; error: (...args: unknown[]) => void };
}

/**
 * Factory that returns the handler for the checkoutTask callable function.
 *
 * Behavior:
 * 1. Verifies admin auth (requireAdmin function or adminUserIds fallback)
 * 2. Finds the highest-priority pending task of the given type
 * 3. Falls back to expired checked-out tasks
 * 4. Sets checkout details with expiration
 * 5. Logs activity
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

    throw new Error('Administrator access required');
  };

  return async (
    data: CheckoutTaskRequest,
    authContext: { uid: string; token: unknown },
  ): Promise<Record<string, unknown>> => {
    const { taskType } = data;
    const userId = authContext.uid;

    await verifyAdmin(userId, authContext.token);

    const queueConfig = config.taskQueues[taskType];
    if (!queueConfig) {
      throw new Error('Invalid task type specified.');
    }

    const now = Date.now();
    const expiresAt = now + queueConfig.defaultCheckoutMinutes * 60 * 1000;

    return db.runTransaction(async (transaction) => {
      const tasksRef = db.collection(config.collections.adminTasks);
      let taskDoc;

      // Find highest-priority pending task
      const pendingQuery = tasksRef
        .where('taskType', '==', taskType)
        .where('status', '==', 'pending')
        .orderBy('priority', 'desc')
        .orderBy('createdAt', 'asc')
        .limit(1);

      const pendingSnap = await transaction.get(pendingQuery);

      if (!pendingSnap.empty) {
        taskDoc = pendingSnap.docs[0];
      } else {
        // Try expired checked-out tasks
        const expiredQuery = tasksRef
          .where('taskType', '==', taskType)
          .where('status', '==', 'checkedOut')
          .where('checkoutDetails.expiresAt', '<', now)
          .orderBy('checkoutDetails.expiresAt', 'asc')
          .limit(1);

        const expiredSnap = await transaction.get(expiredQuery);
        if (!expiredSnap.empty) {
          taskDoc = expiredSnap.docs[0];
        } else {
          throw new Error('No available tasks in this queue.');
        }
      }
      const taskRef = taskDoc.ref;

      const taskData = taskDoc!.data()!;

      // Fetch original document (must read before any writes in the transaction)
      const originalDocRef = db.doc(taskData.originalPath as string);
      const originalDoc = await transaction.get(originalDocRef);

      // Log auto-release if previously checked out
      if (taskData.checkoutDetails) {
        const prevCheckout = taskData.checkoutDetails as Record<string, unknown>;
        const autoReleaseLogRef = db.collection(config.collections.activityLog).doc();
        transaction.set(autoReleaseLogRef, {
          id: autoReleaseLogRef.id,
          adminUserId: prevCheckout.userId as string,
          action: 'auto_released',
          taskType: taskData.taskType as string,
          taskId: taskData.taskId as string,
          timestamp: now,
        });
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

      const checkoutDetails = {
        userId,
        checkedOutAt: now,
        expiresAt,
        workLaterUntil: null,
      };

      transaction.update(taskRef!, {
        status: 'checkedOut',
        checkoutDetails,
      });

      const logRef = db.collection(config.collections.activityLog).doc();
      transaction.set(logRef, {
        id: logRef.id,
        adminUserId: userId,
        action: 'checkout',
        taskType: taskData.taskType as string,
        taskId: taskData.taskId as string,
        timestamp: now,
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
          id: taskDoc!.id,
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
  };
}
