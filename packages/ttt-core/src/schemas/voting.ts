import { z } from 'zod';
import { opportunityIdSchema, replyIdSchema } from './atoms.js';

export const VoteForOpportunityReplyInputSchema = z.object({
  opportunityId: opportunityIdSchema,
  newVote: z.object({
    replyId: replyIdSchema,
  }).strict(),
  // Accepted for backwards compatibility but ignored server-side; see runtime comment below.
  currentVoteId: z.string().nullable().optional(),
}).strict();
export type VoteForOpportunityReplyInput = z.infer<typeof VoteForOpportunityReplyInputSchema>;
