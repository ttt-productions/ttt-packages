import { z } from 'zod';
import { workProjectIdSchema, tuneIdSchema } from '../schemas/atoms.js';
import { ClientMediaClaimSchema } from '@ttt-productions/media-schemas';
import { onProgressSchema } from './on-progress.js';

export const UpdateTuneCoverPhotoVariablesSchema = z
  .object({
    workProjectId: workProjectIdSchema,
    tuneId: tuneIdSchema,
    file: z.instanceof(File).or(z.instanceof(Blob)),

    claim: ClientMediaClaimSchema.optional(),
    coverType: z.enum(['square', 'poster', 'cinematic']),
    onProgress: onProgressSchema,
    signal: z.instanceof(AbortSignal).optional(),
  })
  .strict();
export type UpdateTuneCoverPhotoVariables = z.infer<typeof UpdateTuneCoverPhotoVariablesSchema>;
