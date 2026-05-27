import { z } from 'zod';
import type { UploadState } from '@ttt-productions/media-schemas';

const onProgressSchema = z
  .function()
  .args(z.custom<UploadState | null>())
  .returns(z.void())
  .optional();

export const UpdateTuneTrackMediaVariablesSchema = z.object({
  projectId: z.string().min(1),
  tuneId: z.string().min(1),
  trackId: z.string().min(1),
  file: z.instanceof(File).or(z.instanceof(Blob)),
  mediaKey: z.enum(['photoUrl', 'fileUrl']),
  onProgress: onProgressSchema,
  signal: z.instanceof(AbortSignal).optional(),
}).strict();
export type UpdateTuneTrackMediaVariables = z.infer<typeof UpdateTuneTrackMediaVariablesSchema>;
