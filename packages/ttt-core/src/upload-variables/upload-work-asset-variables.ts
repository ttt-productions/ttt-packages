import { z } from 'zod';
import type { UploadState } from '@ttt-productions/media-schemas';
import type { ProjectFile } from '../types/work-project.js';

const onProgressSchema = z
  .function()
  .args(z.custom<UploadState | null>())
  .returns(z.void())
  .optional();

export const UploadWorkAssetVariablesSchema = z.object({
  projectId: z.string().min(1),
  file: z.instanceof(File),
  workAssets: z.array(z.custom<ProjectFile>()),
  onProgress: onProgressSchema,
  signal: z.instanceof(AbortSignal).optional(),
}).strict();
export type UploadWorkAssetVariables = z.infer<typeof UploadWorkAssetVariablesSchema>;
