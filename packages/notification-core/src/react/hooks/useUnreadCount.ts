'use client';

import { where, type QueryConstraint } from 'firebase/firestore';
import { useFirestoreCount } from '@ttt-productions/query-core/react';
import type { UseUnreadCountOptions } from '../../types.js';

const DEFAULT_REFETCH_INTERVAL = 30_000;
const DEFAULT_COUNT_LIMIT = 99;

/**
 * Unread-count badge backed by a Firestore `count()` aggregation (a server-side
 * count, not a doc fetch), via query-core's `useFirestoreCount`. Polls for cost
 * control; displays capped (`hasMore` → `99+`).
 *
 * - **personal** categories count **unseen** active items (`seenAt == 0`),
 *   scoped to the caller (`targetUserId == uid`);
 * - **shared** categories have no per-admin seen state, so the indicator is
 *   existence-based — a count of all active items, with no `seenAt` predicate.
 *
 * The personal `seenAt == 0` predicate needs a composite index, captured as an
 * app-side index step.
 *
 * @example
 * ```tsx
 * const { count, isLoading } = useUnreadCount({
 *   config: TTT_NOTIFICATION_CONFIG,
 *   userId: user.uid,
 *   category: 'user',
 * });
 * ```
 */
export function useUnreadCount({
  config,
  userId,
  category,
  enabled = true,
  refetchInterval = DEFAULT_REFETCH_INTERVAL,
  countLimit = DEFAULT_COUNT_LIMIT,
}: UseUnreadCountOptions) {
  const categoryConfig = config.categories[category];
  if (!categoryConfig) {
    throw new Error(`[notification-core] Unknown category: ${category}`);
  }

  const collectionPath = categoryConfig.activePath;
  const isPersonal = categoryConfig.audienceType === 'personal';

  const constraints: QueryConstraint[] =
    isPersonal && userId
      ? [where('targetUserId', '==', userId), where('seenAt', '==', 0)]
      : [];

  const { data, ...rest } = useFirestoreCount({
    collectionPath,
    queryKey: ['notifications', 'unread-count', category, userId],
    constraints,
    enabled: enabled && !!userId,
    staleTime: refetchInterval,
    refetchInterval,
  });

  const count = data ?? 0;

  return {
    count,
    hasMore: count > countLimit,
    ...rest,
  };
}
