import { z } from 'zod';
import { auditionIdSchema, auditionEntryIdSchema } from './atoms.js';

export const VoteForAuditionEntryInputSchema = z.object({
  auditionId: auditionIdSchema,
  newVote: z.object({
    auditionEntryId: auditionEntryIdSchema,
  }).strict(),
  // Accepted for backwards compatibility but ignored server-side; see runtime comment below.
  currentVoteId: z.string().nullable().optional(),
}).strict();
export type VoteForAuditionEntryInput = z.infer<typeof VoteForAuditionEntryInputSchema>;


