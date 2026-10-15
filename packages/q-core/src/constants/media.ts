// Upload pipeline policy: the processing claim, the maintenance sweep's windows and bounds, and the
// retry ceiling of the migration console's picture carry. The generic claim and lease machinery is
// media-schemas'; the numbers are Q-Sports'.

const MINUTE_MS = 60 * 1000;
const HOUR_MS = 60 * MINUTE_MS;

// Processing attempts a picture upload gets, the first included. A second attempt exists only to
// recover a crashed or killed first one.
export const MEDIA_PROCESSING_MAX_ATTEMPTS = 2;

// How long a processing claim owns its row before a redelivery may reclaim it. Longer than the
// processing trigger's timeout, so a live attempt is never reclaimed from under itself.
export const MEDIA_PROCESSING_LEASE_MS = 10 * MINUTE_MS;

// An upload still `pending` or `processing` this long after it was accepted, past its lease, has no
// live attempt left driving it, and the maintenance sweep fails it.
export const STALE_PENDING_MEDIA_AGE_MS = 30 * MINUTE_MS;

// A staged object this old with no `pending` or `processing` upload row is abandoned — never
// accepted, consumed by a signing, or left by a finished upload — and the sweep deletes it.
export const ABANDONED_STAGING_AGE_MS = 24 * HOUR_MS;

// The maintenance sweep's per-run bounds (BACKEND-112). Each pass stops at its bound and the next
// scheduled run continues.
export const STALE_PENDING_MEDIA_PAGE_SIZE = 100;
export const MAX_STALE_PENDING_MEDIA_PAGES_PER_RUN = 5;
export const PICTURE_RETIREMENT_PAGE_SIZE = 50;
export const GALLERY_RETIREMENT_PICTURES_PER_RUN = 100;
export const STAGING_LIST_PAGE_SIZE = 1000;
export const MAX_STAGING_DELETES_PER_RUN = 500;
// The most staged objects one abandoned-staging pass examines before it stops and saves its
// position. Kept objects (young, with a live row, unreadable) cost nothing against the delete cap, so
// this is what bounds a pass over a long kept stretch; two listing pages keep the pass well inside
// the sweep's timeout beside its other passes, and the next run resumes after the last one examined.
export const MAX_STAGING_EXAMINED_PER_RUN = 2 * STAGING_LIST_PAGE_SIZE;

// Deferral backoff for the sweep's picture-retirement and stale-upload passes. A row a pass keeps or
// fails on leaves its scan window as a sweep-state `deferred` entry, next due
// `min(BASE × 2^(n−1), MAX)` from now with `n` its attempt count: 15 and 30 minutes, 1, 2, 4, 8 and
// 16 hours, then a day from there on. The base is the sweep's 15-minute cadence, since any shorter
// delay is simply the next run; the cap bounds how long a released reference or a recovered failure
// waits to be noticed.
export const MEDIA_SWEEP_BACKOFF_BASE_MS = 15 * MINUTE_MS;
export const MEDIA_SWEEP_BACKOFF_MAX_MS = 24 * HOUR_MS;

// How many times the migration console's picture carry enqueues one source before reporting it as refused by the
// pipeline.
export const MAX_V1_PICTURE_CARRY_ATTEMPTS = 3;

// The longest staging path a callable accepts: `uploads/{origin}/{uid}/{uuid}` is far shorter.
export const MAX_STAGING_UPLOAD_PATH_LENGTH = 300;
