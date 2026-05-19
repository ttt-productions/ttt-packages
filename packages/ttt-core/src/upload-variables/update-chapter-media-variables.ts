import { z } from 'zod';
import type { UploadState } from '@ttt-productions/media-contracts';

const onProgressSchema = z
  .function()
  .args(z.custom<UploadState | null>())
  .returns(z.void())
  .optional();

export const UpdateChapterMediaVariablesSchema = z.object({
  projectId: z.string().min(1),
  taleId: z.string().min(1),
  chapterId: z.string().min(1),
  file: z.instanceof(File).or(z.instanceof(Blob)),
  mediaKey: z.literal('photoUrl'),
  onProgress: onProgressSchema,
}).strict();
export type UpdateChapterMediaVariables = z.infer<typeof UpdateChapterMediaVariablesSchema>;
