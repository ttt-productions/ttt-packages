import { z } from 'zod';
import type { UploadState } from '@ttt-productions/media-schemas';

const onProgressSchema = z
  .function()
  .args(z.custom<UploadState | null>())
  .returns(z.void())
  .optional();

export const UpdateTelevisionEpisodeMediaVariablesSchema = z.object({
  projectId: z.string().min(1),
  televisionId: z.string().min(1),
  episodeId: z.string().min(1),
  file: z.instanceof(File).or(z.instanceof(Blob)),
  mediaKey: z.enum(['photoUrl', 'videoUrl']),
  onProgress: onProgressSchema,
  signal: z.instanceof(AbortSignal).optional(),
}).strict();
export type UpdateTelevisionEpisodeMediaVariables = z.infer<typeof UpdateTelevisionEpisodeMediaVariablesSchema>;
