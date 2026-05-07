import { z } from 'zod';
import { opportunityIdSchema } from './atoms.js';

export const CloseOpportunityInputSchema = z.object({
  opportunityId: opportunityIdSchema,
}).strict();
export type CloseOpportunityInput = z.infer<typeof CloseOpportunityInputSchema>;
