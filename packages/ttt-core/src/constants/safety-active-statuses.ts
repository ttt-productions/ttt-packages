// Which safety-case and take-it-down statuses are still open work. The Safety Case Console's
// active lists, the ops snapshot's Legal-Clocks counts, and the closed-case lookup's reopen check
// all read these, so the console an operator clicks through to and the count that sent them
// there always agree. A case stays active until its worker verifies a terminal status: a close in
// progress (`processing`) and a worker out of retries (`failed`) are still open work.
//
// Each status is classified in a map over its whole union, so a new status does not build until
// it is placed. Type-only imports keep this module free of runtime dependencies for the backend
// bundles that load it.

import type { ChildSafetyWorkStatus, SafetyCaseLane } from '../doc-schemas/safety/case.js';
import type { NciiInternalStatus, TakeItDownPublicStatus } from '../doc-schemas/safety/foundation.js';

const CHILD_SAFETY_WORK_STATUS_IS_ACTIVE: Record<ChildSafetyWorkStatus, boolean> = {
  new: true,
  triaged: true,
  reporting: true,
  actioning: true,
  processing: true,
  failed: true,
  operationallyResolved: false,
};

const NCII_INTERNAL_STATUS_IS_ACTIVE: Record<NciiInternalStatus, boolean> = {
  open: true,
  removalInProgress: true,
  processing: true,
  failed: true,
  removed: false,
  rejected: false,
  closed: false,
};

const TAKE_IT_DOWN_PUBLIC_STATUS_IS_ACTIVE: Record<TakeItDownPublicStatus, boolean> = {
  received: true,
  needsMoreInfo: true,
  validInProgress: true,
  completed: false,
  unableToLocate: false,
  invalidGeneralReason: false,
};

function activeStatusesOf<S extends string>(isActive: Record<S, boolean>): readonly S[] {
  return (Object.keys(isActive) as S[]).filter((status) => isActive[status]);
}

/** Child-safety case work statuses still open (the `workStatus` an active-case query matches). */
export const CHILD_SAFETY_ACTIVE_WORK_STATUSES: readonly ChildSafetyWorkStatus[] = activeStatusesOf(
  CHILD_SAFETY_WORK_STATUS_IS_ACTIVE,
);

/** NCII case statuses still open (the `internalStatus` an active-case query matches). */
export const NCII_ACTIVE_INTERNAL_STATUSES: readonly NciiInternalStatus[] = activeStatusesOf(NCII_INTERNAL_STATUS_IS_ACTIVE);

/** Take-it-down request statuses still open (the `publicStatus` an active-request query matches). */
export const TAKE_IT_DOWN_ACTIVE_PUBLIC_STATUSES: readonly TakeItDownPublicStatus[] = activeStatusesOf(
  TAKE_IT_DOWN_PUBLIC_STATUS_IS_ACTIVE,
);

// Keyed by the canonical lane union: a lane added to or renamed in SafetyCaseLaneSchema does not
// build until its status set is placed here.
const STATUS_IS_ACTIVE_BY_LANE = {
  csam: CHILD_SAFETY_WORK_STATUS_IS_ACTIVE,
  ncii: NCII_INTERNAL_STATUS_IS_ACTIVE,
} satisfies Record<SafetyCaseLane, Record<string, boolean>>;

/** A safety case's lane and its status in that lane's own status set. */
export type SafetyCaseStatusRef = {
  [Lane in SafetyCaseLane]: { caseType: Lane; status: keyof (typeof STATUS_IS_ACTIVE_BY_LANE)[Lane] };
}[SafetyCaseLane];

/** Whether a safety case is still open work, read from its own lane's status set. */
export function isActiveSafetyCaseStatus(ref: SafetyCaseStatusRef): boolean {
  const isActive: Record<string, boolean> = STATUS_IS_ACTIVE_BY_LANE[ref.caseType];
  return isActive[ref.status] === true;
}
