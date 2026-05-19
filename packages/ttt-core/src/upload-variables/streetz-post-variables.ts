import { z } from 'zod';
import type { UploadState } from '@ttt-productions/media-contracts';
import { MentionSchema } from '@ttt-productions/media-contracts';
import { userIdSchema } from '../schemas/atoms.js';
import { MAX_POST_LENGTH } from '../constants/business.js';

const onProgressSchema = z
  .function()
  .args(z.custom<UploadState | null>())
  .returns(z.void())
  .optional();

export const StreetzPostVariablesSchema = z.object({
  userId: userIdSchema,
  content: z.string().max(MAX_POST_LENGTH),
  mentions: z.array(MentionSchema),
  mediaFile: z.instanceof(File).nullish(),
  onProgress: onProgressSchema,
}).strict();
export type StreetzPostVariables = z.infer<typeof StreetzPostVariablesSchema>;
