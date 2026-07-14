// ============================================================================
// REPORT-SYSTEM CONFIG VALUES — the ONE home for every TTT report-system value
// (labels, priority scores, multipliers, queue definitions, bonuses, comment
// cap). Consolidated here 2026-07-13 from the former lockstep pair in ttt-prod
// `src/lib/report-config.ts` (client ReportCoreConfig) and
// `functions/src/shared/report-core-config.ts` (ServerReportCoreConfig); both
// trees now ASSEMBLE their config objects from these values (assembly is
// wiring; the values are truth), and the cross-tree lockstep test is deleted.
// Every map is Record-complete over its canonical enum, so adding an enum
// member fails the BUILD here until its entries exist.
// ============================================================================

import {
  ReportReasonSchema,
  type ReportReason,
  type ReportableItemType,
} from '../doc-schemas/safety/foundation.js';

/** Human display name for every reportable surface (report dialog + admin views). */
export const REPORTABLE_ITEM_LABELS: Record<ReportableItemType, string> = {
  'username': 'Username',
  'craft-skill': 'Craft Skill',
  'commission-listing': 'Commission Listing',
  'commission-proposal': 'Commission Proposal',
  'square-streetz-post': 'Square Post',
  'profile-picture': 'Profile Picture',
  'guild-invite-message': 'Guild Invite Message',
  'guild-chat-message': 'Guild Chat Message',
  'admin-work-message': 'Work Correspondence Message',
  'hall-library-item': 'Hall Item',
  'hall-library-sub-item': 'Hall Sub-Item',
  'audition': 'Audition',
  'audition-entry': 'Audition Entry',
  'work-project': 'Work Project',
  'work-asset': 'Work File',
  'work-realm': 'Work Realm',
};

/** Score for each canonical report reason. Higher = higher priority in the admin
 * queue. Protected reasons (Child Safety Concern, NCII) fork to protected cases and
 * never reach the ordinary queue, but are kept here so the defaultReasonScore
 * fallback is never silently applied to them. */
export const REPORT_REASON_SCORES: Record<ReportReason, number> = {
  'Child Safety Concern': 1000,
  'Nonconsensual Intimate Image (NCII)': 900,
  'Self-Harm': 800,
  'Violence or Threats': 500,
  'Sexual Content': 400,
  'Hate Speech': 400,
  'Harassment': 300,
  'Impersonation': 200,
  'Intellectual Property': 150,
  'Spam': 100,
  'Not related to on-site entertainment': 75,
  'Other': 50,
};

/** Multiplier for each canonical reportable item type. High-reach public surfaces
 * carry a higher multiplier; chat-message surfaces (admin-visible or low-reach) sit
 * below 1. */
export const REPORT_ITEM_TYPE_MULTIPLIERS: Record<ReportableItemType, number> = {
  'square-streetz-post': 1.5,
  'hall-library-item': 1.3,
  'hall-library-sub-item': 1.3,
  'audition': 1.2,
  'audition-entry': 1.2,
  'commission-listing': 1.1,
  'work-project': 1.1,
  'work-realm': 1.1,
  'commission-proposal': 1.0,
  'username': 1.0,
  'craft-skill': 1.0,
  'profile-picture': 1.0,
  'work-asset': 1.0,
  'guild-chat-message': 0.8,
  'guild-invite-message': 0.8,
  'admin-work-message': 0.8,
};

/** Priority bonuses/fallbacks shared by client + server priority scoring. */
export const REPORT_PRIORITY_BONUSES = {
  additionalReportBonus: 50,
  defaultReasonScore: 50,
  defaultItemTypeMultiplier: 1.0,
} as const;

/** The reasons offered in the report picker. Derived from the canonical enum:
 * everything EXCEPT 'Nonconsensual Intimate Image (NCII)', which for a logged-in
 * user is an app-owned AdditionalReportAction routing to the take-it-down form —
 * a true 48h statutory request, not an ordinary report (§1.1). */
export const ORDINARY_REPORT_REASONS: readonly ReportReason[] =
  ReportReasonSchema.options.filter((r) => r !== 'Nonconsensual Intimate Image (NCII)');

/** One admin task-queue definition (display copy + checkout/work-later windows).
 * The client config consumes all four fields; the server config consumes the
 * minute windows. */
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
  // Published change request (member "Update details" proposal) — same review
  // queue + checkout window as threshold publishes.
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
  // Ops-anomaly / integrity lanes (money + stake-share signals). Their tasks are
  // created by Firestore-trigger / webhook integrity checks, not user flows, and are
  // worked through the ONE generic ops-anomaly work card. Present so per-type
  // checkout accepts them, checkoutNextImportantTask leases the intended window,
  // and "My Checked-Out Tasks" resolves a display name (never "Unknown Task").
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
    description: 'Chargeback disputes opened against a pledge, surfaced by the refund/dispute webhook',
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
};
// (The comment cap MAX_REPORT_COMMENT_LENGTH lives with the other business
// constants — import it from the constants barrel.)
