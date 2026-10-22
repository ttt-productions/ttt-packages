import { z } from 'zod';
import { ClientMediaClaimSchema } from '@ttt-productions/media-schemas';
import { onProgressSchema } from './on-progress.js';
import { ConversationFileRefSchema } from '../media/conversation-file-ref.js';

export const UploadConversationFileVariablesSchema = z
  .object({
    conversation: ConversationFileRefSchema,
    file: z.instanceof(File),
    claim: ClientMediaClaimSchema.optional(),
    onProgress: onProgressSchema,
    signal: z.instanceof(AbortSignal).optional(),
  })
  .strict();
export type UploadConversationFileVariables = z.infer<typeof UploadConversationFileVariablesSchema>;
