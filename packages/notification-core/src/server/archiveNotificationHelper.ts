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
  /** uid of the caller requesting the archive (ownership is verified against it). */
  callerUid: string;
  /** Whether the caller holds an admin/jrAdmin claim (required for shared notifications). */
  callerIsAdmin: boolean;
  archivalInfo: ArchivalInfo;
  /**
   * App-supplied epoch ms persisted on the history doc to back native TTL.
   * The retention window is app policy; the helper just writes the value.
   */
  expireAt?: number;
}

interface ArchiveAllInput {
  category: string;
  callerUid: string;
  callerIsAdmin: boolean;
  archivalInfo: ArchivalInfo;
  expireAt?: number;
}

interface ArchiveResult {
  success: boolean;
  archived: number;
}

/**
 * Assert the caller may archive a notification in this category.
 *
 * - personal: the active doc's `targetUserId` must equal `callerUid`.
 * - shared:   the category must be `shared` and the caller must be an admin.
 *
 * Throws on mismatch so the callable surfaces a permission error.
 */
function assertCanArchive(
  audienceType: 'personal' | 'shared',
  activeData: Record<string, unknown>,
  callerUid: string,
  callerIsAdmin: boolean,
): void {
  if (audienceType === 'shared') {
    if (!callerIsAdmin) {
      throw new Error(
        '[notification-core] Permission denied: shared notifications can only be archived by an admin',
      );
    }
    return;
  }
  if (activeData.targetUserId !== callerUid) {
    throw new Error(
      '[notification-core] Permission denied: caller does not own this notification',
    );
  }
}

/**
 * Archive a single notification on the server side. Verifies ownership before
 * the active → history move and persists the app-supplied `expireAt`.
 */
export async function archiveNotificationHelper(
  db: ServerFirestore,
  config: NotificationSystemConfig,
  input: ArchiveInput,
): Promise<ArchiveResult> {
  const { notificationId, category, callerUid, callerIsAdmin, archivalInfo, expireAt } = input;
  const categoryConfig = config.categories[category];
  if (!categoryConfig) {
    throw new Error(`[notification-core] Unknown category: ${category}`);
  }

  const activePath = categoryConfig.activePath;
  const historyPath = categoryConfig.historyPath(callerUid);

  const activeRef = db.doc(`${activePath}/${notificationId}`);
  const activeSnap = await activeRef.get();

  if (!activeSnap.exists) {
    return { success: true, archived: 0 };
  }

  const activeData = activeSnap.data() as Record<string, unknown>;

  assertCanArchive(categoryConfig.audienceType, activeData, callerUid, callerIsAdmin);

  const historyDoc = {
    ...activeData,
    id: notificationId,
    archival: archivalInfo,
    ...(expireAt !== undefined ? { expireAt } : {}),
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
  const { category, callerUid, callerIsAdmin, archivalInfo, expireAt } = input;
  const categoryConfig = config.categories[category];
  if (!categoryConfig) {
    throw new Error(`[notification-core] Unknown category: ${category}`);
  }

  const isPersonal = categoryConfig.audienceType === 'personal';

  // Shared archive-all is an admin-only bulk action; personal stays bounded to
  // the caller by the `targetUserId == callerUid` query filter below.
  if (!isPersonal && !callerIsAdmin) {
    throw new Error(
      '[notification-core] Permission denied: shared notifications can only be archived by an admin',
    );
  }

  const activePath = categoryConfig.activePath;
  const historyPath = categoryConfig.historyPath(callerUid);

  let totalArchived = 0;
  let hasMore = true;

  while (hasMore) {
    const baseQuery = db.collection(activePath);
    const q = isPersonal
      ? baseQuery.where('targetUserId', '==', callerUid).orderBy('updatedAt', 'desc').limit(50)
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
        ...(expireAt !== undefined ? { expireAt } : {}),
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
