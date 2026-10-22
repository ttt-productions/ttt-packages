import { z } from 'zod';
import { LegalReviewNoticeReceiptSchema } from './legal-review-notice.js';
import { MAX_INTERNAL_REASON_LENGTH } from '../constants/business-admin.js';

export const PLEDGE_REFUND_STATES = ['none', 'partial', 'full'] as const;
export const PledgeRefundStateSchema = z.enum(PLEDGE_REFUND_STATES);
export type PledgeRefundState = z.infer<typeof PledgeRefundStateSchema>;

export const PLEDGE_DISPUTE_STATES = ['none', 'underReview', 'won', 'lost'] as const;
export const PledgeDisputeStateSchema = z.enum(PLEDGE_DISPUTE_STATES);
export type PledgeDisputeState = z.infer<typeof PledgeDisputeStateSchema>;

const PLEDGE_DISPUTE_STATE_RANK: Record<PledgeDisputeState, number> = {
  none: 0,
  underReview: 1,
  won: 2,
  lost: 2,
};

export function pledgeDisputeStateRank(state: PledgeDisputeState): number {
  return PLEDGE_DISPUTE_STATE_RANK[state];
}

// Stripe can deliver a dispute's events late, twice, or out of order.
export function isPledgeDisputeAdvance(from: PledgeDisputeState, to: PledgeDisputeState): boolean {
  return pledgeDisputeStateRank(to) > pledgeDisputeStateRank(from);
}

export function isPledgeDisputeEventApplicable(
  recorded: { disputeId: string | null; state: PledgeDisputeState },
  event: { disputeId: string; state: PledgeDisputeState },
): boolean {
  if (recorded.disputeId !== event.disputeId) return true;
  return isPledgeDisputeAdvance(recorded.state, event.state);
}

export function pledgeDisputeNumberForEvent(
  recorded: { disputeId: string | null; disputeNumber: number },
  eventDisputeId: string,
): number {
  return recorded.disputeId === eventDisputeId
    ? recorded.disputeNumber
    : recorded.disputeNumber + 1;
}

export function isPledgeDisputeTransitionLegal(
  before: { disputeNumber: number; disputeState: PledgeDisputeState },
  after: { disputeNumber: number; disputeState: PledgeDisputeState },
): boolean {
  if (after.disputeNumber === before.disputeNumber) {
    return (
      after.disputeState === before.disputeState ||
      isPledgeDisputeAdvance(before.disputeState, after.disputeState)
    );
  }
  if (after.disputeNumber === before.disputeNumber + 1) return after.disputeState !== 'none';
  return false;
}

export const PledgePaymentSchema = z
  .object({
    pledgePaymentId: z.string(),
    userId: z.string(),
    amount: z.number(),
    refundedAmount: z.number(),
    disputeLostAmount: z.number(),
    netAmount: z.number(),
    currency: z.string(),
    paymentInstrument: z.literal('card'),
    status: z.literal('completed'),
    refundState: PledgeRefundStateSchema,
    disputeState: PledgeDisputeStateSchema,
    disputeNumber: z.number().int().nonnegative(),
    createdAt: z.number(),
    updatedAt: z.number(),
  })
  .superRefine((val, ctx) => {
    if ((val.disputeNumber === 0) !== (val.disputeState === 'none')) {
      ctx.addIssue({ code: 'custom', path: ['disputeNumber'] });
    }
  });
export type PledgePayment = z.infer<typeof PledgePaymentSchema>;

export const PledgePaymentProviderRefSchema = z.object({
  pledgePaymentId: z.string(),
  userId: z.string(),
  stripeSessionId: z.string(),
  paymentIntentId: z.string(),
  latestChargeId: z.string().nullable(),
  refundIds: z.array(z.string()),
  disputeId: z.string().nullable(),
  ageAttestedAt: z.number(),
  ageAttestationVersion: z.number().int().positive(),
  legalReviewNotice: LegalReviewNoticeReceiptSchema.optional(),
  refundCorrelation: z
    .object({
      requestId: z.string().min(1),
      intendedAmount: z.number().int().positive(),
      refundId: z.string().min(1).optional(),
    })
    .optional(),
  refundObservedAt: z.number().optional(),
  disputeObservedAt: z.number().optional(),
  lastRefundFailureReason: z.string().max(MAX_INTERNAL_REASON_LENGTH).optional(),
  createdAt: z.number(),
  updatedAt: z.number(),
});
export type PledgePaymentProviderRef = z.infer<typeof PledgePaymentProviderRefSchema>;

export const PledgePaymentTotalsDocSchema = z.object({
  netRaised: z.number(),
  grossRaised: z.number(),
  totalRefunded: z.number(),
  pledgeCount: z.number(),
  updatedAt: z.number(),
});
export type PledgePaymentTotalsDoc = z.infer<typeof PledgePaymentTotalsDocSchema>;

export const ProcessedStripeEventSchema = z.object({
  eventId: z.string(),
  eventType: z.string(),
  processedAt: z.number(),
  pledgePaymentId: z.string().nullable(),
});
export type ProcessedStripeEvent = z.infer<typeof ProcessedStripeEventSchema>;

export const PledgePaymentLedgerEventSchema = z.object({
  ledgerId: z.string(),
  pledgePaymentId: z.string(),
  subtype: z.string(),
  reason: z.string(),
  before: z.record(z.string(), z.unknown()).nullable(),
  after: z.record(z.string(), z.unknown()).nullable(),
  source: z.literal('firestore-trigger'),
  createdAt: z.number(),
});
export type PledgePaymentLedgerEvent = z.infer<typeof PledgePaymentLedgerEventSchema>;

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

export const PLEDGE_REFUND_EVENT_REQUEST_STATUSES = [
  'completed',
  'failed',
] as const satisfies readonly PledgeRefundRequestStatus[];
export type PledgeRefundEventRequestStatus = (typeof PLEDGE_REFUND_EVENT_REQUEST_STATUSES)[number];

export const PLEDGE_REFUND_OPEN_STATUSES = [
  'requested',
  'approving',
  'initiated',
] as const satisfies readonly PledgeRefundRequestStatus[];

export function isPledgeRefundRequestOpen(
  request: Pick<PledgeRefundRequest, 'status' | 'failureFollowUpResolvedAt'>,
): boolean {
  if (request.status === 'failed') return request.failureFollowUpResolvedAt === undefined;
  return (PLEDGE_REFUND_OPEN_STATUSES as readonly PledgeRefundRequestStatus[]).includes(
    request.status,
  );
}

export const PledgeRefundRequestSchema = z
  .object({
    pledgePaymentId: z.string(),
    userId: z.string(),
    amount: z.number(),
    status: PledgeRefundRequestStatusSchema,
    reason: z.string().optional(),
    denialReason: z.string().optional(),
    resolvedBy: z.string().optional(),
    requestedAt: z.number(),
    resolvedAt: z.number().optional(),
    approvingAt: z.number().optional(),
    completedAt: z.number().optional(),
    failedAt: z.number().optional(),
    failureFollowUpResolvedAt: z.number().optional(),
  })
  .superRefine((val, ctx) => {
    if (val.failureFollowUpResolvedAt !== undefined && val.status !== 'failed') {
      ctx.addIssue({ code: 'custom', path: ['failureFollowUpResolvedAt'] });
    }
  });
export type PledgeRefundRequest = z.infer<typeof PledgeRefundRequestSchema>;
