/**
 * Archive notification helper — used by callable Cloud Functions.
 * Moves active → history with ArchivalInfo, deletes from active.
 */

import type {
  NotificationSystemConfig,
  ArchivalInfo,
} from '../types.js';
import type { ServerFirestore } from './types.js';

interface ArchiveInput {
  notificationId: string;
  category: string;
  userId: string;
  archivalInfo: ArchivalInfo;
}

interface ArchiveAllInput {
  category: string;
  userId: string;
  archivalInfo: ArchivalInfo;
}

interface ArchiveResult {
  success: boolean;
  archived: number;
}

/**
 * Archive a single notification on the server side.
 */
export async function archiveNotificationHelper(
  db: ServerFirestore,
  config: NotificationSystemConfig,
  input: ArchiveInput,
): Promise<ArchiveResult> {
  const { notificationId, category, userId, archivalInfo } = input;
  const categoryConfig = config.categories[category];
  if (!categoryConfig) {
    throw new Error(`[notification-core] Unknown category: ${category}`);
  }

  const activePath = categoryConfig.activePath;
  const historyPath = categoryConfig.historyPath(userId);

  const activeRef = db.doc(`${activePath}/${notificationId}`);
  const activeSnap = await activeRef.get();

  if (!activeSnap.exists) {
    return { success: true, archived: 0 };
  }

  const activeData = activeSnap.data() as Record<string, unknown>;

  const historyDoc = {
    ...activeData,
    id: notificationId,
    archival: archivalInfo,
    ...(categoryConfig.audienceType === 'shared'
      ? { handledBy: archivalInfo.archivedBy }
      : {}),
  };

  const batch = db.batch();
  const historyRef = db.doc(`${historyPath}/${notificationId}`);
  batch.set(historyRef, historyDoc);
  batch.delete(activeRef);
  await batch.commit();

  return { success: true, archived: 1 };
}

/**
 * Archive all active notifications for a user/category on the server side.
 */
export async function archiveAllNotificationsHelper(
  db: ServerFirestore,
  config: NotificationSystemConfig,
  input: ArchiveAllInput,
): Promise<ArchiveResult> {
  const { category, userId, archivalInfo } = input;
  const categoryConfig = config.categories[category];
  if (!categoryConfig) {
    throw new Error(`[notification-core] Unknown category: ${category}`);
  }

  const activePath = categoryConfig.activePath;
  const historyPath = categoryConfig.historyPath(userId);
  const isPersonal = categoryConfig.audienceType === 'personal';

  let totalArchived = 0;
  let hasMore = true;

  while (hasMore) {
    const baseQuery = db.collection(activePath);
    const q = isPersonal
      ? baseQuery.where('targetUserId', '==', userId).orderBy('updatedAt', 'desc').limit(50)
      : baseQuery.orderBy('updatedAt', 'desc').limit(50);

    const snapshot = await q.get();

    if (snapshot.empty) {
      hasMore = false;
      break;
    }

    const batch = db.batch();

    for (const docSnap of snapshot.docs) {
      const data = docSnap.data() as Record<string, unknown>;
      const historyRef = db.doc(`${historyPath}/${docSnap.id}`);
      batch.set(historyRef, {
        ...data,
        id: docSnap.id,
        archival: archivalInfo,
        ...(categoryConfig.audienceType === 'shared'
          ? { handledBy: archivalInfo.archivedBy }
          : {}),
      });
      batch.delete(docSnap.ref);
    }

    await batch.commit();
    totalArchived += snapshot.docs.length;

    if (snapshot.docs.length < 50) {
      hasMore = false;
    }
  }

  return { success: true, archived: totalArchived };
}
