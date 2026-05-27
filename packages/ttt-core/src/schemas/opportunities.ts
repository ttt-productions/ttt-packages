import { z } from 'zod';
import { auditionIdSchema } from './atoms.js';

export const CloseOpportunityInputSchema = z.object({
  opportunityId: auditionIdSchema,
}).strict();
export type CloseOpportunityInput = z.infer<typeof CloseOpportunityInputSchema>;
