import type { ColumnCatalogKey } from '../sports/column-catalog.js';
import type { SportKey } from '../types/sports.js';

export const THEME_STORAGE_KEY = 'theme';

export const REDUCED_MOTION_STORAGE_KEY = 'q-sports-reduced-motion';

export const REDUCED_MOTION_CHANGE_EVENT = 'q-sports-reduced-motion-change';

export const VIEWER_SETTINGS_DISMISSAL_STORAGE_KEY = 'q-sports-viewer-settings-dismissed';

export const LS_VERSION_KEY = 'q-sports-app-version';

export const SS_RELOAD_ATTEMPTED_KEY = 'q-sports-version-reload-attempted';

export const ADMIN_SIDEBAR_COLLAPSED_STORAGE_KEY = 'q-sports-admin-sidebar-collapsed';

export const ADMIN_SIDEBAR_COLLAPSED_CHANGE_EVENT = 'q-sports-admin-sidebar-collapsed-change';

export const STATS_TABLE_VIEW_STORAGE_KEY_PREFIX = 'q-sports-stats-table-view';

export function statsTableViewStorageKey(tableType: ColumnCatalogKey, sportKey: SportKey): string {
  return `${STATS_TABLE_VIEW_STORAGE_KEY_PREFIX}:${tableType}:${sportKey}`;
}

export const STATS_TABLE_VIEW_CHANGE_EVENT = 'q-sports-stats-table-view-change';

export const STAT_QUEUE_STORAGE_KEY_PREFIX = 'q-sports-stat-queue';

export function statQueueStorageKey(uid: string, gameId: string): string {
  return `${STAT_QUEUE_STORAGE_KEY_PREFIX}:${uid}:${gameId}`;
}

export const COOKIE_CONSENT_STORAGE_KEY = 'q-sports-cookie-consent';

export const COOKIE_CONSENT_CHANGE_EVENT = 'q-sports-cookie-consent-change';
