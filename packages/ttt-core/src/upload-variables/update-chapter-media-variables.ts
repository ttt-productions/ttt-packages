import { z } from 'zod';
import {
  workProjectIdSchema,
  taleIdSchema,
  chapterIdSchema,
} from '../schemas/atoms.js';
import { ClientMediaClaimSchema } from '@ttt-productions/media-schemas';
import { onProgressSchema } from './on-progress.js';


export const UpdateChapterMediaVariablesSchema = z.object({
  workProjectId: workProjectIdSchema,
  taleId: taleIdSchema,
  chapterId: chapterIdSchema,
  file: z.instanceof(File).or(z.instanceof(Blob)),

  // Untrusted client claim of what the user's action implies (advisory; the

  // server byte inspection is the only classification authority).

  claim: ClientMediaClaimSchema.optional(),
  mediaKey: z.literal('photoAssetId'),
  onProgress: onProgressSchema,
  signal: z.instanceof(AbortSignal).optional(),
}).strict();
export type UpdateChapterMediaVariables = z.infer<typeof UpdateChapterMediaVariablesSchema>;

