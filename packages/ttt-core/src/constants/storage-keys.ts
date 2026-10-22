export const REDIRECT_PATH_KEY = 'redirectPath';

export const LS_VERSION_KEY = 'ttt-app-version';

export const SS_RELOAD_ATTEMPTED_KEY = 'ttt-version-reload-attempted';

// Byte-stable with next-themes' default key, so an already-saved theme keeps applying.
export const THEME_STORAGE_KEY = 'theme';

// Byte-stable with what browsers already store: the 'bill' naming must not change.

export const COMPANION_STORAGE_KEY = 'ttt-company-companion';

export const MASCOT_HIDDEN_STORAGE_KEY = 'ttt-bill-hidden';

export const MASCOT_LINE_INDEX_STORAGE_KEY = 'ttt-bill-line-index';

// localStorage 'storage' events do not fire in the writing tab, so each store dispatches its own
// same-tab event.
export const MASCOT_HIDDEN_CHANGE_EVENT = 'ttt-bill-pref-change';

export const COMPANION_CHANGE_EVENT = 'ttt-company-companion-change';

export const MASCOT_POSE_CHANGE_EVENT = 'ttt-bill-pose-change';

export const REDUCED_MOTION_STORAGE_KEY = 'ttt-reduced-motion';

export const REDUCED_MOTION_CHANGE_EVENT = 'ttt-reduced-motion-change';

export const TEXT_SIZE_STORAGE_KEY = 'ttt-text-size';

export const TEXT_SIZE_CHANGE_EVENT = 'ttt-text-size-change';

// Byte-stable with already-stored values: the underscore spelling must not change.
export const COOKIE_CONSENT_STORAGE_KEY = 'ttt_cookie_consent';

export function siteTourPendingStorageKey(uid: string): string {
  return `ttt-site-tour-pending:${uid}`;
}

export const SITE_TOUR_PENDING_CHANGE_EVENT = 'ttt-site-tour-pending-change';
