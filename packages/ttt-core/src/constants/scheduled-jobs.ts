export const ADMIN_TASK_CLEANUP_INTERVAL = 15;

export const ADMIN_TASK_EXPIRED_BATCH_SIZE = 500;

export const ADMIN_TASK_CLEANUP_MAX_ITERATIONS = 10;

// Must exceed the publish trigger `onThresholdItemReviewed`'s retry window (about a day).
export const HALL_MEDIA_ORPHAN_GRACE_MS = 14 * 24 * 60 * 60 * 1000;

export const HALL_MEDIA_REAPER_PAGE_SIZE = 100;

export const HALL_MEDIA_REAPER_BACKOFF_BASE_MS = 24 * 60 * 60 * 1000;
export const HALL_MEDIA_REAPER_BACKOFF_MAX_MS = 14 * 24 * 60 * 60 * 1000;

export const SWEEP_STATE_MAX_DEFERRED = 50;

export const HALL_MEDIA_REAPER_TIMEOUT_SECONDS = 300;

// Must stay below `onThresholdItemReviewed`'s retry budget (about a day).
export const HALL_MEDIA_REAPER_CLAIM_LEASE_MS = 60 * 60 * 1000;

// The most Firebase Auth `listUsers()` returns in one call.
export const AUTH_LIST_USERS_PAGE_SIZE = 1000;

export const AUTH_FULL_SCAN_EXAMINED_PER_RUN = 2 * AUTH_LIST_USERS_PAGE_SIZE;

export const SWEEP_STATE_NAMES = [
  'orphanRegistrationCleanup',
  'reconcileAccountStatus',
  'reconcilePublicUsers',
  'hallMediaReaperAssetPhase',
  'quarantineEnqueueBackstop',
  'ncmecEnqueueBackstop',
  'staleSafetyCaseAlertSweep',
  'csamStrandedProcessing',
  'nciiStrandedProcessing',
  'expireRejectedMedia',
  'cleanupOrphanUploads',
  'mediaReconcileUnpublishedAssets',
  'mediaReconcileUnreferencedBroadAssets',
  'nciiEvidenceOrphanSweeper',
  'nciiRetentionClosedRequests',
  'reconcilePledgeRefundApprovals',
  'crossoverServingDenyReconcile',
  'crossoverPhotoDnaReconcile',
] as const;
export type SweepStateName = (typeof SWEEP_STATE_NAMES)[number];
