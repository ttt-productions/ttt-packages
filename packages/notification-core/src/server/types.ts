/**
 * Server-side types for notification-core backend helpers.
 * These use firebase-admin Firestore types passed in by the calling app.
 */

/**
 * Firestore interface — matches firebase-admin's Firestore type.
 * We accept this instead of importing firebase-admin directly.
 */
export interface ServerFirestore {
  collection(path: string): ServerCollectionRef;
  doc(path: string): ServerDocRef;
  batch(): ServerWriteBatch;
}

export interface ServerCollectionRef {
  doc(id?: string): ServerDocRef;
  where(field: string, op: string, value: unknown): ServerQuery;
  orderBy(field: string, direction?: 'asc' | 'desc'): ServerQuery;
  limit(n: number): ServerQuery;
  add(data: Record<string, unknown>): Promise<ServerDocRef>;
}

export interface ServerQuery {
  where(field: string, op: string, value: unknown): ServerQuery;
  orderBy(field: string, direction?: 'asc' | 'desc'): ServerQuery;
  limit(n: number): ServerQuery;
  get(): Promise<ServerQuerySnapshot>;
}

export interface ServerQuerySnapshot {
  empty: boolean;
  size: number;
  docs: ServerDocSnapshot[];
}

export interface ServerDocSnapshot {
  id: string;
  exists: boolean;
  data(): Record<string, unknown> | undefined;
  ref: ServerDocRef;
}

export interface ServerDocRef {
  id: string;
  set(data: Record<string, unknown>, options?: { merge?: boolean }): Promise<unknown>;
  update(data: Record<string, unknown>): Promise<unknown>;
  delete(): Promise<unknown>;
  get(): Promise<ServerDocSnapshot>;
}

export interface ServerWriteBatch {
  set(ref: ServerDocRef, data: Record<string, unknown>, options?: { merge?: boolean }): ServerWriteBatch;
  update(ref: ServerDocRef, data: Record<string, unknown>): ServerWriteBatch;
  delete(ref: ServerDocRef): ServerWriteBatch;
  commit(): Promise<unknown>;
}

/**
 * Input for creating a notification via the helper.
 */
export interface CreateNotificationInput {
  /** Notification type (must exist in config.types) */
  type: string;
  /** Actor who triggered this notification */
  actorId: string;
  /** Actor display name */
  actorName: string;
  /** Target user ID (required for 'personal' audience types) */
  targetUserId?: string | null;
  /** Type-specific metadata */
  metadata: Record<string, unknown>;
}

/**
 * Return type from createNotificationHelper factory.
 */
export interface NotificationHelper {
  /** Send a notification using the configured delivery mode (realtime or queued) */
  send(input: CreateNotificationInput): Promise<void>;
  /** Send immediately (bypass queue, write directly to active collection) */
  sendRealTime(input: CreateNotificationInput): Promise<void>;
  /** Queue for batch processing */
  queueForBatch(input: CreateNotificationInput): Promise<void>;
}
