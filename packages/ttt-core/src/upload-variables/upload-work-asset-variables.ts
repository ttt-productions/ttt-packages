import { z } from 'zod';
import { onProgressSchema } from './on-progress.js';
import type { WorkAsset } from '../types/work-project.js';


export const UploadWorkAssetVariablesSchema = z.object({
  workProjectId: z.string().min(1),
  file: z.instanceof(File),
  workAssets: z.array(z.custom<WorkAsset>()),
  onProgress: onProgressSchema,
  signal: z.instanceof(AbortSignal).optional(),
}).strict();
export type UploadWorkAssetVariables = z.infer<typeof UploadWorkAssetVariablesSchema>;

