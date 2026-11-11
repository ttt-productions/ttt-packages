export const SWEEP_STATE_NAMES = [
  'reconcilePublicUsers',
  'reconcileAccountStatus',
  'pictureRetirement',
  'stalePendingMedia',
  'abandonedStaging',
] as const;
export type SweepStateName = (typeof SWEEP_STATE_NAMES)[number];

export const RECONCILE_PUBLIC_USERS_PAGE_SIZE = 200;
