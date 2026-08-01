import { z } from 'zod';
import { ClientMediaClaimSchema } from '@ttt-productions/media-schemas';
import { onProgressSchema } from './on-progress.js';


export const UpdateWorkRealmCoverVariablesSchema = z.object({
  file: z.instanceof(File).or(z.instanceof(Blob)),
  // Untrusted client claim of what the user's action implies (advisory; the
  // server byte inspection is the only classification authority).
  claim: ClientMediaClaimSchema.optional(),
  onProgress: onProgressSchema,
  signal: z.instanceof(AbortSignal).optional(),
}).strict();
export type UpdateWorkRealmCoverVariables = z.infer<typeof UpdateWorkRealmCoverVariablesSchema>;
