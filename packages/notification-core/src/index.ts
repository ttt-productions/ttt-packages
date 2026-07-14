export type {
  NotificationDoc,
  PendingNotification,
  NotificationCategoryConfig,
  NotificationTypeConfig,
  NotificationSystemConfig,
  UseActiveNotificationsOptions,
  UseNotificationHistoryOptions,
  NotificationHistoryItem,
  UseUnreadCountOptions,
  UseArchiveNotificationOptions,
  UseArchiveAllNotificationsOptions,
  ArchiveAllJobStatus,
  EnqueueArchiveAllResult,
  ArchiveAllJobSnapshot,
  ArchiveAllPollResult,
  NotificationRowActions,
  NotificationListProps,
  NotificationHistoryListProps,
  NotificationEmptyStateProps,
  NotificationUnreadBadgeProps,
} from './types.js';

// Runtime schemas for the generic notification doc shapes (notification-core owns
// these; consuming apps compose them instead of hand-mirroring). Server- and
// UI-safe (zod only, no React/firebase).
export { NotificationDocSchema, PendingNotificationSchema } from './schemas.js';
