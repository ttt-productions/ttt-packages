import type { UserAccountStatus } from '../doc-schemas/user.js';
import type { HallContentTextSurface } from '../doc-schemas/content.js';
import type { ReportDisposition, NciiInternalStatus } from '../doc-schemas/safety/foundation.js';
import type { ChildSafetyWorkStatus } from '../doc-schemas/safety/case.js';
import type { AdminDispatch } from '../doc-schemas/messaging.js';
import type { Audition } from '../doc-schemas/commissions.js';
import type { FeedbackType } from './business-admin.js';
import type { ClearableTextFieldName } from './business-content.js';
import { HALL_CONTENT_TEXT_FIELDS } from './business-content.js';
import type { BroadcastAudienceSelector } from '../schemas/notification.js';
import type { DeadLetterCollection } from '../schemas/admin.js';
import type { GuildInviteConversationStatus, ShortLinkTargetType } from '../schemas/atoms.js';
import type { CommissionProposalStatus } from '../schemas/commissions.js';
import type { InviteSourceType } from '../schemas/work-project-management.js';
import type { HallWingType, RuleGroup, WorkProjectType } from '../types/content.js';
import { HALL_WING_TYPES, WORK_PROJECT_TYPES } from './options.js';
import type { HallSubItemStatus } from '../utils/hall-content.js';

export const USER_ACCOUNT_STATUS_LABELS: Record<UserAccountStatus, string> = {
  active: 'Active',
  suspended: 'Suspended',
  banned: 'Banned',
};

export const BROADCAST_AUDIENCE_KIND_LABELS: Record<BroadcastAudienceSelector['kind'], string> = {
  allActiveUsers: 'All active users',
  allArtisans: 'All artisan creators',
  explicitUids: 'Specific users (paste uids)',
  workMembers: "A Work's guild members",
  realmMembers: "A Realm's members",
};

export const FEEDBACK_TYPE_LABELS: Record<FeedbackType, string> = {
  tradeProfessionSuggestions: 'Trades',
  craftSkillTagSuggestions: 'Craft Tags',
  talesWorkGenreSuggestions: 'Tales Genres',
  tunesWorkGenreSuggestions: 'Tunes Genres',
  televisionWorkGenreSuggestions: 'Television Genres',
};

export const CLEARABLE_TEXT_FIELD_LABELS: Record<ClearableTextFieldName, string> = {
  workingTitle: 'Title',
  workingDescription: 'Description',
  title: 'Title',
  description: 'Description',
  content: 'Content',
};

export type ClearableTextFieldLabelOverrides = {
  [S in HallContentTextSurface]?: {
    [F in (typeof HALL_CONTENT_TEXT_FIELDS)[S][number]]?: string;
  };
};

export const CLEARABLE_TEXT_FIELD_LABEL_OVERRIDES = {
  workRealm: { workingTitle: 'Name' },
} as const satisfies ClearableTextFieldLabelOverrides;

export function clearableTextFieldLabel(field: string, surface?: string): string {
  const overrides = surface
    ? (CLEARABLE_TEXT_FIELD_LABEL_OVERRIDES as Record<string, Record<string, string> | undefined>)[
        surface
      ]
    : undefined;
  return (
    overrides?.[field] ?? (CLEARABLE_TEXT_FIELD_LABELS as Record<string, string>)[field] ?? field
  );
}

export const ADMIN_DISPATCH_AWAITING_REPLY_LABEL = 'Awaiting reply';

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
  chatParkedDeliveries: 'Chat room delivery',
};

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

export interface UserFacingReasonOption {
  code: string;
  label: string;
  description: string;
}

export const USER_FACING_REASON_OPTIONS = [
  {
    code: 'harassment',
    label: 'Harassment or bullying',
    description: 'Targeted abuse, threats, or sustained harassment of a person.',
  },
  {
    code: 'hate',
    label: 'Hate speech',
    description: 'Attacks on people based on a protected characteristic.',
  },
  {
    code: 'adult-content',
    label: 'Explicit / adult content',
    description: 'Sexual or graphic content not allowed on the platform.',
  },
  {
    code: 'violence',
    label: 'Violence or threats',
    description: 'Threats of violence, or content glorifying or inciting it.',
  },
  {
    code: 'spam',
    label: 'Spam or scam',
    description: 'Unsolicited bulk content, deceptive links, or fraud.',
  },
  {
    code: 'impersonation',
    label: 'Impersonation',
    description: 'Pretending to be another person, brand, or entity.',
  },
  {
    code: 'ip',
    label: 'Intellectual property',
    description: 'Use of someone else’s work without the right to do so.',
  },
  {
    code: 'nonconsensual',
    label: 'Nonconsensual intimate imagery',
    description: 'Intimate or sexual imagery shared without the subject’s consent.',
  },
  {
    code: 'safety',
    label: 'Safety violation',
    description: 'A serious safety violation handled under our safety policies.',
  },
  {
    code: 'other',
    label: 'Other (explain)',
    description: 'A policy violation not covered above — describe it in the detail box.',
  },
] as const satisfies readonly UserFacingReasonOption[];

export type UserFacingReasonCode = (typeof USER_FACING_REASON_OPTIONS)[number]['code'];

export const USER_FACING_REASON_CODES = USER_FACING_REASON_OPTIONS.map((o) => o.code) as [
  UserFacingReasonCode,
  ...UserFacingReasonCode[],
];

export function userFacingReasonLabel(code: string | undefined): string | undefined {
  return USER_FACING_REASON_OPTIONS.find((o) => o.code === code)?.label;
}

export const RULE_GROUP_TITLES: Record<RuleGroup, string> = {
  generic: 'General Site Rules',
  merchandising: 'Merchandising, Endorsements & Revenue Sharing',
  hallWing: 'Hall Wing Rules',
  workRealm: 'Realm Rules',
};
export const ARTISAN_AGREEMENTS_TITLE = 'Artisan Agreements';

export function appliesToTypeLabel(entry: {
  workProjectType?: WorkProjectType;
  hallWingType?: HallWingType;
}): string | undefined {
  const parts = [
    entry.workProjectType && WORK_PROJECT_TYPES[entry.workProjectType].label,
    entry.hallWingType && `${HALL_WING_TYPES[entry.hallWingType].label} wing`,
  ].filter((part): part is string => Boolean(part));
  return parts.length > 0 ? `${parts.join(', ')} only` : undefined;
}

export const GUILD_INVITE_STATUS_LABELS: Record<GuildInviteConversationStatus, string> = {
  pending: 'Pending',
  accepted: 'Accepted',
  declined: 'Declined',
  cancelled: 'Cancelled',
  finalized: 'Finalized',
};

export const COMMISSION_PROPOSAL_STATUS_LABELS: Record<CommissionProposalStatus, string> = {
  open: 'Open',
  invited: 'Invited',
  accepted: 'Accepted',
  rejected: 'Rejected',
};

export const HALL_SUB_ITEM_STATUS_LABELS: Record<HallSubItemStatus, string> = {
  unpublished: 'unpublished',
  pending_approval: 'Pending approval',
  published: 'published',
};

export const AUDITION_STATUS_LABELS: Record<Audition['status'], string> = {
  open: 'Open',
  closed: 'Closed',
  pendingReview: 'PendingReview',
};

export const WORK_PROJECT_TYPE_LABELS: Record<WorkProjectType, string> = {
  Tales: 'Tales',
  Tunes: 'Tunes',
  Television: 'Television',
};

export const INVITE_SOURCE_TYPE_LABELS: Record<InviteSourceType, string> = {
  standalone: 'standalone',
  craftSkill: 'craftSkill',
  commission: 'commission',
  audition: 'audition',
};

export const SHORT_LINK_TARGET_TYPE_LABELS: Record<ShortLinkTargetType, string> = {
  audition: 'Audition',
  'audition-entry': 'Audition entry',
  commission: 'Commission',
  'hall-library-item': 'Hall entry',
};

export const ADMIN_DISPATCH_STATUS_LABELS: Record<AdminDispatch['status'], string> = {
  open: 'Open',
  user_reply: 'User replied',
  admin_reply: 'Admin replied',
  closed_resolved: 'Resolved',
  closed_unresolved: 'Closed',
};

export const ADMIN_SELF_REVOKE_REFUSAL =
  "You can't revoke your own admin standing. Ask another full admin to do it.";

export const ADMIN_SENDER_MARKER_LABEL = 'Admin';

export const ADMIN_DISPATCH_SYSTEM_SENDER_LABEL = 'System';

export const CHILD_SAFETY_CASE_WORK_STATUS_LABELS: Record<ChildSafetyWorkStatus, string> = {
  new: 'new',
  triaged: 'triaged',
  reporting: 'reporting',
  actioning: 'actioning',
  processing: 'processing',
  failed: 'failed',
  operationallyResolved: 'operationallyResolved',
};

export const NCII_CASE_STATUS_LABELS: Record<NciiInternalStatus, string> = {
  open: 'open',
  removalInProgress: 'removalInProgress',
  processing: 'processing',
  failed: 'failed',
  removed: 'removed',
  rejected: 'rejected',
  closed: 'closed',
};
