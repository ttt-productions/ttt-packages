import { z } from 'zod';
import { onProgressSchema } from './on-progress.js';
import { commissionListingIdSchema } from '../schemas/atoms.js';
import { MAX_COMMISSION_DESCRIPTION_LENGTH } from '../constants/business.js';


export const ApplyToCommissionVariablesSchema = z.object({
  commissionListingId: commissionListingIdSchema,
  coverLetterText: z.string().min(1).max(MAX_COMMISSION_DESCRIPTION_LENGTH),
  file: z.instanceof(File).or(z.instanceof(Blob)).nullish(),
  onProgress: onProgressSchema,
  signal: z.instanceof(AbortSignal).optional(),
}).strict();
export type ApplyToCommissionVariables = z.infer<typeof ApplyToCommissionVariablesSchema>;

