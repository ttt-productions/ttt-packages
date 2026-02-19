/**
 * Server-side types for report-core backend helpers.
 * These abstract firebase-admin so the package doesn't import it directly.
 */

export interface ServerFirestore {
  collection(path: string): ServerCollectionRef;
  doc(path: string): ServerDocRef;
  batch(): ServerWriteBatch;
  runTransaction<T>(fn: (transaction: ServerTransaction) => Promise<T>): Promise<T>;
}

export interface ServerCollectionRef {
  doc(id?: string): ServerDocRef;
  where(field: string, op: string, value: unknown): ServerQuery;
  orderBy(field: string, direction?: 'asc' | 'desc'): ServerQuery;
  limit(n: number): ServerQuery;
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
  set(data: Record<string, unknown>): Promise<unknown>;
  update(data: Record<string, unknown>): Promise<unknown>;
  get(): Promise<ServerDocSnapshot>;
}

export interface ServerWriteBatch {
  set(ref: ServerDocRef, data: Record<string, unknown>): ServerWriteBatch;
  update(ref: ServerDocRef, data: Record<string, unknown>): ServerWriteBatch;
  commit(): Promise<unknown>;
}

export interface ServerTransaction {
  get(ref: ServerDocRef): Promise<ServerDocSnapshot>;
  get(query: ServerQuery): Promise<ServerQuerySnapshot>;
  set(ref: ServerDocRef, data: Record<string, unknown>): ServerTransaction;
  update(ref: ServerDocRef, data: Record<string, unknown>): ServerTransaction;
}

export interface ServerFieldValue {
  increment(n: number): unknown;
}

/**
 * Admin auth config for backend factories.
 * At least one of requireAdmin or adminUserIds must be provided.
 */
export interface AdminAuthConfig {
  /** Primary check — async function, should throw if not admin. */
  requireAdmin?: (uid: string, authToken: unknown) => Promise<void>;
  /** Fallback — hardcoded admin UIDs. Checked if requireAdmin not provided or throws. */
  adminUserIds?: string[];
}

/**
 * Base config passed to all server factory functions.
 */
export interface ServerReportCoreConfig {
  collections: {
    reports: string;
    reportGroups: string;
    adminTasks: string;
    activityLog: string;
  };
  taskQueues: Record<string, {
    defaultCheckoutMinutes: number;
    workLaterMinutes: number;
    maxWorkLaterMinutes: number;
  }>;
  priorityConfig: {
    reasonScores: Record<string, number>;
    itemTypeMultipliers: Record<string, number>;
    additionalReportBonus: number;
    defaultReasonScore: number;
    defaultItemTypeMultiplier: number;
  };
}
