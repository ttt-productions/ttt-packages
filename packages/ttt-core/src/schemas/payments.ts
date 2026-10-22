import { z } from 'zod';
import { PLEDGE_REFUND_DENIAL_REASON_INPUT } from '../constants/text-fields.js';
import {
  MIN_PLEDGE_PAYMENT_AMOUNT_CENTS,
  MAX_PLEDGE_PAYMENT_AMOUNT_CENTS,
  MAX_STRIPE_CHECKOUT_SESSION_ID_LENGTH,
} from '../constants/business-platform.js';
import { PLEDGE_ATTESTATION_VERSION } from '../constants/member-agreements.js';
import { textFieldSchema } from './text-field.js';
import { PledgePaymentSchema, PledgeRefundRequestSchema } from '../doc-schemas/payments.js';
import {
  LegalReviewNoticeAcknowledgedInputSchema,
  pledgePaymentIdSchema,
  pledgeRefundRequestIdSchema,
  unpaddedValueSchema,
} from './atoms.js';

export const CreateStripeCheckoutSessionInputSchema = z
  .object({
    amount: z
      .number()
      .int()
      .min(MIN_PLEDGE_PAYMENT_AMOUNT_CENTS)
      .max(MAX_PLEDGE_PAYMENT_AMOUNT_CENTS),
    checkoutAttemptId: z.string().uuid(),
    ageAttested: z.literal(true),
    attestationVersion: z.literal(PLEDGE_ATTESTATION_VERSION),
    legalReviewNoticeAcknowledged: LegalReviewNoticeAcknowledgedInputSchema,
  })
  .strict();
export type CreateStripeCheckoutSessionInput = z.infer<
  typeof CreateStripeCheckoutSessionInputSchema
>;

export const CreateStripeCheckoutSessionResultSchema = z.object({
  url: z.string().min(1),
});
export type CreateStripeCheckoutSessionResult = z.infer<
  typeof CreateStripeCheckoutSessionResultSchema
>;

export const RequestPledgeRefundInputSchema = z
  .object({
    pledgePaymentId: pledgePaymentIdSchema,
  })
  .strict();
export type RequestPledgeRefundInput = z.infer<typeof RequestPledgeRefundInputSchema>;

export const RequestPledgeRefundResultSchema = z.object({
  success: z.literal(true),
  requestId: pledgeRefundRequestIdSchema,
  status: z.literal('requested'),
});
export type RequestPledgeRefundResult = z.infer<typeof RequestPledgeRefundResultSchema>;

export const AdminResolvePledgeRefundRequestInputSchema = z
  .object({
    requestId: pledgeRefundRequestIdSchema,
    decision: z.enum(['approve', 'deny', 'resolveFailure']),
    denialReason: textFieldSchema(PLEDGE_REFUND_DENIAL_REASON_INPUT).optional(),
  })
  .strict()
  .refine(
    (v) =>
      v.decision !== 'deny' || (typeof v.denialReason === 'string' && v.denialReason.length > 0),
    { message: 'denialReason is required when decision is "deny"', path: ['denialReason'] },
  );
export type AdminResolvePledgeRefundRequestInput = z.infer<
  typeof AdminResolvePledgeRefundRequestInputSchema
>;

export const AdminResolvePledgeRefundRequestResultSchema = z.object({
  success: z.literal(true),
  status: PledgeRefundRequestSchema.shape.status,
  refundId: z.string().min(1).optional(),
  auditEventId: z.string().min(1).optional(),
});
export type AdminResolvePledgeRefundRequestResult = z.infer<
  typeof AdminResolvePledgeRefundRequestResultSchema
>;

export const GetMyPledgeByCheckoutSessionInputSchema = z
  .object({
    sessionId: unpaddedValueSchema.max(MAX_STRIPE_CHECKOUT_SESSION_ID_LENGTH),
  })
  .strict();
export type GetMyPledgeByCheckoutSessionInput = z.infer<
  typeof GetMyPledgeByCheckoutSessionInputSchema
>;

// Read off `.shape`: the ledger's whole-document refinement keeps zod from `pick`ing it.
const pledgeFields = PledgePaymentSchema.shape;
export const PledgeDisplaySchema = z.object({
  pledgePaymentId: pledgeFields.pledgePaymentId,
  amount: pledgeFields.amount,
  netAmount: pledgeFields.netAmount,
  currency: pledgeFields.currency,
  status: pledgeFields.status,
  createdAt: pledgeFields.createdAt,
});
export type PledgeDisplay = z.infer<typeof PledgeDisplaySchema>;

export const GetMyPledgeByCheckoutSessionResultSchema = PledgeDisplaySchema.nullable();
export type GetMyPledgeByCheckoutSessionResult = z.infer<
  typeof GetMyPledgeByCheckoutSessionResultSchema
>;
