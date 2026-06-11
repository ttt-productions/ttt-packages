import { z } from 'zod';
import { onProgressSchema } from './on-progress.js';


export const UpdateTuneTrackMediaVariablesSchema = z.object({
  workProjectId: z.string().min(1),
  tuneId: z.string().min(1),
  trackId: z.string().min(1),
  file: z.instanceof(File).or(z.instanceof(Blob)),
  mediaKey: z.enum(['photoAssetId', 'audioAssetId']),
  onProgress: onProgressSchema,
  signal: z.instanceof(AbortSignal).optional(),
}).strict();
export type UpdateTuneTrackMediaVariables = z.infer<typeof UpdateTuneTrackMediaVariablesSchema>;

