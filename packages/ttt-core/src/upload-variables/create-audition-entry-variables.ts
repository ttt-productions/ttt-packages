import { z } from 'zod';
import { ClientMediaClaimSchema } from '@ttt-productions/media-schemas';
import { onProgressSchema } from './on-progress.js';


export const CreateAuditionEntryVariablesSchema = z.object({
  auditionId: z.string().min(1),
  videoFile: z.instanceof(File).or(z.instanceof(Blob)),

  // Untrusted client claim of what the user's action implies (advisory; the

  // server byte inspection is the only classification authority).

  claim: ClientMediaClaimSchema.optional(),
  onProgress: onProgressSchema,
  signal: z.instanceof(AbortSignal).optional(),
}).strict();
export type CreateAuditionEntryVariables = z.infer<typeof CreateAuditionEntryVariablesSchema>;

