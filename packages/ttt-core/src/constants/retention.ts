export const WORD_LIST_CACHE_TTL_MS = 1000 * 60 * 60;

export const PENDING_MEDIA_ARCHIVE_AFTER_DAYS = 7;

export const PENDING_MEDIA_ARCHIVE_BATCH_SIZE = 500;

export const REJECTED_MEDIA_RETENTION_DAYS = 90;

const REJECTED_MEDIA_RETENTION_MS = REJECTED_MEDIA_RETENTION_DAYS * 24 * 60 * 60 * 1000;

export function rejectedMediaAppealDeadline(rejectedAt: number): number {
  return rejectedAt + REJECTED_MEDIA_RETENTION_MS;
}

export function isRejectedMediaAppealOpen(rejectedAt: number, now: number): boolean {
  return now < rejectedMediaAppealDeadline(rejectedAt);
}

export const ORPHAN_UPLOAD_TTL_HOURS = 24;

export const ORPHAN_UPLOAD_DELETE_CAP = 500;

export const ORPHAN_UPLOAD_LIST_PAGE_SIZE = 1000;

// Two listing pages keep a pass inside the sweep's function timeout.
export const ORPHAN_UPLOAD_EXAMINED_CAP = 2 * ORPHAN_UPLOAD_LIST_PAGE_SIZE;

export const LISTENER_WINDOW_MS = 24 * 60 * 60 * 1000;

export const PUBLIC_USERS_STALE_TIME_MS = 30 * 60 * 1000;

export const PUBLIC_USERS_GC_TIME_MS = 60 * 60 * 1000;

// Short, so a just-created or just-published entity stops reading as missing almost at once.
export const PUBLIC_LOOKUP_ABSENT_STALE_TIME_MS = 20 * 1000;
