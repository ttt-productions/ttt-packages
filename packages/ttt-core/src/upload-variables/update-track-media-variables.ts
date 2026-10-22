import { z } from 'zod';
import { workProjectIdSchema, tuneIdSchema, trackIdSchema } from '../schemas/atoms.js';
import { ClientMediaClaimSchema } from '@ttt-productions/media-schemas';
import { onProgressSchema } from './on-progress.js';

export const UpdateTuneTrackMediaVariablesSchema = z
  .object({
    workProjectId: workProjectIdSchema,
    tuneId: tuneIdSchema,
    trackId: trackIdSchema,
    file: z.instanceof(File).or(z.instanceof(Blob)),

    claim: ClientMediaClaimSchema.optional(),
    mediaKey: z.enum(['photoAssetId', 'audioAssetId']),
    onProgress: onProgressSchema,
    signal: z.instanceof(AbortSignal).optional(),
  })
  .strict();
export type UpdateTuneTrackMediaVariables = z.infer<typeof UpdateTuneTrackMediaVariablesSchema>;
