import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  archiveNotificationHelper,
  archiveAllNotificationsHelper,
} from '../src/server/archiveNotificationHelper';
import type { NotificationSystemConfig, ArchivalInfo } from '../src/types';
import type { ServerFirestore, ServerDocRef, ServerDocSnapshot } from '../src/server/types';

function makeConfig(): NotificationSystemConfig {
  return {
    categories: {
      user: {
        activePath: 'userNotifications',
        historyPath: (userId) => `userNotificationHistory/${userId}/items`,
        audienceType: 'personal',
      },
      admin: {
        activePath: 'adminNotifications',
        historyPath: () => 'adminNotificationHistory',
        audienceType: 'shared',
      },
    },
    types: {},
  };
}

const defaultArchivalInfo: ArchivalInfo = {
  archivedBy: 'user123',
  archivedAt: Date.now(),
  device: 'web',
};

function createMockFirestore(docExists: boolean, docData: Record<string, unknown> = {}) {
  const batchSetCalls: Array<{ ref: ServerDocRef; data: Record<string, unknown> }> = [];
  const batchDeleteCalls: ServerDocRef[] = [];
  const batchCommit = vi.fn(async () => {});

  const batch = {
    set: vi.fn((ref: ServerDocRef, data: Record<string, unknown>) => {
      batchSetCalls.push({ ref, data });
      return {} as any;
    }),
    update: vi.fn(() => ({} as any)),
    delete: vi.fn((ref: ServerDocRef) => {
      batchDeleteCalls.push(ref);
      return {} as any;
    }),
    commit: batchCommit,
  };

  const makeDocRef = (id: string): ServerDocRef => ({
    id,
    set: vi.fn(async () => {}),
    update: vi.fn(async () => {}),
    delete: vi.fn(async () => {}),
    get: vi.fn(async (): Promise<ServerDocSnapshot> => ({
      id,
      exists: docExists,
      data: () => (docExists ? { ...docData } : undefined),
      ref: makeDocRef(id),
    })),
  });

  const db: ServerFirestore = {
    collection: vi.fn((path: string) => ({
      doc: vi.fn((id?: string) => makeDocRef(id ?? 'new-id')),
      add: vi.fn(async () => makeDocRef('auto-id')),
      where: vi.fn(() => ({
        where: vi.fn().mockReturnThis(),
        orderBy: vi.fn().mockReturnThis(),
        limit: vi.fn().mockReturnThis(),
        get: vi.fn(async () => ({ empty: true, docs: [], size: 0 })),
      })),
    })) as any,
    doc: vi.fn((path: string) => {
      const parts = path.split('/');
      const id = parts[parts.length - 1];
      return makeDocRef(id);
    }),
    batch: vi.fn(() => batch),
  };

  return { db, batch, batchSetCalls, batchDeleteCalls, batchCommit };
}

describe('archiveNotificationHelper', () => {
  it('returns { success: true, archived: 0 } for non-existent notification', async () => {
    const { db } = createMockFirestore(false);
    const result = await archiveNotificationHelper(db, makeConfig(), {
      notificationId: 'notif-999',
      category: 'user',
      userId: 'user1',
      archivalInfo: defaultArchivalInfo,
    });
    expect(result).toEqual({ success: true, archived: 0 });
  });

  it('archives existing notification and returns { success: true, archived: 1 }', async () => {
    const { db, batchCommit } = createMockFirestore(true, {
      type: 'content_report',
      count: 1,
    });
    const result = await archiveNotificationHelper(db, makeConfig(), {
      notificationId: 'notif-1',
      category: 'user',
      userId: 'user1',
      archivalInfo: defaultArchivalInfo,
    });
    expect(result).toEqual({ success: true, archived: 1 });
    expect(batchCommit).toHaveBeenCalledTimes(1);
  });

  it('writes to history and deletes from active in a batch', async () => {
    const { db, batch } = createMockFirestore(true, { type: 'content_report' });
    await archiveNotificationHelper(db, makeConfig(), {
      notificationId: 'notif-1',
      category: 'user',
      userId: 'user1',
      archivalInfo: defaultArchivalInfo,
    });
    expect(batch.set).toHaveBeenCalledTimes(1);
    expect(batch.delete).toHaveBeenCalledTimes(1);
  });

  it('throws for unknown category', async () => {
    const { db } = createMockFirestore(true);
    await expect(
      archiveNotificationHelper(db, makeConfig(), {
        notificationId: 'n1',
        category: 'unknown_category',
        userId: 'user1',
        archivalInfo: defaultArchivalInfo,
      })
    ).rejects.toThrow('Unknown category: unknown_category');
  });

  it('includes archival info in history doc', async () => {
    const { db, batch } = createMockFirestore(true, { type: 'content_report', count: 2 });
    await archiveNotificationHelper(db, makeConfig(), {
      notificationId: 'notif-1',
      category: 'user',
      userId: 'user1',
      archivalInfo: defaultArchivalInfo,
    });
    const historyData = (batch.set as ReturnType<typeof vi.fn>).mock.calls[0][1];
    expect(historyData.archival).toEqual(defaultArchivalInfo);
  });

  it('adds handledBy field for shared category', async () => {
    const { db, batch } = createMockFirestore(true, { type: 'admin_report' });
    await archiveNotificationHelper(db, makeConfig(), {
      notificationId: 'admin-1',
      category: 'admin',
      userId: 'user1',
      archivalInfo: { ...defaultArchivalInfo, archivedBy: 'admin-user' },
    });
    const historyData = (batch.set as ReturnType<typeof vi.fn>).mock.calls[0][1];
    expect(historyData.handledBy).toBe('admin-user');
  });

  it('does not add handledBy field for personal category', async () => {
    const { db, batch } = createMockFirestore(true, { type: 'user_notif' });
    await archiveNotificationHelper(db, makeConfig(), {
      notificationId: 'user-1',
      category: 'user',
      userId: 'user1',
      archivalInfo: defaultArchivalInfo,
    });
    const historyData = (batch.set as ReturnType<typeof vi.fn>).mock.calls[0][1];
    expect(historyData.handledBy).toBeUndefined();
  });
});

describe('archiveAllNotificationsHelper', () => {
  it('returns { success: true, archived: 0 } when no active notifications', async () => {
    const { db } = createMockFirestore(false);
    const result = await archiveAllNotificationsHelper(db, makeConfig(), {
      category: 'user',
      userId: 'user1',
      archivalInfo: defaultArchivalInfo,
    });
    expect(result).toEqual({ success: true, archived: 0 });
  });

  it('throws for unknown category', async () => {
    const { db } = createMockFirestore(false);
    await expect(
      archiveAllNotificationsHelper(db, makeConfig(), {
        category: 'bad',
        userId: 'user1',
        archivalInfo: defaultArchivalInfo,
      })
    ).rejects.toThrow('Unknown category: bad');
  });

  it('archives multiple notifications via batch', async () => {
    // Create a firestore mock that returns 2 docs
    const docs = [
      { id: 'n1', exists: true, data: () => ({ type: 'report' }), ref: {} as ServerDocRef },
      { id: 'n2', exists: true, data: () => ({ type: 'report' }), ref: {} as ServerDocRef },
    ];

    let called = 0;
    const batchMock = {
      set: vi.fn(() => ({} as any)),
      update: vi.fn(() => ({} as any)),
      delete: vi.fn(() => ({} as any)),
      commit: vi.fn(async () => {}),
    };

    const db: ServerFirestore = {
      collection: vi.fn(() => ({
        doc: vi.fn(),
        add: vi.fn(),
        where: vi.fn(() => ({
          where: vi.fn().mockReturnThis(),
          orderBy: vi.fn().mockReturnThis(),
          limit: vi.fn().mockReturnThis(),
          get: vi.fn(async () => {
            if (called === 0) {
              called++;
              return { empty: false, docs, size: 2 };
            }
            return { empty: true, docs: [], size: 0 };
          }),
        })),
        orderBy: vi.fn(() => ({
          limit: vi.fn().mockReturnThis(),
          get: vi.fn(async () => {
            if (called === 0) {
              called++;
              return { empty: false, docs, size: 2 };
            }
            return { empty: true, docs: [], size: 0 };
          }),
        })),
      })) as any,
      doc: vi.fn((path: string) => {
        const id = path.split('/').pop() ?? 'id';
        return { id, set: vi.fn(), update: vi.fn(), delete: vi.fn(), get: vi.fn() };
      }),
      batch: vi.fn(() => batchMock),
    };

    const result = await archiveAllNotificationsHelper(db, makeConfig(), {
      category: 'user',
      userId: 'user1',
      archivalInfo: defaultArchivalInfo,
    });

    expect(result.success).toBe(true);
    expect(result.archived).toBe(2);
    expect(batchMock.commit).toHaveBeenCalled();
  });
});
