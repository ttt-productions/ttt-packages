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

