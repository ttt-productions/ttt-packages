// ============================================================================
// ADMIN-SURFACE DISPLAY LABELS — the ONE home for business display copy keyed
// by canonical ttt-core enums (ARCH-102, extended 2026-07-13). Consolidated from
// the former component-local maps in ttt-prod (admin-user-management-view,
// admin-announcements-view, guided-resolution-flow). Any client (web, phone,
// TV, admin app) renders the same labels by importing these.
//
// A few entries here are copy for ADMIN-MANAGED content that a PUBLIC surface also
// renders (the rules-page group titles at the bottom of this file). The organizing
// principle is one declaration, not one consumer.
// ============================================================================

import type { UserAccountStatus } from '../doc-schemas/user.js';
import type { FeedbackType } from './business-admin.js';
import type { ReportDisposition } from '../doc-schemas/safety/foundation.js';
import type { BroadcastAudienceSelector } from '../schemas/notification.js';
import type { DeadLetterCollection } from '../schemas/admin.js';

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

/** Human labels for the canonical feedback types — the admin feedback-suggestions views and
 * the user-facing feedback-submission surface render these instead of restating copy. Keyed
 * by FeedbackType, so a new FEEDBACK_TYPES member fails the build until its label exists.
 * UI copy uses the SHORT settled terms (Trade → "Trades", Craft → "Craft Tags", Genre →
 * "<Kind> Genres"), never the compound code identifiers (ARCH-107). */
export const FEEDBACK_TYPE_LABELS: Record<FeedbackType, string> = {
  tradeProfessionSuggestions: 'Trades',
  craftSkillTagSuggestions: 'Craft Tags',
  talesWorkGenreSuggestions: 'Tales Genres',
  tunesWorkGenreSuggestions: 'Tunes Genres',
  televisionWorkGenreSuggestions: 'Television Genres',
};

/** Human labels for the dead-letter replay ledgers (Ops Repairs dead-letter table). */
export const DEAD_LETTER_COLLECTION_LABELS: Record<DeadLetterCollection, string> = {
  chatSyncEvents: 'Chat sync event',
  chatAdminActionCommands: 'Chat moderation command',
  notificationDeliveries: 'Notification delivery',
  chatMessageOutbox: 'Chat message publish',
  squareAnnouncementJobs: 'Square announcement',
  chatSyncFanoutJobs: 'Chat access fanout',
  mediaAssets: 'Media authority sync',
  quarantineSagaJobs: 'Quarantine saga',
  nciiRemovalJobs: 'NCII removal',
  safetyEvidenceJobs: 'Safety evidence job',
  accountActionCommands: 'Account safety action',
  activeReportGroups: 'Report edge sync',
  hallSubItemEdgeSync: 'Hall sub-item edge sync',
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

/** One user-facing reason option (shown to the affected user for any user-affecting action). */
export interface UserFacingReasonOption {
  code: string;
  label: string;
  description: string;
}

/** User-facing reason picklist for the guided case-resolution flow — the affected user sees the
 * label for any user-affecting action. Canonical home (ARCH-102): the codes ARE this list's own
 * enumeration, so every client (web, phone, TV, admin app) renders the same options + labels by
 * importing from here. Final user-/legal-facing wording is subject to lawyer review; these are
 * functional defaults. */
export const USER_FACING_REASON_OPTIONS: readonly UserFacingReasonOption[] = [
  { code: 'harassment', label: 'Harassment or bullying', description: 'Targeted abuse, threats, or sustained harassment of a person.' },
  { code: 'hate', label: 'Hate speech', description: 'Attacks on people based on a protected characteristic.' },
  { code: 'adult-content', label: 'Explicit / adult content', description: 'Sexual or graphic content not allowed on the platform.' },
  { code: 'violence', label: 'Violence or threats', description: 'Threats of violence, or content glorifying or inciting it.' },
  { code: 'spam', label: 'Spam or scam', description: 'Unsolicited bulk content, deceptive links, or fraud.' },
  { code: 'impersonation', label: 'Impersonation', description: 'Pretending to be another person, brand, or entity.' },
  { code: 'ip', label: 'Intellectual property', description: 'Use of someone else’s work without the right to do so.' },
  { code: 'nonconsensual', label: 'Nonconsensual intimate imagery', description: 'Intimate or sexual imagery shared without the subject’s consent.' },
  { code: 'safety', label: 'Safety violation', description: 'A serious safety violation handled under our safety policies.' },
  { code: 'other', label: 'Other (explain)', description: 'A policy violation not covered above — describe it in the detail box.' },
] as const;

/** The user-facing label for a reason code (undefined when the code is unknown/absent). */
export function userFacingReasonLabel(code: string | undefined): string | undefined {
  return USER_FACING_REASON_OPTIONS.find((o) => o.code === code)?.label;
}

// --- Rules-surface group titles ---
// The two rule-GROUP headings for the platform rules content (`Rule.group`
// 'workProjectType' / 'hallWingType' — see schemas/admin.ts). BOTH the admin rules editor
// and the public rules page render these, so they are declared once here instead of being
// restated as literals on each surface (ENG-002). Copy uses the short settled terms Work /
// Hall / Wing (ARCH-107).

export const WORK_PROJECT_TYPE_RULE_GROUP_TITLE = 'Work Type Rules';
export const HALL_WING_TYPE_RULE_GROUP_TITLE = 'Hall Wing Rules';
