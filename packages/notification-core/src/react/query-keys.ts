import type { NotificationQueryKeys } from '../types.js';

/** The keys the hooks use when the app supplies none. */
const DEFAULT_NOTIFICATION_QUERY_KEYS: NotificationQueryKeys = {
  active: (category, userId) => ['notifications', 'active', category, userId],
  history: (category, userId) => ['notifications', 'history', category, userId],
  unreadCount: (category, userId) => ['notifications', 'unread-count', category, userId],
};

export function resolveNotificationQueryKeys(queryKeys: NotificationQueryKeys | undefined): NotificationQueryKeys {
  return queryKeys ?? DEFAULT_NOTIFICATION_QUERY_KEYS;
}

/** The three keys an archive or an archive-all refreshes for one category and viewer. */
export function archiveRefreshKeys(
  queryKeys: NotificationQueryKeys | undefined,
  category: string,
  userId: string,
): readonly (readonly unknown[])[] {
  const keys = resolveNotificationQueryKeys(queryKeys);
  return [keys.active(category, userId), keys.unreadCount(category, userId), keys.history(category, userId)];
}
