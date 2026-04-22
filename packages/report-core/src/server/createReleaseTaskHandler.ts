import type { ServerFirestore, ServerReportCoreConfig } from './types.js';

export interface ReleaseTaskHandlerConfig {
  config: ServerReportCoreConfig;
  db: ServerFirestore;
  getUserProfile?: (uid: string) => Promise<{ displayName?: string } | null>;
  auth?: {
    requireAdmin: (uid: string, token?: unknown) => Promise<void>;
  };
}

interface ReleaseRequest {
  taskId: string;
}

/**
 * Factory that returns the handler for the releaseTask callable function.
 * Releases a checked-out task back to the pending queue.
 */
export function createReleaseTaskHandler({
  config,
  db,
  getUserProfile,
  auth,
}: ReleaseTaskHandlerConfig) {
  return async (
    data: ReleaseRequest,
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
        throw new Error('Task not found.');
      }

      const taskData = taskDoc.data()!;
      const checkoutDetails = taskData.checkoutDetails as Record<string, unknown> | null;

      if (!checkoutDetails || checkoutDetails.userId !== userId) {
        throw new Error('You do not have this task checked out.');
      }

      transaction.update(taskRef, {
        status: 'pending',
        checkoutDetails: null,
      });

      const profile = getUserProfile ? await getUserProfile(userId) : null;

      const logRef = db.collection(config.collections.activityLog).doc();
      transaction.set(logRef, {
        id: logRef.id,
        adminUserId: userId,
        adminDisplayName: profile?.displayName ?? 'Admin',
        action: 'release',
        taskType: taskData.taskType as string,
        taskId: taskData.taskId as string,
        timestamp: Date.now(),
      });

      return { success: true };
    });
  };
}
