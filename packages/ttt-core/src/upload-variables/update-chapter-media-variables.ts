import { z } from 'zod';
import { ClientMediaClaimSchema } from '@ttt-productions/media-schemas';
import { onProgressSchema } from './on-progress.js';


export const UpdateChapterMediaVariablesSchema = z.object({
  workProjectId: z.string().min(1),
  taleId: z.string().min(1),
  chapterId: z.string().min(1),
  file: z.instanceof(File).or(z.instanceof(Blob)),

  // Untrusted client claim of what the user's action implies (advisory; the

  // server byte inspection is the only classification authority).

  claim: ClientMediaClaimSchema.optional(),
  mediaKey: z.literal('photoAssetId'),
  onProgress: onProgressSchema,
  signal: z.instanceof(AbortSignal).optional(),
}).strict();
export type UpdateChapterMediaVariables = z.infer<typeof UpdateChapterMediaVariablesSchema>;

