// Scheduled passes that keep a persisted position.

/**
 * The `sweepState/{sweepName}` document ids: one per scheduled pass that keeps a rolling cursor
 * (`SweepStateSchema`), so each pass owns exactly one document and its cursor is never shared.
 */
export const SWEEP_STATE_NAMES = [
  'reconcilePublicUsers',
  'orphanRegistrationCleanup',
  'reconcileAccountStatus',
  'pictureRetirement',
  'stalePendingMedia',
] as const;
export type SweepStateName = (typeof SWEEP_STATE_NAMES)[number];

/**
 * Most rows one pass holds in its `deferred` set — the rows its cursor moved past without clearing.
 * A row a pass cannot clear is rare, so a full set means something systemic is failing: the signal
 * to stop and report, not to keep growing the list. It also keeps the document a few kilobytes.
 */
export const SWEEP_STATE_MAX_DEFERRED = 50;

/** Profiles one `reconcilePublicUsers` pass reads after its cursor. */
export const RECONCILE_PUBLIC_USERS_PAGE_SIZE = 200;

/**
 * How long a login may hold no profile after its registration started before the orphan-login
 * cleanup deletes it. A taken name is refused before the login is created, so a registration that
 * does not finish within this window was abandoned.
 */
export const ORPHAN_REGISTRATION_GRACE_MS = 30 * 60 * 1000;

/** How often the orphan-login cleanup runs (cron, in the leagues' time zone). */
export const ORPHAN_REGISTRATION_CLEANUP_SCHEDULE = '*/15 * * * *';

/**
 * How long a registration-start record lives before its native-TTL policy removes it. Far longer than
 * the grace window, so every abandoned registration is still on the cleanup's work list when it is due.
 */
export const REGISTRATION_START_TTL_MS = 24 * 60 * 60 * 1000;
