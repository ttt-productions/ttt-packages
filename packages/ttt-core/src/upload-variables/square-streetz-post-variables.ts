import { z } from 'zod';
import { onProgressSchema } from './on-progress.js';
import { MentionSchema, rejectDuplicateMentionPlaceholders } from '../media/atoms.js';
import { userIdSchema } from '../schemas/atoms.js';
import { MAX_POST_LENGTH, MAX_MENTIONS } from '../constants/business.js';


export const SquareStreetzPostVariablesSchema = z.object({
  userId: userIdSchema,
  content: z.string().max(MAX_POST_LENGTH),
  mentions: z
    .array(MentionSchema)
    .max(MAX_MENTIONS)
    .superRefine(rejectDuplicateMentionPlaceholders),
  mediaFile: z.instanceof(File).nullish(),
  onProgress: onProgressSchema,
  signal: z.instanceof(AbortSignal).optional(),
}).strict();
export type SquareStreetzPostVariables = z.infer<typeof SquareStreetzPostVariablesSchema>;


