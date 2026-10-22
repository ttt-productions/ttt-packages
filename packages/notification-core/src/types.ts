export interface NotificationDoc {
  id: string;
  type: string;
  dedupKey: string;
  category: string;

  targetUserId: string | null;

  title: string;
  message: string;

  count: number;
  latestActorIds: string[];

  targetPath?: string;
  metadata: Record<string, unknown>;

  /** `0` when unseen and never absent: a `count()` equality predicate cannot match a missing field. */
  seenAt: number;

  activityGeneration?: string;
  seenAtGeneration?: string;

  createdAt: number;
  updatedAt: number;
}

export interface PendingNotification {
  id: string;
  type: string;
  category: string;
  targetUserId: string | null;
  actorId: string;
  metadata: Record<string, unknown>;
  createdAt: number;
}

export interface NotificationCategoryConfig {
  activePath: string;
  historyPath: (userId?: string) => string;
  audienceType: 'personal' | 'shared';
}

export interface NotificationTypeConfig {
  category: string;
  delivery: 'realtime' | 'queued';
  dedupKeyPattern: (metadata: Record<string, unknown>) => string;
  titlePattern: (metadata: Record<string, unknown>) => string;
  messagePattern: (metadata: Record<string, unknown>, count: number) => string;
  defaultTargetPath?: string | ((metadata: Record<string, unknown>) => string);
  countCap?: number;
  actorCap?: number;
  icon?: string;
}

export interface NotificationSystemConfig {
  categories: Record<string, NotificationCategoryConfig>;
  types: Record<string, NotificationTypeConfig>;
  batchIntervalMinutes?: number;
  pendingCollectionPath?: string;
  deliveriesCollectionPath?: string;
  /** Required by the ledger: Firestore TTL acts only on `Timestamp` fields, never a number. */
  timestampFromMillis?: (ms: number) => unknown;
  deliveryTtlMs?: number;
  maxDeliveryAttempts?: number;
}

export interface UseActiveNotificationsOptions {
  config: NotificationSystemConfig;
  userId: string;
  category: string;
  enabled?: boolean;
  pageSize?: number;
  refetchInterval?: number;
  staleTime?: number;
}

export interface NotificationHistoryItem extends NotificationDoc {
  archiveOccurrenceId: string;
  archivedAt: number;
}

export interface UseNotificationHistoryOptions {
  config: NotificationSystemConfig;
  userId: string;
  category: string;
  enabled?: boolean;
  pageSize?: number;
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

export interface NotificationArchiveResult {
  archived: boolean;
}

export type NotificationArchiveFn = (
  notification: NotificationDoc,
) => Promise<NotificationArchiveResult>;

export interface UseArchiveNotificationOptions {
  userId: string;
  category: string;
  archiveFn: NotificationArchiveFn;
  invalidateKeys?: readonly unknown[][];
}

export type ArchiveAllJobStatus =
  'idle' | 'enqueuing' | 'in-progress' | 'complete' | 'incomplete' | 'failed';

export interface EnqueueArchiveAllResult {
  jobId: string;
}

export interface ArchiveAllJobSnapshot {
  state: 'in-progress' | 'complete' | 'incomplete' | 'failed';
  category: string;
  archived?: number;
  notArchived?: number;
  error?: string;
}

export interface ArchiveAllPollResult {
  status: Extract<ArchiveAllJobStatus, 'complete' | 'incomplete' | 'failed'>;
  category: string;
  archived: number;
  notArchived: number;
  complete: boolean;
  error?: string;
}

export interface UseArchiveAllNotificationsOptions {
  userId: string;
  category: string;
  enqueueArchiveAllFn: (category: string) => Promise<EnqueueArchiveAllResult>;
  getArchiveAllStatusFn: (jobId: string) => Promise<ArchiveAllJobSnapshot>;
  pollIntervalMs?: number;
  maxPolls?: number;
  invalidateKeys?: readonly unknown[][];
}

export interface NotificationRowActions {
  archive?: () => Promise<void>;
  isArchivePending?: boolean;
}

export interface NotificationListErrorState {
  error: Error;
  retry: () => void;
  retrying: boolean;
  hasRows: boolean;
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
