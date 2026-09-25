// Scheduled-job intervals, batch sizes, and source URLs.

// --- Admin task cleanup ---

/** Interval in minutes for the admin-task cleanup scheduled job. */
export const ADMIN_TASK_CLEANUP_INTERVAL = 15;

/** Batch size of expired task checkouts processed per scheduled run. */
export const ADMIN_TASK_EXPIRED_BATCH_SIZE = 500;

/** Safety cap on iterations within a single admin-task cleanup run. */
export const ADMIN_TASK_CLEANUP_MAX_ITERATIONS = 10;

// --- Hall-media orphan reaper ---

/**
 * How long Hall-media copies are left alone before the orphan reaper may reclaim them — both a
 * Hall-owned asset (asset phase, measured from its `createdAt`) and the objects a copy intent
 * names (copy-intent phase: recording sets the intent's `reapAfter` this far out). It must exceed
 * the longest retry window of the publish trigger `onThresholdItemReviewed` (about a day), since
 * a pending retry re-derives the same deterministic copy and attaches its bytes. It also leaves a
 * publish that parked partway time to be unwound, resubmitted, and re-driven onto the same
 * destination while its earlier objects are still there to reuse.
 */
export const HALL_MEDIA_ORPHAN_GRACE_MS = 14 * 24 * 60 * 60 * 1000;

/** Most candidates each reaper phase takes up per pass: assets in the asset phase, due intents in
 *  the copy-intent phase. */
export const HALL_MEDIA_REAPER_PAGE_SIZE = 100;

/**
 * Deferral backoff for both reaper phases — a copy intent the sweep cannot finish yet
 * (`reapAttemptCount`) and an asset-phase candidate it cannot positively clear (a cursor
 * `deferred` entry's `attemptCount`). With `n` the count after the deferral that is being
 * scheduled, the item is next due `min(BASE × 2^(n−1), MAX)` from now: 1, 2, 4, 8, then 14 days
 * from there on. The base is the reaper's daily cadence, since any shorter delay is simply the
 * next pass; the cap bounds how long a released hold or a recovered read waits to be noticed.
 */
export const HALL_MEDIA_REAPER_BACKOFF_BASE_MS = 24 * 60 * 60 * 1000;
export const HALL_MEDIA_REAPER_BACKOFF_MAX_MS = 14 * 24 * 60 * 60 * 1000;

/**
 * Most asset-phase candidates the Hall-media orphan reaper holds in its cursor's `deferred`
 * set. Every pass retries the entries that are due, each retry re-reading the candidate and its
 * owning Hall item, so the bound keeps that work to half of a HALL_MEDIA_REAPER_PAGE_SIZE page on
 * top of the pass's own page, and keeps the singleton cursor doc a few kilobytes. A candidate the
 * reaper cannot positively clear is rare, so a full set means something systemic is failing — the
 * signal to stop and report, not to keep growing the list.
 */
export const HALL_MEDIA_REAPER_MAX_DEFERRED = 50;

/**
 * How long the copy-intent sweep holds a claim on an intent. Claiming moves the intent to
 * `reaping` and stamps `reapClaimedAt`, and that stamp is the claim's fencing token. Once the claim
 * is this old it has expired: a later sweep may take the intent over and re-stamp it, and the copy
 * path may take the `reaping` intent back to `copying`. It must far exceed the timeout of the
 * reaper function `reapOrphanedHallMediaCopies` (300 s), so a live pass never loses its claim, and
 * stay far below the retry budget of the publish trigger `onThresholdItemReviewed` (about a day),
 * so a publish stranded behind an abandoned claim always recovers inside it.
 */
export const HALL_MEDIA_REAPER_CLAIM_LEASE_MS = 60 * 60 * 1000;
