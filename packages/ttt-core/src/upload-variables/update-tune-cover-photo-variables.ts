import { z } from 'zod';
import type { UploadState } from '@ttt-productions/media-schemas';

const onProgressSchema = z
  .function()
  .args(z.custom<UploadState | null>())
  .returns(z.void())
  .optional();

export const UpdateTuneCoverPhotoVariablesSchema = z.object({
  workProjectId: z.string().min(1),
  tuneId: z.string().min(1),
  file: z.instanceof(File).or(z.instanceof(Blob)),
  coverType: z.enum(['square', 'poster', 'cinematic']),
  onProgress: onProgressSchema,
  signal: z.instanceof(AbortSignal).optional(),
}).strict();
export type UpdateTuneCoverPhotoVariables = z.infer<typeof UpdateTuneCoverPhotoVariablesSchema>;

