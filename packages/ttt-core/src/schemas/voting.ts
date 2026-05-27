import { z } from 'zod';
import { auditionIdSchema, auditionEntryIdSchema } from './atoms.js';

export const VoteForOpportunityReplyInputSchema = z.object({
  opportunityId: auditionIdSchema,
  newVote: z.object({
    replyId: auditionEntryIdSchema,
  }).strict(),
  // Accepted for backwards compatibility but ignored server-side; see runtime comment below.
  currentVoteId: z.string().nullable().optional(),
}).strict();
export type VoteForOpportunityReplyInput = z.infer<typeof VoteForOpportunityReplyInputSchema>;
