// Payment / pledge Firestore document SCHEMAS — the public-safe pledge ledger and its
// server-only companions: provider refs (Stripe IDs), the idempotency sentinel, the
// independent integrity trail, and the paid-event quarantine queue. Types inferred via
// z.infer. Money data lives here, never in social.ts.
// See docs/design/donation-payment-system.md and docs/PHASE_6_STRIPE.md.

import { z } from 'zod';

// pledgePayments/{pledgePaymentId} — public-safe canonical money record. One doc per completed
// pledge; never deleted/archived. No Stripe IDs, no supporter message. Auth-readable; server-only
// writes. netAmount = max(0, amount - refundedAmount - disputeLostAmount) is the sum() target.
// At launch refundedAmount/disputeLostAmount are 0 so netAmount === amount.
// (functions/src/payments/runProcessStripePledgeEvent.ts)
export const PledgePaymentSchema = z.object({
  pledgePaymentId: z.string(),
  userId: z.string(),
  amount: z.number(), // gross cents charged (Stripe-confirmed amount_total)
  refundedAmount: z.number(), // cumulative refunded cents; LAUNCH default 0
  disputeLostAmount: z.number(), // cents withdrawn on a lost dispute; LAUNCH default 0
  netAmount: z.number(), // max(0, amount - refundedAmount - disputeLostAmount); sum() target
  currency: z.string(), // "usd"
  paymentInstrument: z.literal('card'),
  status: z.literal('completed'),
  refundState: z.enum(['none', 'partial', 'full']), // LAUNCH always 'none'
  disputeState: z.enum(['none', 'underReview', 'won', 'lost']), // LAUNCH always 'none'
  // Server timestamp (ms) of the checkout's 18+/public-disclosure attestation, stamped at session
  // creation and carried through Stripe metadata. A paid session missing it is quarantined.
  ageAttestedAt: z.number(),
  createdAt: z.number(),
  updatedAt: z.number(),
});
export type PledgePayment = z.infer<typeof PledgePaymentSchema>;

// pledgePaymentProviderRefs/{pledgePaymentId} — server-only Stripe references for reconciliation
// and (post-launch) refund/dispute lookup. Rule is permanently `if false` (Admin SDK only) so no
// Stripe IDs ever sit on an auth-readable doc. One doc per pledge (singular). refundIds/disputeId
// are refund-ready, defaulted ([] / null) at launch — zero migration when handlers ship.
// (functions/src/payments/runProcessStripePledgeEvent.ts)
export const PledgePaymentProviderRefSchema = z.object({
  pledgePaymentId: z.string(),
  userId: z.string(),
  stripeSessionId: z.string(),
  paymentIntentId: z.string(),
  latestChargeId: z.string().nullable(), // resolved when known; null at launch if not fetched
  refundIds: z.array(z.string()), // post-launch; LAUNCH default []
  disputeId: z.string().nullable(), // post-launch; LAUNCH default null
  createdAt: z.number(),
  updatedAt: z.number(),
});
export type PledgePaymentProviderRef = z.infer<typeof PledgePaymentProviderRefSchema>;

// pledgePaymentTotals/summary — the stored running-totals singleton behind every "total raised"
// surface. Incremented via FieldValue.increment INSIDE the Stripe webhook's pledge-record
// transaction (same commit as the pledgePayments doc — the two can never drift on a completed
// pledge); refund/dispute paths decrement when those handlers ship. Auth-readable, server-only
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

// pledgeRefundRequests/{requestId} — user-initiated pledge refund request (post-launch handler).
// Lifecycle: requested → (admin approves) initiated → completed, or requested → (admin) denied.
// NO Stripe ids on this doc — the refund id lands on pledgePaymentProviderRefs.refundIds. Server-only
// writes. Timestamps are epoch-millis numbers (this repo never uses Firestore Timestamps).
export const PledgeRefundRequestSchema = z.object({
  pledgePaymentId: z.string(),
  userId: z.string(),
  amount: z.number(),
  status: z.enum(['requested', 'initiated', 'denied', 'completed']),
  reason: z.string().optional(), // the requester's stated reason
  denialReason: z.string().optional(), // set when an admin denies
  resolvedBy: z.string().optional(), // admin uid who approved/denied
  requestedAt: z.number(),
  resolvedAt: z.number().optional(),
  completedAt: z.number().optional(),
});
export type PledgeRefundRequest = z.infer<typeof PledgeRefundRequestSchema>;
