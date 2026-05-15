import { z } from 'zod';
import { MAX_DONATION_AMOUNT_CENTS } from '../constants/business.js';

export const CreateStripeCheckoutSessionInputSchema = z.object({
  amount: z.number().int().min(50).max(MAX_DONATION_AMOUNT_CENTS),
  message: z.string().max(500).optional(),
}).strict();
export type CreateStripeCheckoutSessionInput = z.infer<typeof CreateStripeCheckoutSessionInputSchema>;
