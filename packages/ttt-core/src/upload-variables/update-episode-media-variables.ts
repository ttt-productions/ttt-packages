import { z } from 'zod';
import { onProgressSchema } from './on-progress.js';


export const UpdateTelevisionEpisodeMediaVariablesSchema = z.object({
  workProjectId: z.string().min(1),
  televisionId: z.string().min(1),
  episodeId: z.string().min(1),
  file: z.instanceof(File).or(z.instanceof(Blob)),
  mediaKey: z.enum(['photoAssetId', 'videoAssetId']),
  onProgress: onProgressSchema,
  signal: z.instanceof(AbortSignal).optional(),
}).strict();
export type UpdateTelevisionEpisodeMediaVariables = z.infer<typeof UpdateTelevisionEpisodeMediaVariablesSchema>;

