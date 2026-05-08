import { describe, it, expect, vi } from 'vitest';
import { createContentReportHandler } from '../src/server/createContentReportHandler';
import type { ServerReportCoreConfig } from '../src/server/types';

const TEST_CONFIG: ServerReportCoreConfig = {
  collections: {
    reports: 'contentReports',
    reportGroups: 'activeReportGroups',
    adminTasks: 'adminTasks',
    activityLog: 'adminActivityLog',
  },
  taskQueues: {
    userReport: { defaultCheckoutMinutes: 60, workLaterMinutes: 120, maxWorkLaterMinutes: 480 },
  },
  priorityConfig: {
    reasonScores: { spam: 5, harassment: 10 },
    itemTypeMultipliers: { post: 1.0 },
    additionalReportBonus: 2,
    defaultReasonScore: 3,
    defaultItemTypeMultiplier: 1.0,
  },
};

function createMockDb(existingReportIds: string[] = []) {
  const store = new Map<string, Record<string, unknown>>();
  for (const id of existingReportIds) {
    store.set(`contentReports/${id}`, { reportId: id });
  }

  const sets: Array<{ path: string; data: Record<string, unknown> }> = [];

  const makeRef = (path: string) => ({
    id: path.split('/').pop()!,
    _path: path,
  });

  const transaction = {
    get: vi.fn(async (ref: any) => {
      const path = ref._path;
      const data = store.get(path);
      return { exists: !!data, data: () => data, ref: makeRef(path), id: path.split('/').pop()! };
    }),
    set: vi.fn((ref: any, data: Record<string, unknown>) => {
      sets.push({ path: ref._path, data });
      return transaction;
    }),
    update: vi.fn((_ref: any, _data: Record<string, unknown>) => {
      return transaction;
    }),
  };

  const db = {
    collection: vi.fn((colPath: string) => ({
      doc: vi.fn((id?: string) => makeRef(`${colPath}/${id}`)),
    })),
    runTransaction: vi.fn(async (fn: any) => fn(transaction)),
  } as any;

  return { db, transaction, sets };
}

const BASE_INPUT = {
  reportedItemType: 'post',
  reportedItemId: 'item-1',
  reason: 'spam',
  comment: 'This is spam content',
};

const AUTH_CONTEXT = { uid: 'user-123' };

describe('createContentReportHandler', () => {
  it('factory returns a function', () => {
    const handler = createContentReportHandler({ config: TEST_CONFIG, db: {} as any });
    expect(typeof handler).toBe('function');
  });

  it('creates report doc with correct reportId (uid_itemId), shape, and status=pending_review', async () => {
    const { db, sets } = createMockDb();
    const handler = createContentReportHandler({ config: TEST_CONFIG, db });

    await handler(BASE_INPUT, AUTH_CONTEXT);

    expect(sets).toHaveLength(1);
    const written = sets[0];
    expect(written.path).toBe('contentReports/user-123_item-1');
    expect(written.data.reportId).toBe('user-123_item-1');
    expect(written.data.reporterUserId).toBe('user-123');
    expect(written.data.reportedItemType).toBe('post');
    expect(written.data.reportedItemId).toBe('item-1');
    expect(written.data.reason).toBe('spam');
    expect(written.data.status).toBe('pending_review');
    expect(typeof written.data.createdAt).toBe('number');
  });

  it('throws ALREADY_REPORTED if a doc already exists at that path', async () => {
    const { db } = createMockDb(['user-123_item-1']);
    const handler = createContentReportHandler({ config: TEST_CONFIG, db });

    await expect(handler(BASE_INPUT, AUTH_CONTEXT)).rejects.toThrow('ALREADY_REPORTED');
  });

  it('returns { success: true, reportId } on success', async () => {
    const { db } = createMockDb();
    const handler = createContentReportHandler({ config: TEST_CONFIG, db });

    const result = await handler(BASE_INPUT, AUTH_CONTEXT);

    expect(result).toEqual({ success: true, reportId: 'user-123_item-1' });
  });

  it('trims comment whitespace before storing', async () => {
    const { db, sets } = createMockDb();
    const handler = createContentReportHandler({ config: TEST_CONFIG, db });

    await handler({ ...BASE_INPUT, comment: '  spammy content  ' }, AUTH_CONTEXT);

    expect(sets[0].data.comment).toBe('spammy content');
  });

  it('omits parentItemId and reportedUserId from stored doc when not provided', async () => {
    const { db, sets } = createMockDb();
    const handler = createContentReportHandler({ config: TEST_CONFIG, db });

    await handler(BASE_INPUT, AUTH_CONTEXT);

    expect(sets[0].data).not.toHaveProperty('parentItemId');
    expect(sets[0].data).not.toHaveProperty('reportedUserId');
  });

  it('includes parentItemId and reportedUserId in stored doc when provided', async () => {
    const { db, sets } = createMockDb();
    const handler = createContentReportHandler({ config: TEST_CONFIG, db });

    await handler(
      { ...BASE_INPUT, parentItemId: 'parent-99', reportedUserId: 'reported-user' },
      AUTH_CONTEXT,
    );

    expect(sets[0].data.parentItemId).toBe('parent-99');
    expect(sets[0].data.reportedUserId).toBe('reported-user');
  });

  it('calls onAuditEvent with correct report_created payload when provided', async () => {
    const { db, transaction } = createMockDb();
    const onAuditEvent = vi.fn();
    const handler = createContentReportHandler({ config: TEST_CONFIG, db, onAuditEvent });

    await handler(BASE_INPUT, AUTH_CONTEXT);

    expect(onAuditEvent).toHaveBeenCalledTimes(1);
    expect(onAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'report_created',
        reporterUserId: 'user-123',
        reportedItemType: 'post',
        reportedItemId: 'item-1',
        reason: 'spam',
        reportId: 'user-123_item-1',
        timestamp: expect.any(Number),
      }),
      transaction,
    );
  });

  it('does not call onAuditEvent when not provided', async () => {
    const { db } = createMockDb();
    const onAuditEvent = vi.fn();
    const handler = createContentReportHandler({ config: TEST_CONFIG, db });

    await handler(BASE_INPUT, AUTH_CONTEXT);

    expect(onAuditEvent).not.toHaveBeenCalled();
  });
});
