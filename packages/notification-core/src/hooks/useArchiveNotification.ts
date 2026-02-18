'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { doc, getDoc, setDoc, deleteDoc } from 'firebase/firestore';
import { useFirestoreDb } from '@ttt-productions/query-core';
import type {
  NotificationDoc,
  NotificationHistoryDoc,
  ArchivalInfo,
  UseArchiveNotificationOptions,
} from '../types.js';

/**
 * Archive a single notification: read from active → write to history → delete from active.
 *
 * @example
 * ```tsx
 * const archive = useArchiveNotification({
 *   config: TTT_NOTIFICATION_CONFIG,
 *   userId: user.uid,
 *   category: 'user',
 * });
 *
 * archive.mutate({
 *   notificationId: 'abc123',
 *   archivalInfo: { archivedBy: user.uid, archivedAt: Date.now(), device: 'web' },
 * });
 * ```
 */
export function useArchiveNotification({
  config,
  userId,
  category,
  invalidateKeys,
}: UseArchiveNotificationOptions) {
  const db = useFirestoreDb();
  const queryClient = useQueryClient();
  const categoryConfig = config.categories[category];

  const defaultInvalidateKeys = [
    ['notifications', 'active', category, userId],
    ['notifications', 'unread-count', category, userId],
    ['notifications', 'history', category, userId],
  ];

  return useMutation({
    mutationFn: async ({
      notificationId,
      archivalInfo,
    }: {
      notificationId: string;
      archivalInfo: ArchivalInfo;
    }) => {
      if (!categoryConfig) {
        throw new Error(`[notification-core] Unknown category: ${category}`);
      }

      const activePath = categoryConfig.activePath;
      const historyPath = categoryConfig.historyPath(userId);

      // Read active doc
      const activeRef = doc(db, activePath, notificationId);
      const activeSnap = await getDoc(activeRef);

      if (!activeSnap.exists()) {
        // Already archived or deleted — no-op
        return;
      }

      const activeData = { id: activeSnap.id, ...activeSnap.data() } as NotificationDoc;

      // Build history doc
      const historyDoc: Omit<NotificationHistoryDoc, 'id'> = {
        ...activeData,
        archival: archivalInfo,
        ...(categoryConfig.audienceType === 'shared'
          ? { handledBy: archivalInfo.archivedBy }
          : {}),
      };

      // Write to history
      const historyRef = doc(db, historyPath, notificationId);
      await setDoc(historyRef, historyDoc);

      // Delete from active
      await deleteDoc(activeRef);
    },
    onSuccess: () => {
      const keysToInvalidate = invalidateKeys ?? defaultInvalidateKeys;
      keysToInvalidate.forEach((key) => {
        queryClient.invalidateQueries({ queryKey: [...key], exact: false });
      });
    },
  });
}
