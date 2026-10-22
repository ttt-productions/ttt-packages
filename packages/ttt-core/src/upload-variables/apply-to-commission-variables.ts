import { z } from 'zod';
import { ClientMediaClaimSchema } from '@ttt-productions/media-schemas';
import { onProgressSchema } from './on-progress.js';
import { commissionListingIdSchema } from '../schemas/atoms.js';
import { textFieldSchema } from '../schemas/text-field.js';
import { COMMISSION_COVER_LETTER_INPUT } from '../constants/text-fields.js';

export const ApplyToCommissionVariablesSchema = z
  .object({
    commissionListingId: commissionListingIdSchema,
    coverLetterText: textFieldSchema(COMMISSION_COVER_LETTER_INPUT),
    file: z.instanceof(File).or(z.instanceof(Blob)).nullish(),

    claim: ClientMediaClaimSchema.optional(),
    onProgress: onProgressSchema,
    signal: z.instanceof(AbortSignal).optional(),
  })
  .strict();
export type ApplyToCommissionVariables = z.infer<typeof ApplyToCommissionVariablesSchema>;
