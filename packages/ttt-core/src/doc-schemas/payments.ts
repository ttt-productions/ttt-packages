// Payment / pledge Firestore document SCHEMAS — the public-safe pledge ledger and its
// server-only companions: provider refs (Stripe IDs), the idempotency sentinel, the
// independent integrity trail, and the paid-event quarantine queue. Types inferred via
// z.infer. Money data lives here, never in social.ts.
// See ttt-prod docs/design/donation-payment-system.md (the design owner for the
// pledge/Stripe flow).

import { z } from 'zod';
import { LegalReviewNoticeReceiptSchema } from './legal-review-notice.js';
import { MAX_INTERNAL_REASON_LENGTH } from '../constants/business-admin.js';

/** How much of a pledge has been refunded: `partial` while some net remains, `full` once none does. */
export const PLEDGE_REFUND_STATES = ['none', 'partial', 'full'] as const;
export const PledgeRefundStateSchema = z.enum(PLEDGE_REFUND_STATES);
export type PledgeRefundState = z.infer<typeof PledgeRefundStateSchema>;

/** Where a chargeback dispute stands: `underReview` while open, then `won` or `lost` once closed. */
export const PLEDGE_DISPUTE_STATES = ['none', 'underReview', 'won', 'lost'] as const;
export const PledgeDisputeStateSchema = z.enum(PLEDGE_DISPUTE_STATES);
export type PledgeDisputeState = z.infer<typeof PledgeDisputeStateSchema>;

const PLEDGE_DISPUTE_STATE_RANK: Record<PledgeDisputeState, number> = {
  none: 0,
  underReview: 1,
  won: 2,
  lost: 2,
};

/** A dispute state's place on the one-way ladder none < underReview < won | lost. */
export function pledgeDisputeStateRank(state: PledgeDisputeState): number {
  return PLEDGE_DISPUTE_STATE_RANK[state];
}

/**
 * Whether moving ONE dispute from `from` to `to` goes up the ladder. Stripe can deliver a
 * dispute's events late or twice, so within one dispute a closed dispute never reopens to
 * `underReview`, and `won` and `lost` never replace each other.
 */
export function isPledgeDisputeAdvance(from: PledgeDisputeState, to: PledgeDisputeState): boolean {
  return pledgeDisputeStateRank(to) > pledgeDisputeStateRank(from);
}

/**
 * Whether a dispute event may set the pledge's dispute state. The ladder holds per dispute: an
 * event for a different dispute than the recorded `disputeId` (the first one, or a later dispute
 * on the same charge) starts its own ladder, and an event for the recorded dispute applies only as
 * an advance. Ordering across disputes is the observation stamp's job — the handler first refuses
 * an event no newer than `disputeObservedAt`, so a late event of an earlier dispute never lands.
 */
export function isPledgeDisputeEventApplicable(
  recorded: { disputeId: string | null; state: PledgeDisputeState },
  event: { disputeId: string; state: PledgeDisputeState },
): boolean {
  if (recorded.disputeId !== event.disputeId) return true;
  return isPledgeDisputeAdvance(recorded.state, event.state);
}

/**
 * The pledge's dispute number for a dispute event: the recorded number while the event is about the
 * recorded dispute (the provider ref's `disputeId`), one more for any other dispute — so the first
 * dispute is 1 and each later one adds one. The number is what the member-readable pledge carries in
 * place of Stripe's dispute id, which stays on the server-only provider ref.
 */
export function pledgeDisputeNumberForEvent(
  recorded: { disputeId: string | null; disputeNumber: number },
  eventDisputeId: string,
): number {
  return recorded.disputeId === eventDisputeId ? recorded.disputeNumber : recorded.disputeNumber + 1;
}

/**
 * Whether a pledge's dispute fields may move from `before` to `after` — the rule an integrity check
 * reads from the pledge alone. Under the same dispute number the state only climbs the ladder (or stays,
 * as a redelivery or a refund leaves it); a number one higher is a new dispute, which starts its own
 * ladder at any state but `none` (its close may arrive before its opening). Any other number change is
 * not a legal transition.
 */
export function isPledgeDisputeTransitionLegal(
  before: { disputeNumber: number; disputeState: PledgeDisputeState },
  after: { disputeNumber: number; disputeState: PledgeDisputeState },
): boolean {
  if (after.disputeNumber === before.disputeNumber) {
    return after.disputeState === before.disputeState || isPledgeDisputeAdvance(before.disputeState, after.disputeState);
  }
  if (after.disputeNumber === before.disputeNumber + 1) return after.disputeState !== 'none';
  return false;
}

// pledgePayments/{pledgePaymentId} — public-safe canonical money record. One doc per completed
// pledge; never deleted/archived. No Stripe IDs, no supporter message. Auth-readable; server-only
// writes, by the Stripe webhook alone. netAmount = max(0, amount - refundedAmount - disputeLostAmount)
// is the sum() target; the refund and dispute handlers recompute it from Stripe's totals.
export const PledgePaymentSchema = z.object({
  pledgePaymentId: z.string(),
  userId: z.string(),
  amount: z.number(), // gross cents charged (Stripe-confirmed amount_total)
  refundedAmount: z.number(), // cumulative refunded cents, from the Charge's amount_refunded; 0 on a new pledge
  disputeLostAmount: z.number(), // cents withdrawn on a lost dispute; 0 otherwise
  netAmount: z.number(), // max(0, amount - refundedAmount - disputeLostAmount); sum() target
  currency: z.string(), // "usd"
  paymentInstrument: z.literal('card'),
  status: z.literal('completed'),
  refundState: PledgeRefundStateSchema,
  disputeState: PledgeDisputeStateSchema,
  // How many disputes the pledge has had: 0 until the first, then 1, 2, … (pledgeDisputeNumberForEvent).
  // It tells one dispute from the next on this member-readable doc; Stripe's dispute id stays on the
  // server-only provider ref.
  disputeNumber: z.number().int().nonnegative(),
  // NO ageAttestedAt here: age-attestation evidence is server-only and lives on
  // PledgePaymentProviderRefSchema. This doc is auth-readable by every signed-in member.
  createdAt: z.number(),
  updatedAt: z.number(),
}).superRefine((val, ctx) => {
  if ((val.disputeNumber === 0) !== (val.disputeState === 'none')) {
    ctx.addIssue({ code: 'custom', path: ['disputeNumber'] });
  }
});
export type PledgePayment = z.infer<typeof PledgePaymentSchema>;

// pledgePaymentProviderRefs/{pledgePaymentId} — server-only Stripe references for reconciliation
// and refund/dispute lookup, PLUS the age-attestation consent evidence. Rule is permanently
// `if false` (Admin SDK only) so no Stripe IDs ever sit on an auth-readable doc. One doc per pledge
// (singular).
export const PledgePaymentProviderRefSchema = z.object({
  pledgePaymentId: z.string(),
  userId: z.string(),
  stripeSessionId: z.string(),
  paymentIntentId: z.string(),
  latestChargeId: z.string().nullable(), // resolved when known; null at launch if not fetched
  refundIds: z.array(z.string()), // every Stripe refund id seen on the charge; [] on a new pledge
  disputeId: z.string().nullable(), // the dispute the ledger's disputeState describes (the latest opened), null until one opens
  // Server timestamp (ms) of the checkout's 18+/public-disclosure attestation, stamped at session
  // creation and carried through Stripe metadata. A paid session missing it is quarantined. It is
  // fraud-evidence plumbing, not transparency data, so it rides THIS server-only doc and never the
  // member-readable pledgePayments ledger (docs/design/donation-payment-system.md § Data model).
  ageAttestedAt: z.number(),
  // The founder legal-review notice acknowledgment given at checkout (its own required checkbox
  // on every pledge while the notice is active): the revision and server time, stamped at session
  // creation and carried through the Stripe metadata like `ageAttestedAt`. Absent when the notice
  // was off. Evidence, not transparency data — it rides this server-only doc only.
  legalReviewNotice: LegalReviewNoticeReceiptSchema.optional(),
  // The refund an approval asks Stripe for: written in the transaction that moves its request to
  // `approving` (before Stripe is called), `refundId` stamped once Stripe answers, removed when the
  // request reaches `completed` or `failed`. A request is finished only by a refund matching it.
  refundCorrelation: z
    .object({
      requestId: z.string().min(1),
      intendedAmount: z.number().int().positive(),
      refundId: z.string().min(1).optional(),
    })
    .optional(),
  // The Stripe event time (epoch ms) the refund handler and the dispute handler last applied. Stripe
  // can deliver events out of order, so each handler applies an event only when it is newer.
  refundObservedAt: z.number().optional(),
  disputeObservedAt: z.number().optional(),
  // Stripe's reason for the last failed refund, kept server-side for the admin following up.
  lastRefundFailureReason: z.string().max(MAX_INTERNAL_REASON_LENGTH).optional(),
  createdAt: z.number(),
  updatedAt: z.number(),
});
export type PledgePaymentProviderRef = z.infer<typeof PledgePaymentProviderRefSchema>;

// pledgePaymentTotals/summary — the stored running-totals singleton behind every "total raised"
// surface. Incremented via FieldValue.increment INSIDE the Stripe webhook's pledge-record
// transaction (same commit as the pledgePayments doc — the two can never drift on a completed
// pledge); the refund and dispute handlers adjust it in the transaction that changes the pledge,
// through pledgePaymentTotalsOf (utils/pledge-totals). Auth-readable, server-only
// writes. An idempotent recompute script rebuilds/verifies it from pledgePayments for drift
// repair. Shape mirrors the PledgePaymentTotals view-model + updatedAt.
export const PledgePaymentTotalsDocSchema = z.object({
  netRaised: z.number(),
  grossRaised: z.number(),
  totalRefunded: z.number(),
  pledgeCount: z.number(),
  updatedAt: z.number(),
});
export type PledgePaymentTotalsDoc = z.infer<typeof PledgePaymentTotalsDocSchema>;

// processedStripeEvents/{stripeEventId} — idempotency sentinel, one doc per processed Stripe
// event.id, kept forever. Checked + written in the same transaction as the side effect so a
// redelivered event (completion, expiry, failure, or quarantine) produces no duplicate.
// pledgePaymentId is set only when the event created a pledge. (runProcessStripePledgeEvent.ts)
export const ProcessedStripeEventSchema = z.object({
  eventId: z.string(),
  eventType: z.string(),
  processedAt: z.number(),
  pledgePaymentId: z.string().nullable(),
});
export type ProcessedStripeEvent = z.infer<typeof ProcessedStripeEventSchema>;

// pledgePaymentLedgerEvents/{ledgerId} — independent integrity record from the onPledgePaymentWritten
// trigger (mirrors stakeShareAuditEvents). before/after are raw doc snapshots (null on create/delete)
// kept as permissive bags so a malformed/anomalous write is still captured forensically.
// (functions/src/audit/runPledgePaymentLedgerAudit.ts)
export const PledgePaymentLedgerEventSchema = z.object({
  ledgerId: z.string(),
  pledgePaymentId: z.string(),
  subtype: z.string(), // e.g. 'created' | 'anomaly'
  reason: z.string(),
  before: z.record(z.string(), z.unknown()).nullable(),
  after: z.record(z.string(), z.unknown()).nullable(),
  source: z.literal('firestore-trigger'),
  createdAt: z.number(),
});
export type PledgePaymentLedgerEvent = z.infer<typeof PledgePaymentLedgerEventSchema>;

// paymentWebhookQuarantine/{stripeEventId} — admin-readable repair queue for paid-but-malformed
// events (e.g. missing metadata) that must NOT make Stripe retry. Redaction rule: never store raw
// payloads, card/billing data, customer email, addresses, or receipt URLs — IDs + a short redacted
// rawSafeSummary only. (functions/src/payments/runProcessStripePledgeEvent.ts)
export const PaymentWebhookQuarantineSchema = z.object({
  eventId: z.string(),
  eventType: z.string(),
  livemode: z.boolean(),
  reason: z.string(),
  recoverable: z.boolean(),
  stripeObjectIds: z.object({
    sessionId: z.string().optional(),
    paymentIntentId: z.string().optional(),
    chargeId: z.string().optional(),
  }),
  pledgePaymentId: z.string().optional(),
  userId: z.string().optional(),
  amount: z.number().optional(),
  currency: z.string().optional(),
  rawSafeSummary: z.string(),
  status: z.enum(['open', 'resolved', 'ignored']),
  adminTaskId: z.string().optional(),
  createdAt: z.number(),
  resolvedAt: z.number().optional(),
  resolvedBy: z.string().optional(),
  resolutionNote: z.string().optional(),
});
export type PaymentWebhookQuarantine = z.infer<typeof PaymentWebhookQuarantineSchema>;

// pledgeRefundRequests/{requestId} — a supporter's pledge refund request. Lifecycle: requested →
// (admin approves) approving → initiated → completed, or → failed when Stripe reports the refund
// failed, which raises a pledgeRefundFailed admin task; requested → denied by an admin. A full refund of the pledge from anywhere, the Stripe
// Dashboard included, completes an open request. NO Stripe ids on this doc — they live on
// pledgePaymentProviderRefs. Server-only writes. Timestamps are epoch-millis numbers.
export const PLEDGE_REFUND_REQUEST_STATUSES = [
  'requested',
  'approving',
  'initiated',
  'denied',
  'completed',
  'failed',
] as const;
export const PledgeRefundRequestStatusSchema = z.enum(PLEDGE_REFUND_REQUEST_STATUSES);
export type PledgeRefundRequestStatus = z.infer<typeof PledgeRefundRequestStatusSchema>;

/** The statuses of a request in flight. A failed request is open too until its follow-up is resolved. */
export const PLEDGE_REFUND_OPEN_STATUSES = [
  'requested',
  'approving',
  'initiated',
] as const satisfies readonly PledgeRefundRequestStatus[];

/**
 * Whether a request still blocks a new one for its pledge (a pledge has at most one open request):
 * in flight, or failed while an admin is still following the failure up — the supporter may not
 * ask again until that follow-up is resolved.
 */
export function isPledgeRefundRequestOpen(
  request: Pick<PledgeRefundRequest, 'status' | 'failureFollowUpResolvedAt'>,
): boolean {
  if (request.status === 'failed') return request.failureFollowUpResolvedAt === undefined;
  return (PLEDGE_REFUND_OPEN_STATUSES as readonly PledgeRefundRequestStatus[]).includes(request.status);
}

export const PledgeRefundRequestSchema = z.object({
  pledgePaymentId: z.string(),
  userId: z.string(),
  amount: z.number(),
  status: PledgeRefundRequestStatusSchema,
  reason: z.string().optional(), // the requester's stated reason
  denialReason: z.string().optional(), // set when an admin denies
  resolvedBy: z.string().optional(), // admin uid who approved/denied
  requestedAt: z.number(),
  resolvedAt: z.number().optional(),
  approvingAt: z.number().optional(), // when an admin's approval began, before Stripe was called
  completedAt: z.number().optional(),
  failedAt: z.number().optional(), // when Stripe reported the refund failed
  // When an admin resolved the failed refund's follow-up task (the refund decision that closes it).
  // Only a failed request carries it; until it is set, the failed request keeps its pledge open.
  failureFollowUpResolvedAt: z.number().optional(),
}).superRefine((val, ctx) => {
  if (val.failureFollowUpResolvedAt !== undefined && val.status !== 'failed') {
    ctx.addIssue({ code: 'custom', path: ['failureFollowUpResolvedAt'] });
  }
});
export type PledgeRefundRequest = z.infer<typeof PledgeRefundRequestSchema>;
