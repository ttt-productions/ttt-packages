import { z } from 'zod';
import type { UploadState } from '@ttt-productions/media-schemas';

const onProgressSchema = z
  .function()
  .args(z.custom<UploadState | null>())
  .returns(z.void())
  .optional();

export const CreateWorkProjectAuditionVariablesSchema = z.object({
  title: z.string().min(1),
  description: z.string(),
  videoFile: z.instanceof(File).or(z.instanceof(Blob)),
  openTill: z.string().min(1),
  workProjectId: z.string().min(1),
  stakeSharesOffered: z.number().optional(),
  onProgress: onProgressSchema,
  signal: z.instanceof(AbortSignal).optional(),
}).strict();
export type CreateWorkProjectAuditionVariables = z.infer<typeof CreateWorkProjectAuditionVariablesSchema>;

