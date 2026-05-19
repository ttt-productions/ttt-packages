import { z } from 'zod';
import type { UploadState } from '@ttt-productions/media-contracts';

const onProgressSchema = z
  .function()
  .args(z.custom<UploadState | null>())
  .returns(z.void())
  .optional();

export const CreateJobVariablesSchema = z.object({
  projectId: z.string().min(1),
  jobData: z.object({
    title: z.string().min(1),
    description: z.string(),
    requiredProfessions: z.array(z.string()),
    sharesOffered: z.number(),
  }).strict(),
  file: z.instanceof(File).or(z.instanceof(Blob)),
  onProgress: onProgressSchema,
}).strict();
export type CreateJobVariables = z.infer<typeof CreateJobVariablesSchema>;
