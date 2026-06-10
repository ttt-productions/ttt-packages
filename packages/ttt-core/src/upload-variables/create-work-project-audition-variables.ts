import { z } from 'zod';
import { onProgressSchema } from './on-progress.js';
import {
  MAX_AUDITION_TITLE_LENGTH,
  MAX_AUDITION_DESCRIPTION_LENGTH,
  MAX_WORK_PROJECT_STAKE_SHARES,
} from '../constants/business.js';


export const CreateWorkProjectAuditionVariablesSchema = z.object({
  title: z.string().min(1).max(MAX_AUDITION_TITLE_LENGTH),
  description: z.string().max(MAX_AUDITION_DESCRIPTION_LENGTH),
  videoFile: z.instanceof(File).or(z.instanceof(Blob)),
  openTill: z.string().min(1),
  workProjectId: z.string().min(1),
  stakeSharesOffered: z.number().int().min(0).max(MAX_WORK_PROJECT_STAKE_SHARES).optional(),
  onProgress: onProgressSchema,
  signal: z.instanceof(AbortSignal).optional(),
}).strict();
export type CreateWorkProjectAuditionVariables = z.infer<typeof CreateWorkProjectAuditionVariablesSchema>;

