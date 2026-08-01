import { z } from 'zod';
import { ClientMediaClaimSchema } from '@ttt-productions/media-schemas';
import { onProgressSchema } from './on-progress.js';


export const UpdateTuneTrackMediaVariablesSchema = z.object({
  workProjectId: z.string().min(1),
  tuneId: z.string().min(1),
  trackId: z.string().min(1),
  file: z.instanceof(File).or(z.instanceof(Blob)),

  // Untrusted client claim of what the user's action implies (advisory; the

  // server byte inspection is the only classification authority).

  claim: ClientMediaClaimSchema.optional(),
  mediaKey: z.enum(['photoAssetId', 'audioAssetId']),
  onProgress: onProgressSchema,
  signal: z.instanceof(AbortSignal).optional(),
}).strict();
export type UpdateTuneTrackMediaVariables = z.infer<typeof UpdateTuneTrackMediaVariablesSchema>;

