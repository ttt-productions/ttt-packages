import { z } from 'zod';
import {
  MIN_PLEDGE_PAYMENT_AMOUNT_CENTS,
  MAX_PLEDGE_PAYMENT_AMOUNT_CENTS,
} from '../constants/business.js';

export const CreateStripeCheckoutSessionInputSchema = z.object({
  amount: z.number().int().min(MIN_PLEDGE_PAYMENT_AMOUNT_CENTS).max(MAX_PLEDGE_PAYMENT_AMOUNT_CENTS),
  // One-time attempt id, generated client-side per payment intent and stable
  // across retries of the same submit. The server derives pledgePaymentId from
  // it and passes a Stripe idempotency key so a double-submit returns the SAME
  // Checkout Session instead of creating a duplicate.
  checkoutAttemptId: z.string().uuid(),
  // Payments are 18+ (site policy: 13+ to use, 18+ to pay). The checkout checkbox carries the
  // age attestation AND the public-pledge transparency disclosure; the callable rejects when it
  // is absent and stamps ageAttestedAt onto the pledge record so the consent is provable.
  ageAttested: z.literal(true),
}).strict();
export type CreateStripeCheckoutSessionInput = z.infer<typeof CreateStripeCheckoutSessionInputSchema>;

// User-initiated pledge refund request (post-launch). The callable resolves userId from auth and
// enforces the PLEDGE_REFUND_REQUEST_WINDOW_MS eligibility window server-side; the client only
// names which pledge it wants refunded.
export const RequestPledgeRefundInputSchema = z.object({
  pledgePaymentId: z.string(),
}).strict();
export type RequestPledgeRefundInput = z.infer<typeof RequestPledgeRefundInputSchema>;

// Admin resolution of a pending pledge refund request: approve (initiate the Stripe refund) or deny.
// `denialReason` is REQUIRED when denying and forbidden/ignored otherwise.
export const AdminResolvePledgeRefundRequestInputSchema = z.object({
  requestId: z.string(),
  decision: z.enum(['approve', 'deny']),
  denialReason: z.string().optional(),
}).strict().refine(
  (v) => v.decision !== 'deny' || (typeof v.denialReason === 'string' && v.denialReason.length > 0),
  { message: 'denialReason is required when decision is "deny"', path: ['denialReason'] },
);
export type AdminResolvePledgeRefundRequestInput = z.infer<typeof AdminResolvePledgeRefundRequestInputSchema>;

