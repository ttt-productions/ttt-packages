import { z } from 'zod';
import { conversationFileIdSchema } from './atoms.js';
import { ConversationFileRefSchema } from '../media/conversation-file-ref.js';

export const DeleteConversationFileInputSchema = z
  .object({
    conversation: ConversationFileRefSchema,
    conversationFileId: conversationFileIdSchema,
  })
  .strict();
export type DeleteConversationFileInput = z.infer<typeof DeleteConversationFileInputSchema>;

export const DeleteConversationFileResultSchema = z.object({
  success: z.literal(true),
  conversationFileId: conversationFileIdSchema,
});
export type DeleteConversationFileResult = z.infer<typeof DeleteConversationFileResultSchema>;
