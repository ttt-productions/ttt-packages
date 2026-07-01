import { z } from 'zod';
import { onProgressSchema } from './on-progress.js';
import {
  MAX_AUDITION_TITLE_LENGTH,
  MAX_AUDITION_DESCRIPTION_LENGTH,
  MAX_SPONSORED_AUDITION_AMOUNT_USD,
} from '../constants/business.js';


export const CreateAdminAuditionVariablesSchema = z.object({
  type: z.enum(['platformAudition', 'sponsoredAudition']),
  title: z.string().min(1).max(MAX_AUDITION_TITLE_LENGTH),
  description: z.string().max(MAX_AUDITION_DESCRIPTION_LENGTH),
  videoFile: z.instanceof(File).or(z.instanceof(Blob)),
  openTill: z.string().min(1),
  sponsoredAuditionAmountUSD: z.number().nonnegative().finite().max(MAX_SPONSORED_AUDITION_AMOUNT_USD).optional(),
  // Curated vs open (default 'open' when absent). 'curated' → the admin posts the option videos and
  // users may ONLY vote. Must live on the variables (Rule 20 strict-parse), not targetInfo.
  mode: z.enum(['open', 'curated']).optional(),
  // Curated only: the fixed number of option videos (2..8) uploaded as one atomic batch. Required by
  // the callable when mode === 'curated'; ignored for open auditions.
  expectedOptionCount: z.number().int().min(2).max(8).optional(),
  onProgress: onProgressSchema,
  signal: z.instanceof(AbortSignal).optional(),
}).strict();
export type CreateAdminAuditionVariables = z.infer<typeof CreateAdminAuditionVariablesSchema>;

