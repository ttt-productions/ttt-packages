import { z } from 'zod';
import { ClientMediaClaimSchema } from '@ttt-productions/media-schemas';
import { onProgressSchema } from './on-progress.js';

export const UploadCraftSkillVariablesSchema = z
  .object({
    file: z.instanceof(File).or(z.instanceof(Blob)),

    claim: ClientMediaClaimSchema.optional(),
    onProgress: onProgressSchema,
    signal: z.instanceof(AbortSignal).optional(),
  })
  .strict();
export type UploadCraftSkillVariables = z.infer<typeof UploadCraftSkillVariablesSchema>;
