import type {
  ServerFirestore,
  ServerReportCoreConfig,
  AdminAuthConfig,
} from './types.js';

export interface CheckoutNextImportantHandlerConfig {
  config: ServerReportCoreConfig;
  db: ServerFirestore;
  auth: AdminAuthConfig;
  getUserProfile?: (uid: string) => Promise<{ displayName?: string; profilePictureUrlFull?: string | null } | null>;
  logger?: { info: (...args: unknown[]) => void; error: (...args: unknown[]) => void };
}

/**
 * Factory that returns the handler for checkoutNextImportantTask.
 * Finds the single highest-priority pending task across ALL queues
 * and checks it out to the current admin.
 */
export function createCheckoutNextImportantHandler({
  config,
  db,
  auth,
  getUserProfile,
}: CheckoutNextImportantHandlerConfig) {
  const verifyAdmin = async (uid: string, authToken: unknown): Promise<void> => {
    if (auth.requireAdmin) {
      try {
        await auth.requireAdmin(uid, authToken);
        return;
      } catch {
        // Fall through
      }
    }
    if (auth.adminUserIds?.includes(uid)) return;
    throw new Error('Administrator access required');
  };

  return async (
    _data: unknown,
    authContext: { uid: string; token: unknown },
  ): Promise<Record<string, unknown>> => {
    const userId = authContext.uid;
    await verifyAdmin(userId, authContext.token);

    const profile = getUserProfile ? await getUserProfile(userId) : null;
    const now = Date.now();

    return db.runTransaction(async (transaction) => {
      const tasksRef = db.collection(config.collections.adminTasks);
      const q = tasksRef
        .where('status', '==', 'pending')
        .orderBy('priority', 'desc')
        .orderBy('createdAt', 'asc')
        .limit(1);

      const snapshot = await transaction.get(q);

      if (snapshot.empty) {
        throw new Error('No pending tasks available! All caught up! 🎉');
      }

      const taskDoc = snapshot.docs[0];
      const taskData = taskDoc.data()!;
      const taskRef = taskDoc.ref;

      // Look up checkout duration from config
      const taskType = taskData.taskType as string;
      const queueConfig = config.taskQueues[taskType];
      const checkoutMinutes = queueConfig?.defaultCheckoutMinutes ?? 60;
      const expiresAt = now + checkoutMinutes * 60 * 1000;

      const checkoutDetails = {
        userId,
        userDisplayName: profile?.displayName ?? 'Admin',
        userPhotoURL: profile?.profilePictureUrlFull ?? null,
        checkedOutAt: now,
        expiresAt,
        workLaterUntil: null,
      };

      transaction.update(taskRef, {
        status: 'checkedOut',
        checkoutDetails,
      });

      const logRef = db.collection(config.collections.activityLog).doc();
      transaction.set(logRef, {
        id: logRef.id,
        adminUserId: userId,
        adminDisplayName: profile?.displayName ?? 'Admin',
        action: 'checkout_next_important',
        taskType,
        taskId: taskData.taskId as string,
        priority: taskData.priority,
        timestamp: now,
      });

      // Fetch original document
      const originalDocRef = db.doc(taskData.originalPath as string);
      const originalDoc = await transaction.get(originalDocRef);

      return {
        success: true,
        task: {
          id: taskDoc.id,
          taskType,
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
