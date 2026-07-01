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
  // Curated vs open (default 'open' when absent). 'curated' → the creating work posts the option
  // videos itself and users may ONLY vote. The strict schema is why this MUST live on the variables
  // (Rule 20: the hook parses variables strictly, so the mode cannot ride in targetInfo).
  mode: z.enum(['open', 'curated']).optional(),
  // Curated only: the fixed number of creator option videos (2..8) being uploaded as one batch, so
  // the server knows when the whole atomic batch has landed. Required by the callable when mode
  // === 'curated'; ignored for open auditions.
  expectedOptionCount: z.number().int().min(2).max(8).optional(),
  onProgress: onProgressSchema,
  signal: z.instanceof(AbortSignal).optional(),
}).strict();
export type CreateWorkProjectAuditionVariables = z.infer<typeof CreateWorkProjectAuditionVariablesSchema>;

