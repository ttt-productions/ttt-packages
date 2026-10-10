'use client';

import { useFirestorePaginated } from '@ttt-productions/query-core/react';
import { orderBy, type QueryConstraint } from 'firebase/firestore';
import type {
  NotificationDoc,
  NotificationHistoryItem,
  UseNotificationHistoryOptions,
} from '../../types.js';

const DEFAULT_PAGE_SIZE = 20;
const DEFAULT_STALE_TIME = 60_000;

/**
 * Paginated read of ARCHIVED notification history (the two-tier system's history
 * tier). Personal history lives under a per-user path
 * (`userProfiles/{uid}/notificationHistory`) and shared/admin history under a
 * top-level collection (`adminNotificationHistory`) — both resolved from the
 * category's `historyPath`, so no `where` clause is needed either way. Rows are
 * immutable and ordered newest-first by `archivedAt`.
 *
 * Each history doc is a wrapper (`archivedSnapshot` + archive metadata + a
 * native-TTL `expireAt`); the `select` mapper flattens it into a
 * {@link NotificationHistoryItem} so the read surface renders like the active
 * list. Owner-only (user) / admin-only (admin) reads are enforced by Firestore
 * rules — this hook performs no writes.
 */
export function useNotificationHistory({
  config,
  userId,
  category,
  enabled = true,
  pageSize = DEFAULT_PAGE_SIZE,
  staleTime = DEFAULT_STALE_TIME,
}: UseNotificationHistoryOptions) {
  const categoryConfig = config.categories[category];
  if (!categoryConfig) {
    throw new Error(`[notification-core] Unknown category: ${category}`);
  }

  const collectionPath = categoryConfig.historyPath(userId);

  const constraints: QueryConstraint[] = [orderBy('archivedAt', 'desc')];

  return useFirestorePaginated<NotificationHistoryItem>({
    collectionPath,
    queryKey: ['notifications', 'history', category, userId, { pageSize }],
    constraints,
    pageSize,
    enabled: enabled && !!userId,
    staleTime,
    select: (data) => {
      const snapshot = (data.archivedSnapshot ?? {}) as NotificationDoc;
      return {
        ...snapshot,
        // The archive occurrence id is the stable history-doc key; expose
        // archivedAt for ordering/display.
        archiveOccurrenceId: data.id,
        archivedAt: (data.archivedAt as number | undefined) ?? snapshot.updatedAt ?? 0,
      };
    },
  });
}
