import { z } from 'zod';
import { workProjectIdSchema, televisionIdSchema, episodeIdSchema } from '../schemas/atoms.js';
import { ClientMediaClaimSchema } from '@ttt-productions/media-schemas';
import { onProgressSchema } from './on-progress.js';

export const UpdateTelevisionEpisodeMediaVariablesSchema = z
  .object({
    workProjectId: workProjectIdSchema,
    televisionId: televisionIdSchema,
    episodeId: episodeIdSchema,
    file: z.instanceof(File).or(z.instanceof(Blob)),

    claim: ClientMediaClaimSchema.optional(),
    mediaKey: z.enum(['photoAssetId', 'videoAssetId']),
    onProgress: onProgressSchema,
    signal: z.instanceof(AbortSignal).optional(),
  })
  .strict();
export type UpdateTelevisionEpisodeMediaVariables = z.infer<
  typeof UpdateTelevisionEpisodeMediaVariablesSchema
>;
