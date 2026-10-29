import { describe, it, expect } from 'vitest';
import { COLUMN_CATALOG_KEYS } from '../src/sports/column-catalog.js';
import { SPORT_KEYS } from '../src/types/sports.js';
import {
  ADMIN_SIDEBAR_COLLAPSED_CHANGE_EVENT,
  ADMIN_SIDEBAR_COLLAPSED_STORAGE_KEY,
  COOKIE_CONSENT_STORAGE_KEY,
  LS_VERSION_KEY,
  REDUCED_MOTION_CHANGE_EVENT,
  REDUCED_MOTION_STORAGE_KEY,
  SS_RELOAD_ATTEMPTED_KEY,
  STATS_TABLE_VIEW_CHANGE_EVENT,
  STATS_TABLE_VIEW_STORAGE_KEY_PREFIX,
  STAT_QUEUE_STORAGE_KEY_PREFIX,
  THEME_STORAGE_KEY,
  VIEWER_SETTINGS_DISMISSAL_STORAGE_KEY,
  statQueueStorageKey,
  statsTableViewStorageKey,
} from '../src/constants/storage-keys.js';

const STATS_TABLE_VIEW_KEYS = COLUMN_CATALOG_KEYS.flatMap((tableType) =>
  SPORT_KEYS.map((sportKey) => statsTableViewStorageKey(tableType, sportKey)),
);

const STORAGE_KEYS = [
  THEME_STORAGE_KEY,
  REDUCED_MOTION_STORAGE_KEY,
  VIEWER_SETTINGS_DISMISSAL_STORAGE_KEY,
  LS_VERSION_KEY,
  SS_RELOAD_ATTEMPTED_KEY,
  ADMIN_SIDEBAR_COLLAPSED_STORAGE_KEY,
  COOKIE_CONSENT_STORAGE_KEY,
  ...STATS_TABLE_VIEW_KEYS,
  statQueueStorageKey('scorer-1', 'game-1'),
];
const CHANGE_EVENTS = [
  REDUCED_MOTION_CHANGE_EVENT,
  ADMIN_SIDEBAR_COLLAPSED_CHANGE_EVENT,
  STATS_TABLE_VIEW_CHANGE_EVENT,
];

describe('device storage keys', () => {
  it("store the theme under next-themes' default key, where saved themes already live", () => {
    expect(THEME_STORAGE_KEY).toBe('theme');
  });

  it("hold the exact values viewers' saved preferences are stored under", () => {
    expect(REDUCED_MOTION_STORAGE_KEY).toBe('q-sports-reduced-motion');
    expect(REDUCED_MOTION_CHANGE_EVENT).toBe('q-sports-reduced-motion-change');
    expect(VIEWER_SETTINGS_DISMISSAL_STORAGE_KEY).toBe('q-sports-viewer-settings-dismissed');
  });

  it('keep the version the device last loaded under the key it has always used', () => {
    expect(LS_VERSION_KEY).toBe('q-sports-app-version');
    expect(SS_RELOAD_ATTEMPTED_KEY).toBe('q-sports-version-reload-attempted');
  });

  it('hold the admin sidebar, the stats table View state, and the cookie consent under their stored values', () => {
    expect(ADMIN_SIDEBAR_COLLAPSED_STORAGE_KEY).toBe('q-sports-admin-sidebar-collapsed');
    expect(ADMIN_SIDEBAR_COLLAPSED_CHANGE_EVENT).toBe('q-sports-admin-sidebar-collapsed-change');
    expect(STATS_TABLE_VIEW_STORAGE_KEY_PREFIX).toBe('q-sports-stats-table-view');
    expect(STATS_TABLE_VIEW_CHANGE_EVENT).toBe('q-sports-stats-table-view-change');
    expect(COOKIE_CONSENT_STORAGE_KEY).toBe('q-sports-cookie-consent');
  });

  it('key a stats table View state by table type and sport, one key per pair', () => {
    expect(statsTableViewStorageKey('playerTotals', 'basketball')).toBe(
      'q-sports-stats-table-view:playerTotals:basketball',
    );
    expect(new Set(STATS_TABLE_VIEW_KEYS).size).toBe(
      COLUMN_CATALOG_KEYS.length * SPORT_KEYS.length,
    );
  });

  it("key a scorer's stat queue by the account and the game, so no other account or game meets it", () => {
    expect(statQueueStorageKey('scorer-1', 'game-1')).toBe(
      `${STAT_QUEUE_STORAGE_KEY_PREFIX}:scorer-1:game-1`,
    );
    expect(STAT_QUEUE_STORAGE_KEY_PREFIX).toBe('q-sports-stat-queue');
    const keys = [
      statQueueStorageKey('scorer-1', 'game-1'),
      statQueueStorageKey('scorer-2', 'game-1'),
      statQueueStorageKey('scorer-1', 'game-2'),
    ];
    expect(new Set(keys).size).toBe(keys.length);
  });

  it('keep every preference and every change event independent of the others', () => {
    expect(new Set(STORAGE_KEYS).size).toBe(STORAGE_KEYS.length);
    expect(new Set(CHANGE_EVENTS).size).toBe(CHANGE_EVENTS.length);
    for (const event of CHANGE_EVENTS) expect(STORAGE_KEYS).not.toContain(event);
  });

  it('carry no ttt name (RULE-STD-ARCH-006)', () => {
    for (const value of [...STORAGE_KEYS, ...CHANGE_EVENTS]) expect(value).not.toMatch(/ttt/i);
  });
});
