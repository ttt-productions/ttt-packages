// Well-known keys used in browser sessionStorage / localStorage.

/** sessionStorage key holding the path the user wanted before being redirected to login. */
export const REDIRECT_PATH_KEY = 'redirectPath';

/** localStorage key holding the last-seen app version (used by version-gate component). */
export const LS_VERSION_KEY = 'ttt-app-version';

/** sessionStorage key marking that a version-mismatch reload was already attempted. */
export const SS_RELOAD_ATTEMPTED_KEY = 'ttt-version-reload-attempted';
