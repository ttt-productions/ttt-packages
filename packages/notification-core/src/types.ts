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
  /** Notification type (e.g. 'content_report', 'entity_invite') */
  type: string;
  /** Dedup key (e.g. 'report_entityXYZ') — same key = same notification */
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
  /**
   * Last N actor user IDs (capped). Identity is stored id-only — display names
   * are resolved at read time by the consuming app (e.g. from publicUsers), so
   * they never drift in the persisted doc.
   */
  latestActorIds: string[];

  // Navigation
  /** Route path when clicked (e.g. '/admin' or '/entities/abc') */
  targetPath: string;
  /** Type-specific metadata (e.g. { entityId, reason }) */
  metadata: Record<string, unknown>;

  // Seen state (personal notifications)
  /**
   * Epoch ms the recipient last marked this notification seen, or `0` when
   * unseen. Generic field — no domain knowledge. Always present (initialized
   * to `0` on creation and reset to `0` on dedup-increment) so the unread
   * `count()` aggregation can match it with a `seenAt == 0` equality predicate.
   * `seenAt` is a personal concept; shared notifications carry it for shape
   * uniformity but their unread indicator is existence-based and ignores it.
   */
  seenAt: number;

  /**
   * Opaque per-generation token (uuid), minted FRESH whenever the active doc is
   * created or materially re-lit. The SEEN/ARCHIVE precondition compares against
   * THIS, not a restartable integer: the active doc id is deterministic, so a
   * delete+recreate would restart an integer and let a stale tab's "version 1"
   * match a different card it never saw (ABA). An opaque token cannot repeat.
   * Optional on the legacy active doc shape; the ledger materializer always sets it.
   */
  activityGeneration?: string;
  /** The `activityGeneration` observed at the time `seenAt` was last set. */
  seenAtGeneration?: string;

  // Timestamps (epoch ms)
  /** First occurrence */
  createdAt: number;
  /** Latest occurrence */
  updatedAt: number;
}

// Archived history docs are persisted as an untyped wrapper by the server archive
// helper (server/observed-generation.ts) — `archivedSnapshot` (the full active doc)
// plus archive metadata + a native-TTL `expireAt` Timestamp. There is no consumer-
// facing TS type for that shape; the canonical registry schema lives in ttt-core
// (doc-schemas/notifications.ts → NotificationHistoryDocSchema).

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
  /** Who triggered this (id-only; display name resolved at read time) */
  actorId: string;
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
  /** Firestore collection for the delivery ledger (default 'notificationDeliveries'). */
  deliveriesCollectionPath?: string;
  /**
   * Factory that converts epoch-ms to the app's Firestore `Timestamp` instance.
   * REQUIRED for the delivery ledger: Firestore native TTL acts ONLY on
   * `Timestamp` fields, so `expireAt` must be a real Timestamp (never a number).
   * The generic package never imports firebase-admin, so the app injects this
   * (e.g. `(ms) => admin.firestore.Timestamp.fromMillis(ms)`).
   */
  timestampFromMillis?: (ms: number) => unknown;
  /** Delivery-row TTL after materialization, in ms (default 90 days). */
  deliveryTtlMs?: number;
  /** Max delivery attempts before a row dead-letters (default 8). */
  maxDeliveryAttempts?: number;
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
  userId: string;
  category: string;
  /**
   * App-supplied adapter that performs the archive (active → history) for one
   * notification — typically `httpsCallable(functions, 'archiveNotification')`.
   * The hook performs no client Firestore writes; it only invalidates the read
   * keys on success.
   */
  archiveFn: (notificationId: string) => Promise<unknown>;
  invalidateKeys?: readonly unknown[][];
}

/**
 * Result of ONE archive-all server call. `hasMore` is true when the server hit its per-invocation
 * cap and the caller's active set was NOT fully drained — `useArchiveAllNotifications` loops the
 * adapter until `hasMore` is false so "Clear All" actually clears all (I3).
 *
 * NOTE: the loop's aggregate result carries the same `archived`/`hasMore` shape PLUS a `complete`
 * flag (`ArchiveAllLoopResult`); a single server page does not know whether the WHOLE active set
 * was drained, so the per-call shape here intentionally has no `complete`.
 */
export interface ArchiveAllResult {
  archived: number;
  hasMore: boolean;
}

/**
 * Aggregate result of the `useArchiveAllNotifications` continuation loop (I3). `complete` is the
 * load-bearing completion contract: it is `true` ONLY when the active set was fully drained
 * (`hasMore` reached `false`). It is `false` when the loop stopped early — either the no-progress
 * guard tripped (a pass archived nothing yet still reported `hasMore`, e.g. a generation-less head
 * card that can't advance) or the per-mutation pass bound was hit with `hasMore` still `true`.
 * Callers MUST gate post-clear side effects (closing the tray, `onClearAll`) on `complete`, not on
 * mere resolution — the mutation resolves on an incomplete drain rather than throwing.
 */
export interface ArchiveAllLoopResult {
  archived: number;
  hasMore: boolean;
  complete: boolean;
}

export interface UseArchiveAllNotificationsOptions {
  userId: string;
  category: string;
  /**
   * App-supplied adapter that archives ONE bounded page of the caller's whole category — typically
   * an `httpsCallable(functions, 'archiveNotification')` invoked with the `{ kind: 'all' }` scope.
   * Returns `{ archived, hasMore }`; the hook re-invokes it while `hasMore` is true. No client
   * Firestore writes.
   */
  archiveAllFn: () => Promise<ArchiveAllResult>;
  invalidateKeys?: readonly unknown[][];
}

// ============================================================================
// COMPONENT PROP TYPES
// ============================================================================

export interface NotificationListProps {
  config: NotificationSystemConfig;
  userId: string;
  category: string;
  onNotificationClick: (notification: NotificationDoc) => void;
  /**
   * Adapter that archives one notification (active → history). Passed straight
   * through to `useArchiveNotification`; the app wires it to its callable.
   */
  archiveFn: (notificationId: string) => Promise<unknown>;
  /**
   * Adapter that archives ONE bounded page of the caller's whole category (returns
   * `{ archived, hasMore }`). Passed straight through to `useArchiveAllNotifications`, which loops
   * it until fully drained; the app wires it to its callable.
   */
  archiveAllFn: () => Promise<ArchiveAllResult>;
  onClearAll?: () => void;
  refetchInterval?: number;
  emptyText?: string;
}

export interface NotificationEmptyStateProps {
  text?: string;
}

export interface NotificationUnreadBadgeProps {
  config: NotificationSystemConfig;
  userId: string;
  category: string;
  refetchInterval?: number;
}
