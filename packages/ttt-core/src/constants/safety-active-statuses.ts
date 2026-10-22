import type { ChildSafetyWorkStatus, SafetyCaseLane } from '../doc-schemas/safety/case.js';
import type {
  NciiInternalStatus,
  TakeItDownPublicStatus,
} from '../doc-schemas/safety/foundation.js';

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

export const CHILD_SAFETY_ACTIVE_WORK_STATUSES: readonly ChildSafetyWorkStatus[] = activeStatusesOf(
  CHILD_SAFETY_WORK_STATUS_IS_ACTIVE,
);

export const NCII_ACTIVE_INTERNAL_STATUSES: readonly NciiInternalStatus[] = activeStatusesOf(
  NCII_INTERNAL_STATUS_IS_ACTIVE,
);

export const TAKE_IT_DOWN_ACTIVE_PUBLIC_STATUSES: readonly TakeItDownPublicStatus[] =
  activeStatusesOf(TAKE_IT_DOWN_PUBLIC_STATUS_IS_ACTIVE);

const STATUS_IS_ACTIVE_BY_LANE = {
  csam: CHILD_SAFETY_WORK_STATUS_IS_ACTIVE,
  ncii: NCII_INTERNAL_STATUS_IS_ACTIVE,
} satisfies Record<SafetyCaseLane, Record<string, boolean>>;

export type SafetyCaseStatusRef = {
  [Lane in SafetyCaseLane]: {
    caseType: Lane;
    status: keyof (typeof STATUS_IS_ACTIVE_BY_LANE)[Lane];
  };
}[SafetyCaseLane];

export function isActiveSafetyCaseStatus(ref: SafetyCaseStatusRef): boolean {
  const isActive: Record<string, boolean> = STATUS_IS_ACTIVE_BY_LANE[ref.caseType];
  return isActive[ref.status] === true;
}
