// Types
export type {
  // Document types
  NotificationDoc,
  NotificationHistoryDoc,
  ArchivalInfo,
  PendingNotification,
  // Config types
  NotificationCategoryConfig,
  NotificationTypeConfig,
  NotificationSystemConfig,
  // Hook option types
  UseActiveNotificationsOptions,
  UseUnreadCountOptions,
  UseArchiveNotificationOptions,
  UseArchiveAllNotificationsOptions,
  UseNotificationHistoryOptions,
  // Component prop types
  NotificationListProps,
  NotificationEmptyStateProps,
  NotificationHistoryListProps,
  NotificationUnreadBadgeProps,
} from './types.js';

// Hooks
export {
  useActiveNotifications,
  useUnreadCount,
  useArchiveNotification,
  useArchiveAllNotifications,
  useNotificationHistory,
} from './hooks/index.js';

// Components
export {
  NotificationList,
  NotificationEmptyState,
  NotificationHistoryList,
  NotificationUnreadBadge,
} from './components/index.js';
