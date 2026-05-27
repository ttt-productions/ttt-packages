import { z } from 'zod';
import type { UploadState } from '@ttt-productions/media-schemas';

const onProgressSchema = z
  .function()
  .args(z.custom<UploadState | null>())
  .returns(z.void())
  .optional();

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

