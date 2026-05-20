import { z } from 'zod';
import type { UploadState } from '@ttt-productions/media-schemas';

const onProgressSchema = z
  .function()
  .args(z.custom<UploadState | null>())
  .returns(z.void())
  .optional();

export const UpdateShowMediaVariablesSchema = z.object({
  projectId: z.string().min(1),
  televisionId: z.string().min(1),
  showId: z.string().min(1),
  file: z.instanceof(File).or(z.instanceof(Blob)),
  mediaKey: z.enum(['photoUrl', 'videoUrl']),
  onProgress: onProgressSchema,
}).strict();
export type UpdateShowMediaVariables = z.infer<typeof UpdateShowMediaVariablesSchema>;
