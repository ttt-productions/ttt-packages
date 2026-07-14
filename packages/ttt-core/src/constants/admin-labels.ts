// ============================================================================
// ADMIN-SURFACE DISPLAY LABELS — the ONE home for business display copy keyed
// by canonical ttt-core enums (Rule 36, extended 2026-07-13). Consolidated from
// the former component-local maps in ttt-prod (admin-user-management-view,
// admin-announcements-view, guided-resolution-flow). Any client (web, phone,
// TV, admin app) renders the same labels by importing these.
// ============================================================================

import type { UserAccountStatus } from '../doc-schemas/user.js';
import type { ReportDisposition } from '../doc-schemas/safety/foundation.js';
import type { BroadcastAudienceSelector } from '../schemas/notification.js';

/** Moderation status labels (user-management view, status badges). */
export const USER_ACCOUNT_STATUS_LABELS: Record<UserAccountStatus, string> = {
  active: 'Active',
  suspended: 'Suspended',
  banned: 'Banned',
};

/** Broadcast audience selector labels (announcement composer). */
export const BROADCAST_AUDIENCE_KIND_LABELS: Record<BroadcastAudienceSelector['kind'], string> = {
  allActiveUsers: 'All active users',
  allArtisans: 'All artisan creators',
  explicitUids: 'Specific users (paste uids)',
  workMembers: "A Work's guild members",
  realmMembers: "A Realm's members",
};

/** Operator-settable report dispositions with their console copy. 'undetermined' is the
 * initial state, never a settable target, so it carries no option entry. */
export const REPORT_DISPOSITION_OPTIONS: readonly {
  value: Exclude<ReportDisposition, 'undetermined'>;
  label: string;
  description: string;
}[] = [
  {
    value: 'reportRequired',
    label: 'Report required (NCMEC)',
    description:
      'Apparent CSAM — a report is legally required. Establishes actual knowledge + arms the clock.',
  },
  {
    value: 'notRequired',
    label: 'No report required',
    description: 'No reporting obligation ever arose. Disallowed once there is a validated match.',
  },
  {
    value: 'correctedNoApparentViolation',
    label: 'False positive — correct it',
    description: 'There was a triggering signal but on review it is a false positive.',
  },
];
