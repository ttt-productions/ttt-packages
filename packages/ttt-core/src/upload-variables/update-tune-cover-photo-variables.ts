import { z } from 'zod';
import type { UploadState } from '@ttt-productions/media-contracts';

const onProgressSchema = z
  .function()
  .args(z.custom<UploadState | null>())
  .returns(z.void())
  .optional();

export const UpdateTuneCoverPhotoVariablesSchema = z.object({
  projectId: z.string().min(1),
  tuneId: z.string().min(1),
  file: z.instanceof(File).or(z.instanceof(Blob)),
  coverType: z.enum(['square', 'poster', 'cinematic']),
  onProgress: onProgressSchema,
}).strict();
export type UpdateTuneCoverPhotoVariables = z.infer<typeof UpdateTuneCoverPhotoVariablesSchema>;
