// Caching, retention, and cleanup TTLs / batch sizes.

// --- Profanity word list cache ---

/** TTL for the in-memory profanity word list cache (1 hour). */
export const WORD_LIST_CACHE_TTL_MS = 1000 * 60 * 60;

// --- Pending media archive ---

/** Days after which a terminal pendingMedia doc is moved to pendingMediaArchive. */
export const PENDING_MEDIA_ARCHIVE_AFTER_DAYS = 7;

/** Per-run cap on docs archived by the archivePendingMedia scheduled commission. */
export const PENDING_MEDIA_ARCHIVE_BATCH_SIZE = 500;

// --- Rejected (moderation-quarantined) media retention ---
// Bytes a moderation decision rejected are kept at `rejected/{userId}/…` as APPEAL EVIDENCE
// (the violation's `rejectedFilePath`; owner + admin readable, never served through the media
// gateway). They are not kept forever: after this window the hold-aware fail-closed sweep
// deletes them. Fail-closed means a file it cannot prove is out of window — or that carries an
// active Trust & Safety / legal hold — is LEFT IN PLACE, never deleted on a best guess.
// 90 days sits comfortably past the appeal window while bounding indefinite retention of
// often-adult rejected content. See ttt-prod docs/design/content-moderation-and-reporting.md.

/** Days a moderation-rejected upload's quarantined bytes are retained before the
 *  hold-aware sweep deletes them. */
export const REJECTED_MEDIA_RETENTION_DAYS = 90;

// --- Orphan upload cleanup ---

/** TTL in hours after which an orphan storage upload becomes eligible for deletion. */
export const ORPHAN_UPLOAD_TTL_HOURS = 24;

/** Per-run cap on orphan storage deletions. */
export const ORPHAN_UPLOAD_DELETE_CAP = 500;

/** Page size for listing orphan uploads. */
export const ORPHAN_UPLOAD_LIST_PAGE_SIZE = 1000;

// --- Frontend in-flight upload listeners ---

/** Maximum lookback window for the in-flight upload listener (24 hours). */
export const LISTENER_WINDOW_MS = 24 * 60 * 60 * 1000;

// --- Public users React Query cache ---

/** Stale time for the publicUsers query cache (30 minutes). */
export const PUBLIC_USERS_STALE_TIME_MS = 30 * 60 * 1000;

/** GC time for the publicUsers query cache (1 hour). */
export const PUBLIC_USERS_GC_TIME_MS = 60 * 60 * 1000;

