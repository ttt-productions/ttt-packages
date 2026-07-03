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

/**
 * A flattened archived-history item for the read surface. The history doc is a
 * wrapper (`archivedSnapshot` + archive metadata + TTL); this shape lifts the
 * snapshot's display fields to the top level so the history list renders exactly
 * like the active list, plus `archivedAt` for ordering/display and
 * `archiveOccurrenceId` as the stable React key.
 */
export interface NotificationHistoryItem extends NotificationDoc {
  /** The history doc id (stable key — the `archiveOccurrenceId`). */
  archiveOccurrenceId: string;
  /** Epoch ms the notification was archived (history docs order by this). */
  archivedAt: number;
}

export interface UseNotificationHistoryOptions {
  config: NotificationSystemConfig;
  userId: string;
  category: string;
  enabled?: boolean;
  pageSize?: number;
  /** Read-freshness stale time in ms (archived rows are immutable; default 60s). */
  staleTime?: number;
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

// ----------------------------------------------------------------------------
// Archive-all — server-owned job + thin client status poller
// ----------------------------------------------------------------------------
//
// Archive-all is NOT a browser loop. The client enqueues ONE server-owned
// archive-all job (scoped to a single notification category/tab), then polls its
// status until the job reaches a terminal state. All paging + ownership-checked
// per-card deletion happen server-side in a bounded scheduled/queued worker; the
// hook never touches Firestore and never chains archive calls. The generic
// package hardcodes NO callable name — the app injects both adapters below.

/**
 * Terminal + transient states of a server-owned archive-all job, as surfaced to the UI.
 *
 * - `idle`        — nothing enqueued yet (initial / reset state).
 * - `enqueuing`   — the enqueue adapter is in flight (job not yet acknowledged).
 * - `in-progress` — the job is enqueued/running; the worker is still draining the category.
 * - `complete`    — TERMINAL: the worker fully drained the category's active set.
 * - `incomplete`  — TERMINAL: the job stopped without draining everything (e.g. hit its own
 *                   bound / a non-advanceable card). The tray keeps a "some remain — try again"
 *                   affordance, mirroring the old loop's incomplete result.
 * - `failed`      — TERMINAL: the enqueue call threw, or the job dead-lettered / reported failure.
 */
export type ArchiveAllJobStatus =
  | 'idle'
  | 'enqueuing'
  | 'in-progress'
  | 'complete'
  | 'incomplete'
  | 'failed';

/**
 * Result of the INJECTED enqueue adapter — triggers exactly one server-owned archive-all job for
 * the given category and returns immediately with the job's id (idempotent per user+category+request
 * on the app side). The app wires this to its `httpsCallable(functions, 'enqueueArchiveAll')`
 * (or equivalent); the generic package never names the callable.
 */
export interface EnqueueArchiveAllResult {
  /** Server job id the poller then polls via the status adapter. */
  jobId: string;
}

/**
 * Snapshot of a server-owned archive-all job, returned by the INJECTED status-query adapter.
 * The poller maps `state` → {@link ArchiveAllJobStatus} and stops polling on any terminal state.
 * `category` echoes the tab/category the job was enqueued for so the UI can assert per-tab scoping.
 */
export interface ArchiveAllJobSnapshot {
  /** Job lifecycle state as owned by the server worker. */
  state: 'in-progress' | 'complete' | 'incomplete' | 'failed';
  /** The notification category/tab this job is scoped to (must match the enqueue category). */
  category: string;
  /** Cards archived so far (monotonic); optional progress for the UI. */
  archived?: number;
  /** Human-readable failure reason when `state === 'failed'` (optional). */
  error?: string;
}

/**
 * Aggregate result the poller resolves with once the job reaches a terminal state.
 * `complete` is the load-bearing completion contract (true ONLY when the whole category was
 * drained), preserved from the old loop so callers gate side effects the same way.
 */
export interface ArchiveAllPollResult {
  status: Extract<ArchiveAllJobStatus, 'complete' | 'incomplete' | 'failed'>;
  category: string;
  archived: number;
  complete: boolean;
  error?: string;
}

export interface UseArchiveAllNotificationsOptions {
  userId: string;
  category: string;
  /**
   * App-supplied adapter that ENQUEUES one server-owned archive-all job scoped to `category` and
   * returns its `jobId`. The `category` is passed so the app callable can carry the tab/source into
   * the job (per-tab scoping is REQUIRED — the worker archives only that category's active cards).
   * Typically `(category) => enqueueArchiveAll({ category })` over an `httpsCallable`.
   */
  enqueueArchiveAllFn: (category: string) => Promise<EnqueueArchiveAllResult>;
  /**
   * App-supplied adapter that returns the current {@link ArchiveAllJobSnapshot} for a job id — the
   * hook polls it until the job reaches a terminal state. Typically
   * `(jobId) => getArchiveAllStatus({ jobId })` over an `httpsCallable`, or a Firestore read of the
   * job doc. No client Firestore writes.
   */
  getArchiveAllStatusFn: (jobId: string) => Promise<ArchiveAllJobSnapshot>;
  /** Poll interval in ms while the job is in-progress (default 1500). */
  pollIntervalMs?: number;
  /**
   * Max number of status polls before the poller gives up and resolves `incomplete` (guards a job
   * that never reaches a terminal state — default 120, i.e. ~3 min at the default interval).
   */
  maxPolls?: number;
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
   * Adapter that ENQUEUES one server-owned archive-all job scoped to `category` and returns its
   * `jobId`. Passed straight through to `useArchiveAllNotifications`; the app wires it to its
   * enqueue callable. Per-tab scoping: the category flows through to the job.
   */
  enqueueArchiveAllFn: (category: string) => Promise<EnqueueArchiveAllResult>;
  /**
   * Adapter that returns the current status snapshot for an archive-all `jobId`. Passed straight
   * through to `useArchiveAllNotifications`, which polls it until the job is terminal; the app wires
   * it to its status callable / job-doc read.
   */
  getArchiveAllStatusFn: (jobId: string) => Promise<ArchiveAllJobSnapshot>;
  onClearAll?: () => void;
  refetchInterval?: number;
  emptyText?: string;
}

export interface NotificationHistoryListProps {
  config: NotificationSystemConfig;
  userId: string;
  category: string;
  /**
   * Optional click handler for an archived row (e.g. navigate to `targetPath`).
   * Archived rows are read-only — there is no re-archive; the row does not mutate
   * state on click. Omit to render non-interactive rows.
   */
  onNotificationClick?: (notification: NotificationHistoryItem) => void;
  pageSize?: number;
  staleTime?: number;
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
