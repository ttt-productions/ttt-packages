const MINUTE_MS = 60 * 1000;
const HOUR_MS = 60 * MINUTE_MS;

export const MEDIA_PROCESSING_MAX_ATTEMPTS = 2;

// Longer than the processing trigger's timeout, so a live attempt is never reclaimed from under
// itself.
export const MEDIA_PROCESSING_LEASE_MS = 10 * MINUTE_MS;

export const STALE_PENDING_MEDIA_AGE_MS = 30 * MINUTE_MS;

export const ABANDONED_STAGING_AGE_MS = 24 * HOUR_MS;

export const STALE_PENDING_MEDIA_PAGE_SIZE = 100;
export const MAX_STALE_PENDING_MEDIA_PAGES_PER_RUN = 5;
export const PICTURE_RETIREMENT_PAGE_SIZE = 50;
export const GALLERY_RETIREMENT_PICTURES_PER_RUN = 100;
export const STAGING_LIST_PAGE_SIZE = 1000;
export const MAX_STAGING_DELETES_PER_RUN = 500;
// Two listing pages keep the pass well inside the sweep's timeout beside its other passes.
export const MAX_STAGING_EXAMINED_PER_RUN = 2 * STAGING_LIST_PAGE_SIZE;

// The base is the sweep's 15-minute cadence, since any shorter delay is simply the next run.
export const MEDIA_SWEEP_BACKOFF_BASE_MS = 15 * MINUTE_MS;
export const MEDIA_SWEEP_BACKOFF_MAX_MS = 24 * HOUR_MS;

export const MAX_V1_PICTURE_CARRY_ATTEMPTS = 3;

// Longer than any signing callable can run, so a live signing's intent is never reaped.
export const SIGNATURE_COPY_ORPHAN_GRACE_MS = 24 * HOUR_MS;
// Longer than a reap's claim-delete-release round, so a live reap is never taken over.
export const SIGNATURE_COPY_REAP_CLAIM_LEASE_MS = HOUR_MS;
export const SIGNATURE_COPY_REAP_PAGE_SIZE = 50;

export const MAX_STAGING_UPLOAD_PATH_LENGTH = 300;

export const UPLOAD_TRAY_WINDOW_MS = 24 * HOUR_MS;

export const MAX_UPLOADS_MARKED_SEEN_PER_CALL = 200;
