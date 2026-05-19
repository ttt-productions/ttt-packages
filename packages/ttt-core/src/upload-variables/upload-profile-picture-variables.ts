import { z } from 'zod';
import type { UploadState } from '@ttt-productions/media-contracts';

const onProgressSchema = z
  .function()
  .args(z.custom<UploadState | null>())
  .returns(z.void())
  .optional();

export const UploadProfilePictureVariablesSchema = z.object({
  file: z.instanceof(File).or(z.instanceof(Blob)),
  onProgress: onProgressSchema,
}).strict();
export type UploadProfilePictureVariables = z.infer<typeof UploadProfilePictureVariablesSchema>;
