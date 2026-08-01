import { z } from 'zod';
import { ClientMediaClaimSchema } from '@ttt-productions/media-schemas';
import { onProgressSchema } from './on-progress.js';


export const UpdateTuneCoverPhotoVariablesSchema = z.object({
  workProjectId: z.string().min(1),
  tuneId: z.string().min(1),
  file: z.instanceof(File).or(z.instanceof(Blob)),

  // Untrusted client claim of what the user's action implies (advisory; the

  // server byte inspection is the only classification authority).

  claim: ClientMediaClaimSchema.optional(),
  coverType: z.enum(['square', 'poster', 'cinematic']),
  onProgress: onProgressSchema,
  signal: z.instanceof(AbortSignal).optional(),
}).strict();
export type UpdateTuneCoverPhotoVariables = z.infer<typeof UpdateTuneCoverPhotoVariablesSchema>;

