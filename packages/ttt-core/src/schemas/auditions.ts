import { z } from 'zod';
import { auditionIdSchema } from './atoms.js';

export const CloseAuditionInputSchema = z.object({
  auditionId: auditionIdSchema,
}).strict();
export type CloseAuditionInput = z.infer<typeof CloseAuditionInputSchema>;


