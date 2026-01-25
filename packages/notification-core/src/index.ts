// Types
export type {
  Notification,
  NotificationInput,
  NotificationType,
  MarkAsReadOptions,
  DeleteNotificationOptions,
  NavigationHandler,
  NotificationTypeConfig,
  NotificationConfig,
} from './types.js';

// Hooks
export {
  useNotifications,
  useUnreadCount,
  useMarkAsRead,
  useMarkAllAsRead,
} from './hooks/index.js';

export type {
  UseNotificationsOptions,
  UseUnreadCountOptions,
  UseMarkAsReadOptions,
  UseMarkAllAsReadOptions,
} from './hooks/index.js';
