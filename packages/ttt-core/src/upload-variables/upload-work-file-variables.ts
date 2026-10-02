import { z } from 'zod';
import { workProjectIdSchema, workFileFolderIdSchema } from '../schemas/atoms.js';
import { ClientMediaClaimSchema } from '@ttt-productions/media-schemas';
import { onProgressSchema } from './on-progress.js';


export const UploadWorkFileVariablesSchema = z.object({
  workProjectId: workProjectIdSchema,
  folderId: workFileFolderIdSchema,
  file: z.instanceof(File),
  // Untrusted client claim of what the user's action implies (advisory; the
  // server byte inspection is the only classification authority).
  claim: ClientMediaClaimSchema.optional(),
  onProgress: onProgressSchema,
  signal: z.instanceof(AbortSignal).optional(),
}).strict();
export type UploadWorkFileVariables = z.infer<typeof UploadWorkFileVariablesSchema>;
