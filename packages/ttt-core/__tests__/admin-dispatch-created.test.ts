import { describe, it, expect } from 'vitest';
import {
  NOTIFICATION_TYPE_CATALOG,
  validateNotificationMetadata,
} from '../src/schemas/notification';
import { TTT_NOTIFICATION_CONFIG } from '../src/notifications';

const config = TTT_NOTIFICATION_CONFIG.types.admin_dispatch_created;

describe('the first message of an admin-started thread notifies its readers', () => {
  it('is a user-tray type delivered in real time, like a reply', () => {
    expect(NOTIFICATION_TYPE_CATALOG.admin_dispatch_created).toEqual({
      category: 'user',
      delivery: 'realtime',
      defaultChannels: ['inApp'],
    });
  });

  it('reads "Admin Message" / "An admin has created a new thread message" for user and Work threads alike', () => {
    for (const meta of [
      { adminDispatchId: 'd1', partyKind: 'user' },
      { adminDispatchId: 'd1', partyKind: 'workProject', workProjectId: 'w1' },
    ]) {
      expect(config.titlePattern(meta)).toBe('Admin Message');
      expect(config.messagePattern(meta, 1)).toBe('An admin has created a new thread message');
    }
  });

  it('opens the Work for a Work thread and Messages for a user thread', () => {
    const target = config.defaultTargetPath as (meta: Record<string, unknown>) => string;
    expect(target({ adminDispatchId: 'd1', partyKind: 'workProject', workProjectId: 'w1' })).toBe('/work-projects/w1');
    expect(target({ adminDispatchId: 'd1', partyKind: 'user' })).toBe('/messages');
  });

  it('carries the thread id and its party kind', () => {
    expect(() =>
      validateNotificationMetadata('admin_dispatch_created', { adminDispatchId: 'd1', partyKind: 'user' }),
    ).not.toThrow();
    expect(() => validateNotificationMetadata('admin_dispatch_created', { adminDispatchId: 'd1' })).toThrow();
    expect(() =>
      validateNotificationMetadata('admin_dispatch_created', { adminDispatchId: 'd1', partyKind: 'user', title: 'x' }),
    ).toThrow();
  });
});
