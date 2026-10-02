import { z } from 'zod';
import { workProjectIdSchema, televisionIdSchema } from '../schemas/atoms.js';
import { ClientMediaClaimSchema } from '@ttt-productions/media-schemas';
import { onProgressSchema } from './on-progress.js';


export const UpdateTelevisionCoverPhotoVariablesSchema = z.object({
  workProjectId: workProjectIdSchema,
  televisionId: televisionIdSchema,
  file: z.instanceof(File).or(z.instanceof(Blob)),

  // Untrusted client claim of what the user's action implies (advisory; the

  // server byte inspection is the only classification authority).

  claim: ClientMediaClaimSchema.optional(),
  coverType: z.enum(['square', 'poster', 'cinematic']),
  onProgress: onProgressSchema,
  signal: z.instanceof(AbortSignal).optional(),
}).strict();
export type UpdateTelevisionCoverPhotoVariables = z.infer<typeof UpdateTelevisionCoverPhotoVariablesSchema>;

