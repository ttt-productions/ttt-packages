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

  it('realm-file share cards route by side: the request to the Realm, the resolution by outcome', () => {
    const requestTarget = TTT_NOTIFICATION_CONFIG.types.realm_file_share_requested
      .defaultTargetPath as (meta: Record<string, unknown>) => string;
    expect(requestTarget({ workRealmId: 'realm1', workProjectId: 'wp1' })).toBe(
      '/work-realms/realm1',
    );

    const resolvedTarget = TTT_NOTIFICATION_CONFIG.types.realm_file_share_resolved
      .defaultTargetPath as (meta: Record<string, unknown>) => string;
    // approved/declined reach the REQUESTER → the Work, where the file and its state live.
    expect(resolvedTarget({ workRealmId: 'realm1', workProjectId: 'wp1', resolution: 'approved' })).toBe(
      '/work-projects/wp1',
    );
    expect(resolvedTarget({ workRealmId: 'realm1', workProjectId: 'wp1', resolution: 'declined' })).toBe(
      '/work-projects/wp1',
    );
    // withdrawn reaches the STEWARD → the Realm, where the now-stale queue card was.
    expect(resolvedTarget({ workRealmId: 'realm1', workProjectId: 'wp1', resolution: 'withdrawn' })).toBe(
      '/work-realms/realm1',
    );
  });

  it('realm-file share copy carries no name/title snapshot (identities resolve at render)', () => {
    for (const type of ['realm_file_share_requested', 'realm_file_share_resolved'] as const) {
      const entry = TTT_NOTIFICATION_CONFIG.types[type];
      const meta = {
        workRealmId: 'realm1',
        workProjectId: 'wp1',
        mediaAssetId: 'asset1',
        workFileId: 'file1',
        requestId: 'req1',
        requestedByUid: 'admin1',
        resolution: 'approved' as const,
      };
      const title = entry.titlePattern(meta);
      const message = entry.messagePattern(meta, 1);
      for (const text of [title, message]) {
        for (const id of ['realm1', 'wp1', 'asset1', 'file1', 'req1', 'admin1']) {
          expect(text, `${type}: copy must not embed ${id}`).not.toContain(id);
        }
      }
    }
  });

  it('each realm-file resolution outcome produces its own distinct message', () => {
    const entry = TTT_NOTIFICATION_CONFIG.types.realm_file_share_resolved;
    const messages = (['approved', 'declined', 'withdrawn'] as const).map((resolution) =>
      entry.messagePattern({ requestId: 'req1', resolution }, 1),
    );
    expect(new Set(messages).size).toBe(3);
  });

  it('realm-file cards dedup on the REQUEST id, in separate type-scoped namespaces', () => {
    const requested = TTT_NOTIFICATION_CONFIG.types.realm_file_share_requested;
    const resolved = TTT_NOTIFICATION_CONFIG.types.realm_file_share_resolved;
    const requestedKey = requested.dedupKeyPattern({ requestId: 'req1' });
    const resolvedKey = resolved.dedupKeyPattern({ requestId: 'req1' });
    expect(requestedKey).toContain('req1');
    expect(resolvedKey).toContain('req1');
    // Same occurrence identity, different cards — they must never collapse into one.
    expect(requestedKey).not.toBe(resolvedKey);
    // A re-request after a decline is a NEW card, not a relight of the resolved one.
    expect(requested.dedupKeyPattern({ requestId: 'req2' })).not.toBe(requestedKey);
    // One occurrence per request, forever.
    expect(requested.countCap).toBe(1);
    expect(resolved.countCap).toBe(1);
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
