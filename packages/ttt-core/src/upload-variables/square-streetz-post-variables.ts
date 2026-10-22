import { z } from 'zod';
import { ClientMediaClaimSchema } from '@ttt-productions/media-schemas';
import { onProgressSchema } from './on-progress.js';
import {
  SquareStreetzPostMentionsSchema,
  SquareStreetzPostTextSchema,
  refineMentionCorrespondence,
} from '../media/atoms.js';
import { userIdSchema } from '../schemas/atoms.js';

export const SquareStreetzPostVariablesSchema = z
  .object({
    userId: userIdSchema,
    content: SquareStreetzPostTextSchema,
    mentions: SquareStreetzPostMentionsSchema,
    mediaFile: z.instanceof(File).nullish(),

    claim: ClientMediaClaimSchema.optional(),
    onProgress: onProgressSchema,
    signal: z.instanceof(AbortSignal).optional(),
  })
  .strict()
  .superRefine((variables, ctx) =>
    refineMentionCorrespondence(variables.content, variables.mentions, ctx),
  );
export type SquareStreetzPostVariables = z.infer<typeof SquareStreetzPostVariablesSchema>;
