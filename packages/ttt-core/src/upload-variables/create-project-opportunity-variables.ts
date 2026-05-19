import { z } from 'zod';
import type { UploadState } from '@ttt-productions/media-contracts';

const onProgressSchema = z
  .function()
  .args(z.custom<UploadState | null>())
  .returns(z.void())
  .optional();

export const CreateProjectOpportunityVariablesSchema = z.object({
  title: z.string().min(1),
  description: z.string(),
  videoFile: z.instanceof(File).or(z.instanceof(Blob)),
  openTill: z.string().min(1),
  projectId: z.string().min(1),
  sharesOffered: z.number().optional(),
  onProgress: onProgressSchema,
}).strict();
export type CreateProjectOpportunityVariables = z.infer<typeof CreateProjectOpportunityVariablesSchema>;
