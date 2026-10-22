import { z } from 'zod';
import { auditionIdSchema, auditionEntryIdSchema } from './atoms.js';

export const VoteForAuditionEntryInputSchema = z
  .object({
    auditionId: auditionIdSchema,
    newVote: z
      .object({
        auditionEntryId: auditionEntryIdSchema,
      })
      .strict(),
  })
  .strict();
export type VoteForAuditionEntryInput = z.infer<typeof VoteForAuditionEntryInputSchema>;

export const VoteForAuditionEntryResultSchema = z.object({
  success: z.literal(true),
  auditionId: auditionIdSchema,
  auditionEntryId: auditionEntryIdSchema,
  isVoted: z.literal(true),
  alreadyVoted: z.boolean(),
  voteCount: z.number().int().nonnegative(),
  previousAuditionEntryId: auditionEntryIdSchema.nullable(),
  previousVoteCount: z.number().int().nonnegative().optional(),
});
export type VoteForAuditionEntryResult = z.infer<typeof VoteForAuditionEntryResultSchema>;
