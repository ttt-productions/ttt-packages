import { z } from 'zod';
import { onProgressSchema } from './on-progress.js';


export const UploadProfilePictureVariablesSchema = z.object({
  file: z.instanceof(File).or(z.instanceof(Blob)),
  onProgress: onProgressSchema,
  signal: z.instanceof(AbortSignal).optional(),
}).strict();
export type UploadProfilePictureVariables = z.infer<typeof UploadProfilePictureVariablesSchema>;
