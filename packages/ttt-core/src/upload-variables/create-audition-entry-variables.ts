import { z } from 'zod';
import type { UploadState } from '@ttt-productions/media-schemas';

const onProgressSchema = z
  .function()
  .args(z.custom<UploadState | null>())
  .returns(z.void())
  .optional();

export const CreateAuditionEntryVariablesSchema = z.object({
  opportunityId: z.string().min(1),
  videoFile: z.instanceof(File).or(z.instanceof(Blob)),
  onProgress: onProgressSchema,
  signal: z.instanceof(AbortSignal).optional(),
}).strict();
export type CreateAuditionEntryVariables = z.infer<typeof CreateAuditionEntryVariablesSchema>;
