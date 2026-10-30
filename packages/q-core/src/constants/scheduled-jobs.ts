export const SWEEP_STATE_NAMES = [
  'reconcilePublicUsers',
  'orphanRegistrationCleanup',
  'reconcileAccountStatus',
  'pictureRetirement',
  'stalePendingMedia',
  'abandonedStaging',
] as const;
export type SweepStateName = (typeof SWEEP_STATE_NAMES)[number];

export const SWEEP_STATE_MAX_DEFERRED = 50;

export const AUTH_LIST_USERS_PAGE_SIZE = 1000;

export const AUTH_FULL_SCAN_EXAMINED_PER_RUN = 2 * AUTH_LIST_USERS_PAGE_SIZE;

export const RECONCILE_PUBLIC_USERS_PAGE_SIZE = 200;

export const ORPHAN_REGISTRATION_GRACE_MS = 30 * 60 * 1000;

export const ORPHAN_REGISTRATION_CLEANUP_SCHEDULE = '*/15 * * * *';

export const REGISTRATION_START_TTL_MS = 24 * 60 * 60 * 1000;
