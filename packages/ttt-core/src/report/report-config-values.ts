import {
  ReportReasonSchema,
  type ReportReason,
  type ReportableItemType,
} from '../doc-schemas/safety/foundation.js';

export const REPORTABLE_ITEM_LABELS: Record<ReportableItemType, string> = {
  username: 'Username',
  'craft-skill': 'Craft Skill',
  'commission-listing': 'Commission Listing',
  'commission-proposal': 'Commission Proposal',
  'square-streetz-post': 'Square Post',
  'profile-picture': 'Profile Picture',
  'guild-invite-message': 'Guild Invite Message',
  'guild-chat-message': 'Guild Chat Message',
  'conversation-file': 'Conversation File',
  'hall-library-item': 'Hall Item',
  'hall-library-sub-item': 'Hall Sub-Item',
  audition: 'Audition',
  'audition-entry': 'Audition Entry',
  'work-project': 'Work Project',
  'work-asset': 'Work File',
  'work-realm': 'Work Realm',
};

export const REPORT_REASON_SCORES: Record<ReportReason, number> = {
  'Child Safety Concern': 1000,
  'Nonconsensual Intimate Image (NCII)': 900,
  'Self-Harm': 800,
  'Violence or Threats': 500,
  'Sexual Content': 400,
  'Hate Speech': 400,
  Harassment: 300,
  Impersonation: 200,
  'Intellectual Property': 150,
  Spam: 100,
  'Not related to on-site entertainment': 75,
  Other: 50,
};

export const REPORT_ITEM_TYPE_MULTIPLIERS: Record<ReportableItemType, number> = {
  'square-streetz-post': 1.5,
  'hall-library-item': 1.3,
  'hall-library-sub-item': 1.3,
  audition: 1.2,
  'audition-entry': 1.2,
  'commission-listing': 1.1,
  'work-project': 1.1,
  'work-realm': 1.1,
  'commission-proposal': 1.0,
  username: 1.0,
  'craft-skill': 1.0,
  'profile-picture': 1.0,
  'work-asset': 1.0,
  'conversation-file': 1.0,
  'guild-chat-message': 0.8,
  'guild-invite-message': 0.8,
};

export const REPORT_PRIORITY_BONUSES = {
  additionalReportBonus: 50,
  defaultReasonScore: 50,
  defaultItemTypeMultiplier: 1.0,
} as const;

export const ORDINARY_REPORT_REASONS: readonly ReportReason[] = ReportReasonSchema.options.filter(
  (r) => r !== 'Nonconsensual Intimate Image (NCII)',
);

export interface ReportTaskQueueDefinition {
  displayName: string;
  description: string;
  defaultCheckoutMinutes: number;
  workLaterMinutes: number;
  maxWorkLaterMinutes: number;
}

export const REPORT_TASK_QUEUES: Record<string, ReportTaskQueueDefinition> = {
  userReport: {
    displayName: 'User Reports',
    description: 'Content reports from users',
    defaultCheckoutMinutes: 60,
    workLaterMinutes: 1440,
    maxWorkLaterMinutes: 2880,
  },
  'content-appeal': {
    displayName: 'Content Appeals',
    description: 'Appeals from users whose content was flagged',
    defaultCheckoutMinutes: 120,
    workLaterMinutes: 1440,
    maxWorkLaterMinutes: 2880,
  },
  thresholdLibraryReview: {
    displayName: 'Library Reviews',
    description: 'New library submissions pending review',
    defaultCheckoutMinutes: 90,
    workLaterMinutes: 1440,
    maxWorkLaterMinutes: 2880,
  },
  hallContentChangeRequest: {
    displayName: 'Published Change Requests',
    description: 'Member-proposed text changes to published library items',
    defaultCheckoutMinutes: 90,
    workLaterMinutes: 1440,
    maxWorkLaterMinutes: 2880,
  },
  adminDispatch: {
    displayName: 'Admin Dispatches',
    description: 'Admin messages and support tickets',
    defaultCheckoutMinutes: 60,
    workLaterMinutes: 1440,
    maxWorkLaterMinutes: 2880,
  },
  stakeShareAnomaly: {
    displayName: 'Stake Share Anomalies',
    description: 'Unexpected work-project stake-share changes flagged by the integrity trigger',
    defaultCheckoutMinutes: 60,
    workLaterMinutes: 1440,
    maxWorkLaterMinutes: 2880,
  },
  pledgeLedgerAnomaly: {
    displayName: 'Pledge Ledger Anomalies',
    description: 'Out-of-band or illegal pledge-ledger changes flagged by the integrity trigger',
    defaultCheckoutMinutes: 60,
    workLaterMinutes: 1440,
    maxWorkLaterMinutes: 2880,
  },
  pledgePaymentRepairNeeded: {
    displayName: 'Pledge Payment Repairs',
    description: 'Paid Stripe events that could not be recorded automatically and were quarantined',
    defaultCheckoutMinutes: 60,
    workLaterMinutes: 1440,
    maxWorkLaterMinutes: 2880,
  },
  pledgeDisputeOpened: {
    displayName: 'Pledge Disputes',
    description:
      'Chargeback disputes opened against a pledge, surfaced by the refund/dispute webhook',
    defaultCheckoutMinutes: 60,
    workLaterMinutes: 1440,
    maxWorkLaterMinutes: 2880,
  },
  pledgeRefundRequested: {
    displayName: 'Pledge Refund Requests',
    description: 'User-initiated pledge refund requests awaiting admin approve/deny',
    defaultCheckoutMinutes: 60,
    workLaterMinutes: 1440,
    maxWorkLaterMinutes: 2880,
  },
  pledgeRefundFailed: {
    displayName: 'Failed Pledge Refunds',
    description: 'Approved pledge refunds that Stripe reported as failed',
    defaultCheckoutMinutes: 60,
    workLaterMinutes: 1440,
    maxWorkLaterMinutes: 2880,
  },
};
