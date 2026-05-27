import { z } from 'zod';
import type { UploadState } from '@ttt-productions/media-schemas';
import { commissionListingIdSchema } from '../schemas/atoms.js';
import { MAX_JOB_DESCRIPTION_LENGTH } from '../constants/business.js';

const onProgressSchema = z
  .function()
  .args(z.custom<UploadState | null>())
  .returns(z.void())
  .optional();

export const ApplyToCommissionVariablesSchema = z.object({
  jobId: commissionListingIdSchema,
  coverLetterText: z.string().min(1).max(MAX_JOB_DESCRIPTION_LENGTH),
  file: z.instanceof(File).or(z.instanceof(Blob)).nullish(),
  onProgress: onProgressSchema,
  signal: z.instanceof(AbortSignal).optional(),
}).strict();
export type ApplyToCommissionVariables = z.infer<typeof ApplyToCommissionVariablesSchema>;
