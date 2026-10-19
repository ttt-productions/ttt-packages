"use client";

// Hooks
export { useActiveNotifications } from './hooks/useActiveNotifications.js';
export { useNotificationHistory } from './hooks/useNotificationHistory.js';
export { useUnreadCount } from './hooks/useUnreadCount.js';
export { useArchiveNotification } from './hooks/useArchiveNotification.js';
export { useArchiveAllNotifications } from './hooks/useArchiveAllNotifications.js';

// Components
export { NotificationList } from './components/NotificationList.js';
export { NotificationHistoryList } from './components/NotificationHistoryList.js';
export { NotificationEmptyState } from './components/NotificationEmptyState.js';
export { NotificationUnreadBadge } from './components/NotificationUnreadBadge.js';

export type { NotificationListProps, NotificationHistoryListProps } from './types.js';
