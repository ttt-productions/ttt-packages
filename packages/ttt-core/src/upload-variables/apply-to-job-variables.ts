import { z } from 'zod';
import type { UploadState } from '@ttt-productions/media-contracts';
import { jobIdSchema } from '../schemas/atoms.js';
import { MAX_JOB_DESCRIPTION_LENGTH } from '../constants/business.js';

const onProgressSchema = z
  .function()
  .args(z.custom<UploadState | null>())
  .returns(z.void())
  .optional();

export const ApplyToJobVariablesSchema = z.object({
  jobId: jobIdSchema,
  coverLetterText: z.string().min(1).max(MAX_JOB_DESCRIPTION_LENGTH),
  file: z.instanceof(File).or(z.instanceof(Blob)).nullish(),
  onProgress: onProgressSchema,
}).strict();
export type ApplyToJobVariables = z.infer<typeof ApplyToJobVariablesSchema>;
