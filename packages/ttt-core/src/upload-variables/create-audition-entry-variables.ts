import { z } from 'zod';
import { auditionIdSchema } from '../schemas/atoms.js';
import { ClientMediaClaimSchema } from '@ttt-productions/media-schemas';
import { onProgressSchema } from './on-progress.js';
import { AUDITION_ENTRY_AGREEMENT_VERSION } from '../constants/member-agreements.js';

export const CreateAuditionEntryVariablesSchema = z
  .object({
    auditionId: auditionIdSchema,
    videoFile: z.instanceof(File).or(z.instanceof(Blob)),
    agreementVersion: z.literal(AUDITION_ENTRY_AGREEMENT_VERSION),

    claim: ClientMediaClaimSchema.optional(),
    onProgress: onProgressSchema,
    signal: z.instanceof(AbortSignal).optional(),
  })
  .strict();
export type CreateAuditionEntryVariables = z.infer<typeof CreateAuditionEntryVariablesSchema>;
