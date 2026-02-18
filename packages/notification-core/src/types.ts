/**
 * @ttt-productions/notification-core — Type definitions
 *
 * Two-tier notification system: active (unread) → history (archived).
 * No `isRead` flag — existence in the active collection means unread.
 */

// ============================================================================
// DOCUMENT TYPES
// ============================================================================

/**
 * Active notification document stored in Firestore.
 * Same shape for both user and admin collections.
 */
export interface NotificationDoc {
  /** Firestore doc ID */
  id: string;
  /** Notification type (e.g. 'content_report', 'project_invite') */
  type: string;
  /** Dedup key (e.g. 'report_projectXYZ') — same key = same notification */
  dedupKey: string;
  /** Category: 'user' | 'admin' (extensible) */
  category: string;

  // Targeting
  /** userId for 'user' category, null for 'admin' (shared) */
  targetUserId: string | null;

  // Display
  /** Notification title */
  title: string;
  /** Notification body */
  message: string;

  // Dedup aggregation
  /** Incremented on duplicates */
  count: number;
  /** Last N actor user IDs (capped) */
  latestActorIds: string[];
  /** Display names matching latestActorIds */
  latestActorNames: string[];

  // Navigation
  /** Route path when clicked (e.g. '/admin' or '/projects/abc') */
  targetPath: string;
  /** Type-specific metadata (e.g. { projectId, reason }) */
  metadata: Record<string, unknown>;

  // Timestamps (epoch ms)
  /** First occurrence */
  createdAt: number;
  /** Latest occurrence */
  updatedAt: number;
}

/**
 * Archival audit trail — stored on every history doc.
 */
export interface ArchivalInfo {
  /** userId who clicked/dismissed */
  archivedBy: string;
  /** Epoch ms */
  archivedAt: number;
  /** Device context */
  device: 'web' | 'mobile';
}

/**
 * History document — extends active with archival info.
 */
export interface NotificationHistoryDoc extends NotificationDoc {
  /** Who/when/how it was archived */
  archival: ArchivalInfo;
  /** Admin userId (admin history only, quick-access field) */
  handledBy?: string;
}

/**
 * Pending notification — queue item for the batch processor.
 */
export interface PendingNotification {
  id: string;
  /** Notification type */
  type: string;
  /** Target category */
  category: string;
  /** Target userId (null for admin/shared) */
  targetUserId: string | null;
  /** Who triggered this */
  actorId: string;
  /** Actor display name */
  actorName: string;
  /** Type-specific data for building the notification */
  metadata: Record<string, unknown>;
  /** Epoch ms */
  createdAt: number;
}

// ============================================================================
// CONFIGURATION TYPES
// ============================================================================

/**
 * Per-category configuration (user vs admin).
 */
export interface NotificationCategoryConfig {
  /** Firestore collection path for active notifications */
  activePath: string;
  /** Function that returns the history collection path */
  historyPath: (userId?: string) => string;
  /** 'personal' requires targetUserId, 'shared' = all members see everything */
  audienceType: 'personal' | 'shared';
}

/**
 * Per-type configuration for a notification type.
 */
export interface NotificationTypeConfig {
  /** Which category this type belongs to */
  category: string;
  /** Delivery mode */
  delivery: 'realtime' | 'queued';
  /** Function to build the dedupKey from metadata */
  dedupKeyPattern: (metadata: Record<string, unknown>) => string;
  /** Function to build the title from metadata */
  titlePattern: (metadata: Record<string, unknown>) => string;
  /** Function to build the message from metadata + count */
  messagePattern: (metadata: Record<string, unknown>, count: number) => string;
  /** Default target path, or function to build from metadata */
  defaultTargetPath: string | ((metadata: Record<string, unknown>) => string);
  /** Max count value (default 5000) */
  countCap?: number;
  /** Max latestActorIds array length (default 5) */
  actorCap?: number;
  /** Icon/emoji for display (optional) */
  icon?: string;
}

/**
 * Full notification system configuration — provided by each app.
 */
export interface NotificationSystemConfig {
  /** Category definitions */
  categories: Record<string, NotificationCategoryConfig>;
  /** Type definitions */
  types: Record<string, NotificationTypeConfig>;
  /** Batch processor interval in minutes (default 10) */
  batchIntervalMinutes?: number;
  /** Firestore collection for pending notifications (default 'pendingNotifications') */
  pendingCollectionPath?: string;
}

// ============================================================================
// HOOK OPTION TYPES
// ============================================================================

export interface UseActiveNotificationsOptions {
  config: NotificationSystemConfig;
  userId: string;
  category: string;
  enabled?: boolean;
  pageSize?: number;
  refetchInterval?: number;
}

export interface UseUnreadCountOptions {
  config: NotificationSystemConfig;
  userId: string;
  category: string;
  enabled?: boolean;
  refetchInterval?: number;
  countLimit?: number;
}

export interface UseArchiveNotificationOptions {
  config: NotificationSystemConfig;
  userId: string;
  category: string;
  invalidateKeys?: readonly unknown[][];
}

export interface UseArchiveAllNotificationsOptions {
  config: NotificationSystemConfig;
  userId: string;
  category: string;
  invalidateKeys?: readonly unknown[][];
}

export interface UseNotificationHistoryOptions {
  config: NotificationSystemConfig;
  userId: string;
  category: string;
  enabled?: boolean;
  pageSize?: number;
}

// ============================================================================
// COMPONENT PROP TYPES
// ============================================================================

export interface NotificationListProps {
  config: NotificationSystemConfig;
  userId: string;
  category: string;
  onNotificationClick: (notification: NotificationDoc) => void;
  onClearAll?: () => void;
  refetchInterval?: number;
  device?: 'web' | 'mobile';
  emptyText?: string;
}

export interface NotificationEmptyStateProps {
  text?: string;
}

export interface NotificationHistoryListProps {
  config: NotificationSystemConfig;
  userId: string;
  category: string;
  onNotificationClick?: (notification: NotificationHistoryDoc) => void;
}

export interface NotificationUnreadBadgeProps {
  config: NotificationSystemConfig;
  userId: string;
  category: string;
  refetchInterval?: number;
}
