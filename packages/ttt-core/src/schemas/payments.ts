import { z } from 'zod';

export const CreateStripeCheckoutSessionInputSchema = z.object({
  amount: z.number().int().min(50),
  message: z.string().max(500).optional(),
}).strict();
export type CreateStripeCheckoutSessionInput = z.infer<typeof CreateStripeCheckoutSessionInputSchema>;
