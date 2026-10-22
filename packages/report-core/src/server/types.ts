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
  startAfter(snapshot: ServerDocSnapshot): ServerQuery;
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

export type ReportCoreAuditEvent =
  | {
      action: 'checkout';
      adminUserId: string;
      taskType: string;
      taskId: string;
      timestamp: number;
    }
  | {
      action: 'auto_released';
      adminUserId: string;
      priorAdminUserId: string;
      taskType: string;
      taskId: string;
      timestamp: number;
    }
  | {
      action: 'checkin_resolved' | 'checkin_unresolved';
      adminUserId: string;
      taskType: string;
      taskId: string;
      timestamp: number;
      resolution: string | null;
      timeSpentMinutes: number;
    }
  | {
      action: 'release';
      adminUserId: string;
      taskType: string;
      taskId: string;
      timestamp: number;
    }
  | {
      action: 'checkout_next_important';
      adminUserId: string;
      taskType: string;
      taskId: string;
      priority: number;
      timestamp: number;
    };

/** Runs after the handler's transactional reads; a read on `transaction` here would come after a write. */
export type OnAuditEvent = (
  event: ReportCoreAuditEvent,
  transaction: ServerTransaction,
) => void | Promise<void>;

export type TaskClaimVerdict = { claimable: true } | { claimable: false; message: string };

export type TaskClaimGuard = (args: {
  taskDocId: string;
  taskData: Record<string, unknown>;
  originalData: Record<string, unknown> | null;
  transaction: ServerTransaction;
}) => Promise<TaskClaimVerdict>;

export interface AdminAuthConfig {
  requireAdmin?: (uid: string, authToken: unknown) => Promise<void>;
  adminUserIds?: string[];
}

export interface ServerReportCoreConfig {
  collections: {
    reports: string;
    reportGroups: string;
    adminTasks: string;
  };
  taskQueues: Record<
    string,
    {
      defaultCheckoutMinutes: number;
      workLaterMinutes: number;
      maxWorkLaterMinutes: number;
    }
  >;
  priorityConfig: {
    reasonScores: Record<string, number>;
    itemTypeMultipliers: Record<string, number>;
    additionalReportBonus: number;
    defaultReasonScore: number;
    defaultItemTypeMultiplier: number;
  };
}
