import type {
  ServerFirestore,
  ServerReportCoreConfig,
  AdminAuthConfig,
} from './types.js';

export interface CheckoutTaskHandlerConfig {
  config: ServerReportCoreConfig;
  db: ServerFirestore;
  auth: AdminAuthConfig;
  /** Function to look up admin user profile. Returns { displayName, profilePictureUrlFull }. */
  getUserProfile?: (uid: string) => Promise<{ displayName?: string; profilePictureUrlFull?: string | null } | null>;
  logger?: { info: (...args: unknown[]) => void; error: (...args: unknown[]) => void };
}

interface CheckoutRequest {
  taskType: string;
  specificTaskId?: string;
}

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
  getUserProfile,
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
    data: CheckoutRequest,
    authContext: { uid: string; token: unknown },
  ): Promise<Record<string, unknown>> => {
    const { taskType, specificTaskId } = data;
    const userId = authContext.uid;

    await verifyAdmin(userId, authContext.token);

    const profile = getUserProfile ? await getUserProfile(userId) : null;
    const queueConfig = config.taskQueues[taskType];
    if (!queueConfig) {
      throw new Error('Invalid task type specified.');
    }

    const now = Date.now();
    const expiresAt = now + queueConfig.defaultCheckoutMinutes * 60 * 1000;

    return db.runTransaction(async (transaction) => {
      const tasksRef = db.collection(config.collections.adminTasks);
      let taskDoc;
      let taskRef;

      if (specificTaskId) {
        taskRef = tasksRef.doc(specificTaskId);
        taskDoc = await transaction.get(taskRef);

        if (!taskDoc.exists) {
          throw new Error('The requested task could not be found.');
        }

        const taskData = taskDoc.data()!;
        if (
          (taskData.status === 'checkedOut' || taskData.status === 'workLater') &&
          (taskData.checkoutDetails as Record<string, unknown>)?.expiresAt as number > now
        ) {
          const checkedOutBy = ((taskData.checkoutDetails as Record<string, unknown>)?.userDisplayName as string) ?? 'another admin';
          throw new Error(`This task is already checked out by ${checkedOutBy}.`);
        }
      } else {
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
        taskRef = taskDoc.ref;
      }

      const taskData = taskDoc!.data()!;

      // Log auto-release if previously checked out
      if (taskData.checkoutDetails) {
        const prevCheckout = taskData.checkoutDetails as Record<string, unknown>;
        const autoReleaseLogRef = db.collection(config.collections.activityLog).doc();
        transaction.set(autoReleaseLogRef, {
          id: autoReleaseLogRef.id,
          adminUserId: prevCheckout.userId as string,
          adminDisplayName: prevCheckout.userDisplayName as string,
          action: 'auto_released',
          taskType: taskData.taskType as string,
          taskId: taskData.taskId as string,
          timestamp: now,
        });
      }

      const checkoutDetails = {
        userId,
        userDisplayName: profile?.displayName ?? 'Admin',
        userPhotoURL: profile?.profilePictureUrlFull ?? null,
        checkedOutAt: now,
        expiresAt,
        workLaterUntil: null,
      };

      transaction.update(taskRef!, {
        status: 'checkedOut',
        checkoutDetails,
      });

      // Log checkout
      const logRef = db.collection(config.collections.activityLog).doc();
      transaction.set(logRef, {
        id: logRef.id,
        adminUserId: userId,
        adminDisplayName: profile?.displayName ?? 'Admin',
        action: 'checkout',
        taskType: taskData.taskType as string,
        taskId: taskData.taskId as string,
        timestamp: now,
      });

      // Fetch original document
      const originalDocRef = db.doc(taskData.originalPath as string);
      const originalDoc = await transaction.get(originalDocRef);

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
