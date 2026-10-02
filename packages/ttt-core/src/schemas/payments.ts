import { z } from 'zod';
import {
  MIN_PLEDGE_PAYMENT_AMOUNT_CENTS,
  MAX_PLEDGE_PAYMENT_AMOUNT_CENTS,
  MAX_STRIPE_CHECKOUT_SESSION_ID_LENGTH,
} from '../constants/business.js';
import { PledgePaymentSchema } from '../doc-schemas/payments.js';
import {
  LegalReviewNoticeAcknowledgedInputSchema,
  pledgePaymentIdSchema,
  pledgeRefundRequestIdSchema,
} from './atoms.js';

export const CreateStripeCheckoutSessionInputSchema = z.object({
  amount: z.number().int().min(MIN_PLEDGE_PAYMENT_AMOUNT_CENTS).max(MAX_PLEDGE_PAYMENT_AMOUNT_CENTS),
  // One-time attempt id, generated client-side per payment intent and stable
  // across retries of the same submit. The server derives pledgePaymentId from
  // it and passes a Stripe idempotency key so a double-submit returns the SAME
  // Checkout Session instead of creating a duplicate.
  checkoutAttemptId: z.string().uuid(),
  // Payments are 18+ (site policy: 13+ to use, 18+ to pay). The checkout checkbox carries the
  // age attestation AND the public-pledge transparency disclosure; the callable rejects when it
  // is absent and stamps ageAttestedAt onto the SERVER-ONLY pledgePaymentProviderRefs doc (never
  // the member-readable pledgePayments ledger) so the consent is provable.
  ageAttested: z.literal(true),
  // The founder legal-review notice checkbox — its own required checkbox on every pledge while
  // the notice is active (the callable refuses a checkout without it then, and records the
  // receipt from `buildLegalReviewNoticeReceipt`). Omitted, or null, while the notice is off.
  legalReviewNoticeAcknowledged: LegalReviewNoticeAcknowledgedInputSchema,
}).strict();
export type CreateStripeCheckoutSessionInput = z.infer<typeof CreateStripeCheckoutSessionInputSchema>;

// User-initiated pledge refund request (post-launch). The callable resolves userId from auth and
// enforces the PLEDGE_REFUND_REQUEST_WINDOW_MS eligibility window server-side; the client only
// names which pledge it wants refunded.
export const RequestPledgeRefundInputSchema = z.object({
  pledgePaymentId: pledgePaymentIdSchema,
}).strict();
export type RequestPledgeRefundInput = z.infer<typeof RequestPledgeRefundInputSchema>;

// Admin resolution of a pledge refund request: approve or deny a requested one (approve initiates the
// Stripe refund), or resolveFailure — close the follow-up of a failed refund, which lets the
// supporter request again. `denialReason` is REQUIRED when denying.
export const AdminResolvePledgeRefundRequestInputSchema = z.object({
  requestId: pledgeRefundRequestIdSchema,
  decision: z.enum(['approve', 'deny', 'resolveFailure']),
  denialReason: z.string().optional(),
}).strict().refine(
  (v) => v.decision !== 'deny' || (typeof v.denialReason === 'string' && v.denialReason.length > 0),
  { message: 'denialReason is required when decision is "deny"', path: ['denialReason'] },
);
export type AdminResolvePledgeRefundRequestInput = z.infer<typeof AdminResolvePledgeRefundRequestInputSchema>;

// The checkout success page's lookup of the caller's own pledge by its Stripe Checkout session id.
// The server resolves the session against the server-only provider reference and answers the pledge
// as PledgeDisplay, or null while the webhook has not recorded it yet.
export const GetMyPledgeByCheckoutSessionInputSchema = z.object({
  sessionId: z.string().min(1).max(MAX_STRIPE_CHECKOUT_SESSION_ID_LENGTH),
}).strict();
export type GetMyPledgeByCheckoutSessionInput = z.infer<typeof GetMyPledgeByCheckoutSessionInputSchema>;

/** The pledge fields the success page shows — never a Stripe id. */
export const PledgeDisplaySchema = PledgePaymentSchema.pick({
  pledgePaymentId: true,
  amount: true,
  netAmount: true,
  currency: true,
  status: true,
  createdAt: true,
});
export type PledgeDisplay = z.infer<typeof PledgeDisplaySchema>;
