// Browser-storage keys, each declared once with the same-tab event its writer dispatches: a
// localStorage write fires the native `storage` event in every other tab but never in the tab that
// wrote it. Every value is persisted on viewers' devices, so changing one forgets what they saved.

import type { ColumnCatalogKey } from '../sports/column-catalog.js';
import type { SportKey } from '../types/sports.js';

/**
 * localStorage key holding the device's theme. It is `next-themes`' default key, the one viewers'
 * saved themes are stored under.
 */
export const THEME_STORAGE_KEY = 'theme';

/** localStorage key: `'true'` when the viewer has turned motion down on this device. */
export const REDUCED_MOTION_STORAGE_KEY = 'q-sports-reduced-motion';

/** Same-tab event dispatched when REDUCED_MOTION_STORAGE_KEY changes. */
export const REDUCED_MOTION_CHANGE_EVENT = 'q-sports-reduced-motion-change';

/**
 * localStorage key holding the differences between this device's settings and the account's that
 * the viewer chose to keep, so the compare prompt does not ask about them again while they hold.
 */
export const VIEWER_SETTINGS_DISMISSAL_STORAGE_KEY = 'q-sports-viewer-settings-dismissed';

/**
 * localStorage key holding the `_appConfig/app` version this device last loaded. Written only once
 * a load has confirmed it, so a release that never landed is retried next session.
 */
export const LS_VERSION_KEY = 'q-sports-app-version';

/**
 * sessionStorage key naming the version the version gate last reloaded for. It is what tells the
 * load after that reload apart from a mismatch still to act on, so a stuck release cannot hold a
 * tab in a reload loop; a new tab starts without it and tries again.
 */
export const SS_RELOAD_ATTEMPTED_KEY = 'q-sports-version-reload-attempted';

/** localStorage key: `'true'` while the admin sidebar is collapsed to its icon rail on this device. */
export const ADMIN_SIDEBAR_COLLAPSED_STORAGE_KEY = 'q-sports-admin-sidebar-collapsed';

/** Same-tab event dispatched when ADMIN_SIDEBAR_COLLAPSED_STORAGE_KEY changes. */
export const ADMIN_SIDEBAR_COLLAPSED_CHANGE_EVENT = 'q-sports-admin-sidebar-collapsed-change';

/** The prefix every stats table View-state key starts with; `statsTableViewStorageKey` adds the rest. */
export const STATS_TABLE_VIEW_STORAGE_KEY_PREFIX = 'q-sports-stats-table-view';

/**
 * localStorage key holding one stats table's View state on this device — its preset or Custom layout,
 * its sort, and its switches — for one table type of one sport: `{prefix}:{tableType}:{sportKey}`.
 */
export function statsTableViewStorageKey(tableType: ColumnCatalogKey, sportKey: SportKey): string {
  return `${STATS_TABLE_VIEW_STORAGE_KEY_PREFIX}:${tableType}:${sportKey}`;
}

/** Same-tab event dispatched when any stats table View-state key changes. */
export const STATS_TABLE_VIEW_CHANGE_EVENT = 'q-sports-stats-table-view-change';

/** The prefix every scorer's stat-queue key starts with; `statQueueStorageKey` adds the rest. */
export const STAT_QUEUE_STORAGE_KEY_PREFIX = 'q-sports-stat-queue';

/**
 * localStorage key holding one scorer's unsent and refused stat events for one game on this device —
 * `{prefix}:{uid}:{gameId}` — so a reload loses nothing, and another account signed in on the same
 * browser never sends or sees them.
 */
export function statQueueStorageKey(uid: string, gameId: string): string {
  return `${STAT_QUEUE_STORAGE_KEY_PREFIX}:${uid}:${gameId}`;
}

/**
 * localStorage key, and the first-party cookie's name, holding this browser's analytics consent:
 * `'granted'` or `'denied'`; absent until the visitor chooses.
 */
export const COOKIE_CONSENT_STORAGE_KEY = 'q-sports-cookie-consent';
