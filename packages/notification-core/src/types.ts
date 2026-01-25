import type { Timestamp } from 'firebase/firestore';

/**
 * Base notification type that can be extended per app.
 */
export type NotificationType = string;

/**
 * Core notification document structure stored in Firestore.
 */
export interface Notification {
  /** Unique notification ID (usually Firestore doc ID) */
  id: string;
  /** Type of notification - app-specific (e.g., 'trophy_received', 'game_scheduled') */
  type: NotificationType;
  /** Notification title */
  title: string;
  /** Notification message/body */
  message: string;
  /** Target path to navigate to when clicked (app-specific route) */
  targetPath: string;
  /** Optional URL/route parameters for navigation */
  targetParams?: Record<string, any>;
  /** Whether the notification has been read */
  isRead: boolean;
  /** When the notification was created */
  createdAt: Timestamp;
  /** Optional type-specific metadata */
  metadata?: Record<string, any>;
}

/**
 * Notification data without the ID (for creating new notifications).
 */
export type NotificationInput = Omit<Notification, 'id'>;

/**
 * Options for marking notifications as read.
 */
export interface MarkAsReadOptions {
  /** Single notification ID to mark as read */
  notificationId?: string;
  /** Mark all notifications as read */
  all?: boolean;
}

/**
 * Options for deleting notifications.
 */
export interface DeleteNotificationOptions {
  /** Single notification ID to delete */
  notificationId?: string;
  /** Delete all read notifications */
  allRead?: boolean;
}

/**
 * Navigation handler function signature that apps must provide.
 */
export type NavigationHandler = (path: string, params?: Record<string, any>) => void;

/**
 * Notification configuration per type (app-specific).
 */
export interface NotificationTypeConfig {
  /** Icon or emoji to display */
  icon?: string;
  /** Color theme for the notification */
  color?: string;
  /** Custom navigation handler for this type */
  navigateTo?: (params?: Record<string, any>) => string;
}

/**
 * App-specific notification configuration.
 */
export interface NotificationConfig {
  /** Map of notification types to their configurations */
  types: Record<NotificationType, NotificationTypeConfig>;
}
