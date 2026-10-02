import { z } from 'zod';
import { workProjectIdSchema, taleIdSchema } from '../schemas/atoms.js';
import { ClientMediaClaimSchema } from '@ttt-productions/media-schemas';
import { onProgressSchema } from './on-progress.js';


export const UpdateTaleCoverPhotoVariablesSchema = z.object({
  workProjectId: workProjectIdSchema,
  taleId: taleIdSchema,
  file: z.instanceof(File).or(z.instanceof(Blob)),

  // Untrusted client claim of what the user's action implies (advisory; the

  // server byte inspection is the only classification authority).

  claim: ClientMediaClaimSchema.optional(),
  coverType: z.enum(['square', 'poster', 'cinematic']),
  onProgress: onProgressSchema,
  signal: z.instanceof(AbortSignal).optional(),
}).strict();
export type UpdateTaleCoverPhotoVariables = z.infer<typeof UpdateTaleCoverPhotoVariablesSchema>;

