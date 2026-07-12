// The unified TTT notification config (the ONE cross-boundary source both the
// ttt-prod tray and the Cloud Functions delivery engine import). These tests
// pin the anti-drift contract: complete type coverage, catalog agreement, and
// the linkless rule (a type with no meaningful destination declares NO
// defaultTargetPath — never '/' as a pseudo-target).

import { describe, it, expect } from 'vitest';
import { TTT_NOTIFICATION_CONFIG } from '../src/notifications/index.js';
import {
  NOTIFICATION_TYPE_VALUES,
  NOTIFICATION_TYPE_CATALOG,
} from '../src/schemas/notification.js';
import { COLLECTIONS } from '../src/paths/collections.js';

// The deliberately linkless types: informational-only cards, clear-only rows.
const LINKLESS_TYPES = ['report_action_taken', 'admin_announcement'] as const;

describe('TTT_NOTIFICATION_CONFIG', () => {
  it('has a config entry for every canonical notification type, and no extras', () => {
    expect(Object.keys(TTT_NOTIFICATION_CONFIG.types).sort()).toEqual(
      [...NOTIFICATION_TYPE_VALUES].sort(),
    );
  });

  it('category and delivery of every entry match NOTIFICATION_TYPE_CATALOG', () => {
    for (const type of NOTIFICATION_TYPE_VALUES) {
      const entry = TTT_NOTIFICATION_CONFIG.types[type];
      expect(entry.category, type).toBe(NOTIFICATION_TYPE_CATALOG[type].category);
      expect(entry.delivery, type).toBe(NOTIFICATION_TYPE_CATALOG[type].delivery);
    }
  });

  it('linkless types declare NO defaultTargetPath (clear-only rows)', () => {
    for (const type of LINKLESS_TYPES) {
      expect(TTT_NOTIFICATION_CONFIG.types[type].defaultTargetPath, type).toBeUndefined();
    }
  });

  it("every other type has a defaultTargetPath, and never the '/' pseudo-target", () => {
    for (const type of NOTIFICATION_TYPE_VALUES) {
      if ((LINKLESS_TYPES as readonly string[]).includes(type)) continue;
      const target = TTT_NOTIFICATION_CONFIG.types[type].defaultTargetPath;
      expect(target, type).toBeDefined();
      if (typeof target === 'string') {
        expect(target, type).not.toBe('/');
      }
    }
  });

  it('admin_dispatch_reply routes work-party threads to the Work and user threads to /messages', () => {
    const target = TTT_NOTIFICATION_CONFIG.types.admin_dispatch_reply.defaultTargetPath;
    expect(typeof target).toBe('function');
    const fn = target as (meta: Record<string, unknown>) => string;
    expect(fn({ partyKind: 'workProject', workProjectId: 'wp1' })).toBe('/work-projects/wp1');
    expect(fn({ adminDispatchId: 'd1' })).toBe('/messages');
  });

  it('hall_content_change_request_resolved routes the realm grain to the realm page, hall grains to the Work', () => {
    const target = TTT_NOTIFICATION_CONFIG.types.hall_content_change_request_resolved.defaultTargetPath;
    expect(typeof target).toBe('function');
    const fn = target as (meta: Record<string, unknown>) => string;
    expect(fn({ workProjectId: 'wp1', workRealmId: 'realm1' })).toBe('/work-realms/realm1');
    expect(fn({ workProjectId: 'wp1', workRealmId: null })).toBe('/work-projects/wp1');
    expect(fn({ workProjectId: 'wp1' })).toBe('/work-projects/wp1');
  });

  it('category collection paths come from COLLECTIONS', () => {
    expect(TTT_NOTIFICATION_CONFIG.categories.user.activePath).toBe(
      COLLECTIONS.ACTIVE_USER_NOTIFICATIONS,
    );
    expect(TTT_NOTIFICATION_CONFIG.categories.user.historyPath('u1')).toBe(
      `${COLLECTIONS.USER_PROFILES}/u1/notificationHistory`,
    );
    expect(TTT_NOTIFICATION_CONFIG.categories.admin.activePath).toBe(
      COLLECTIONS.ACTIVE_ADMIN_NOTIFICATIONS,
    );
    expect(TTT_NOTIFICATION_CONFIG.categories.admin.historyPath()).toBe(
      COLLECTIONS.ADMIN_NOTIFICATION_HISTORY,
    );
    expect(TTT_NOTIFICATION_CONFIG.pendingCollectionPath).toBe(COLLECTIONS.PENDING_NOTIFICATIONS);
    expect(TTT_NOTIFICATION_CONFIG.deliveriesCollectionPath).toBe(
      COLLECTIONS.NOTIFICATION_DELIVERIES,
    );
  });

  it('carries no timestampFromMillis — the backend wrapper injects it (firebase-admin)', () => {
    expect(TTT_NOTIFICATION_CONFIG.timestampFromMillis).toBeUndefined();
  });
});
