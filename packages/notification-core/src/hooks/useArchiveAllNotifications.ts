'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  collection,
  query,
  where,
  orderBy,
  limit,
  getDocs,
  doc,
  writeBatch,
} from 'firebase/firestore';
import { useFirestoreDb } from '@ttt-productions/query-core';
import type {
  NotificationDoc,
  ArchivalInfo,
  UseArchiveAllNotificationsOptions,
} from '../types.js';

const BATCH_SIZE = 50;

/**
 * Archive all active notifications in batches.
 * Reads active docs in batches of 50, archives each batch, repeats until empty.
 *
 * @example
 * ```tsx
 * const archiveAll = useArchiveAllNotifications({
 *   config: TTT_NOTIFICATION_CONFIG,
 *   userId: user.uid,
 *   category: 'user',
 * });
 *
 * archiveAll.mutate({
 *   archivalInfo: { archivedBy: user.uid, archivedAt: Date.now(), device: 'web' },
 * });
 * ```
 */
export function useArchiveAllNotifications({
  config,
  userId,
  category,
  invalidateKeys,
}: UseArchiveAllNotificationsOptions) {
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
      archivalInfo,
    }: {
      archivalInfo: ArchivalInfo;
    }) => {
      if (!categoryConfig) {
        throw new Error(`[notification-core] Unknown category: ${category}`);
      }

      const activePath = categoryConfig.activePath;
      const historyPath = categoryConfig.historyPath(userId);
      const isPersonal = categoryConfig.audienceType === 'personal';

      let totalArchived = 0;
      let hasMore = true;

      while (hasMore) {
        const constraints = [
          ...(isPersonal ? [where('targetUserId', '==', userId)] : []),
          orderBy('updatedAt', 'desc'),
          limit(BATCH_SIZE),
        ];

        const q = query(collection(db, activePath), ...constraints);
        const snapshot = await getDocs(q);

        if (snapshot.empty) {
          hasMore = false;
          break;
        }

        const batch = writeBatch(db);

        snapshot.docs.forEach((docSnap) => {
          const data = docSnap.data() as Omit<NotificationDoc, 'id'>;

          // Write to history
          const historyRef = doc(db, historyPath, docSnap.id);
          batch.set(historyRef, {
            ...data,
            id: docSnap.id,
            archival: archivalInfo,
            ...(categoryConfig.audienceType === 'shared'
              ? { handledBy: archivalInfo.archivedBy }
              : {}),
          });

          // Delete from active
          const activeRef = doc(db, activePath, docSnap.id);
          batch.delete(activeRef);
        });

        await batch.commit();
        totalArchived += snapshot.docs.length;

        if (snapshot.docs.length < BATCH_SIZE) {
          hasMore = false;
        }
      }

      return { totalArchived };
    },
    onSuccess: () => {
      const keysToInvalidate = invalidateKeys ?? defaultInvalidateKeys;
      keysToInvalidate.forEach((key) => {
        queryClient.invalidateQueries({ queryKey: [...key], exact: false });
      });
    },
  });
}
