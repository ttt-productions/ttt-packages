import { z } from 'zod';
import type { UploadState } from '@ttt-productions/media-schemas';

const onProgressSchema = z
  .function()
  .args(z.custom<UploadState | null>())
  .returns(z.void())
  .optional();

export const UploadSkillVariablesSchema = z.object({
  file: z.instanceof(File).or(z.instanceof(Blob)),
  onProgress: onProgressSchema,
  signal: z.instanceof(AbortSignal).optional(),
}).strict();
export type UploadSkillVariables = z.infer<typeof UploadSkillVariablesSchema>;
