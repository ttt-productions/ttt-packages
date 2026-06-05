import { z } from 'zod';
import {
  MIN_PLEDGE_PAYMENT_AMOUNT_CENTS,
  MAX_PLEDGE_PAYMENT_AMOUNT_CENTS,
} from '../constants/business.js';

export const CreateStripeCheckoutSessionInputSchema = z.object({
  amount: z.number().int().min(MIN_PLEDGE_PAYMENT_AMOUNT_CENTS).max(MAX_PLEDGE_PAYMENT_AMOUNT_CENTS),
}).strict();
export type CreateStripeCheckoutSessionInput = z.infer<typeof CreateStripeCheckoutSessionInputSchema>;

