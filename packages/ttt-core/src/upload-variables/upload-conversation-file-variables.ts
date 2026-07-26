import { z } from 'zod';
import { onProgressSchema } from './on-progress.js';
import { ConversationFileRefSchema } from '../media/conversation-file-ref.js';

// Variables for the conversation-file upload mutation hook (MEDIA-005). The
// conversation ref is the strict two-kind ConversationFileRef — a guild-CHANNEL
// target is unrepresentable.
export const UploadConversationFileVariablesSchema = z.object({
  conversation: ConversationFileRefSchema,
  file: z.instanceof(File),
  onProgress: onProgressSchema,
  signal: z.instanceof(AbortSignal).optional(),
}).strict();
export type UploadConversationFileVariables = z.infer<typeof UploadConversationFileVariablesSchema>;
