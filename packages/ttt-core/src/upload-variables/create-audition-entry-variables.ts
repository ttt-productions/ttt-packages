import { z } from 'zod';
import { onProgressSchema } from './on-progress.js';


export const CreateAuditionEntryVariablesSchema = z.object({
  auditionId: z.string().min(1),
  videoFile: z.instanceof(File).or(z.instanceof(Blob)),
  onProgress: onProgressSchema,
  signal: z.instanceof(AbortSignal).optional(),
}).strict();
export type CreateAuditionEntryVariables = z.infer<typeof CreateAuditionEntryVariablesSchema>;

