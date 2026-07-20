// Well-known keys used in browser sessionStorage / localStorage.

/** sessionStorage key holding the path the user wanted before being redirected to login. */
export const REDIRECT_PATH_KEY = 'redirectPath';

/** localStorage key holding the last-seen app version (used by version-gate component). */
export const LS_VERSION_KEY = 'ttt-app-version';

/** sessionStorage key marking that a version-mismatch reload was already attempted. */
export const SS_RELOAD_ATTEMPTED_KEY = 'ttt-version-reload-attempted';

// --- Company / Green Room dock companion (device-local v1 stores) ---
// Values are byte-stable for backward compatibility — the historical 'bill'
// naming predates the Company rename and MUST NOT change.

/** localStorage key holding the user's chosen dock companion id ('bill' | 'kit'). */
export const COMPANION_STORAGE_KEY = 'ttt-company-companion';

/** localStorage key: 'true' when the user has hidden the dock companion entirely. */
export const MASCOT_HIDDEN_STORAGE_KEY = 'ttt-bill-hidden';

/** localStorage key holding the last-shown dock-bubble line index (avoids an
 *  immediate repeat across visits). */
export const MASCOT_LINE_INDEX_STORAGE_KEY = 'ttt-bill-line-index';

/** Same-tab window event dispatched when MASCOT_HIDDEN_STORAGE_KEY changes
 *  (localStorage 'storage' events do not fire in the writing tab). */
export const MASCOT_HIDDEN_CHANGE_EVENT = 'ttt-bill-pref-change';

/** Same-tab window event dispatched when COMPANION_STORAGE_KEY changes. */
export const COMPANION_CHANGE_EVENT = 'ttt-company-companion-change';

/** Same-tab window event dispatched when the transient dock-puppet pose changes
 *  (in-memory store; never persisted). */
export const MASCOT_POSE_CHANGE_EVENT = 'ttt-bill-pose-change';

// --- Manual reduced-motion House control (device-local) ---
// Independent of the companion visibility store above: reducing motion does not hide the
// companion, and hiding the companion does not change motion. Effective reduced motion is
// (the device's prefers-reduced-motion request) OR (this manual preference); the device
// request always wins. Device-local BY DESIGN — never mirrored to Firestore or the private
// user document (unlike the account-durable site-tour state).

/** localStorage key: 'true' when the member has manually enabled TTT's app-wide
 *  reduced-motion preference (the "Motion: Full / Reduced" House control). */
export const REDUCED_MOTION_STORAGE_KEY = 'ttt-reduced-motion';

/** Same-tab window event dispatched when REDUCED_MOTION_STORAGE_KEY changes (localStorage
 *  'storage' events do not fire in the writing tab), mirroring COMPANION_CHANGE_EVENT. */
export const REDUCED_MOTION_CHANGE_EVENT = 'ttt-reduced-motion-change';
