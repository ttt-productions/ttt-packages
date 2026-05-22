import { z } from 'zod';
import type { UploadState } from '@ttt-productions/media-schemas';
import type { ProjectFile } from '../types/project.js';

const onProgressSchema = z
  .function()
  .args(z.custom<UploadState | null>())
  .returns(z.void())
  .optional();

export const UploadProjectFileVariablesSchema = z.object({
  projectId: z.string().min(1),
  file: z.instanceof(File),
  projectFiles: z.array(z.custom<ProjectFile>()),
  onProgress: onProgressSchema,
  signal: z.instanceof(AbortSignal).optional(),
}).strict();
export type UploadProjectFileVariables = z.infer<typeof UploadProjectFileVariablesSchema>;
