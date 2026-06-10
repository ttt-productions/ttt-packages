import { z } from 'zod';
import { onProgressSchema } from './on-progress.js';


export const UpdateChapterMediaVariablesSchema = z.object({
  workProjectId: z.string().min(1),
  taleId: z.string().min(1),
  chapterId: z.string().min(1),
  file: z.instanceof(File).or(z.instanceof(Blob)),
  mediaKey: z.literal('photoUrl'),
  onProgress: onProgressSchema,
  signal: z.instanceof(AbortSignal).optional(),
}).strict();
export type UpdateChapterMediaVariables = z.infer<typeof UpdateChapterMediaVariablesSchema>;

