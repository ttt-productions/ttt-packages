export const SWEEP_STATE_NAMES = [
  'reconcilePublicUsers',
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
