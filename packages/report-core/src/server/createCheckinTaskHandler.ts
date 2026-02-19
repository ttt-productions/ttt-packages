import type { ServerFirestore, ServerReportCoreConfig } from './types.js';

export interface CheckinTaskHandlerConfig {
  config: ServerReportCoreConfig;
  db: ServerFirestore;
  getUserProfile?: (uid: string) => Promise<{ displayName?: string } | null>;
  logger?: { info: (...args: unknown[]) => void; error: (...args: unknown[]) => void };
}

interface CheckinRequest {
  taskId: string;
  resolved: boolean;
  resolution?: string;
}

/**
 * Factory that returns the handler for the checkinTask callable function.
 * Marks a task as completed (resolved) or returns it to pending (unresolved).
 */
export function createCheckinTaskHandler({
  config,
  db,
  getUserProfile,
}: CheckinTaskHandlerConfig) {
  return async (
    data: CheckinRequest,
    authContext: { uid: string },
  ): Promise<{ success: boolean }> => {
    const { taskId, resolved, resolution } = data;
    const userId = authContext.uid;
    const now = Date.now();

    return db.runTransaction(async (transaction) => {
      const taskRef = db.collection(config.collections.adminTasks).doc(taskId);
      const taskDoc = await transaction.get(taskRef);

      if (!taskDoc.exists) {
        throw new Error('The task could not be found. It may have been deleted.');
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

      const profile = getUserProfile ? await getUserProfile(userId) : null;

      const logRef = db.collection(config.collections.activityLog).doc();
      transaction.set(logRef, {
        id: logRef.id,
        adminUserId: userId,
        adminDisplayName: profile?.displayName ?? 'Admin',
        action: resolved ? 'checkin_resolved' : 'checkin_unresolved',
        taskType: taskData.taskType as string,
        taskId: taskData.taskId as string,
        timestamp: now,
        resolution: resolution ?? null,
        timeSpentMinutes,
      });

      return { success: true };
    });
  };
}
