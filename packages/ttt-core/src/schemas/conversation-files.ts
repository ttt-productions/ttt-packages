import { z } from 'zod';
import { conversationFileIdSchema } from './atoms.js';
import { ConversationFileRefSchema } from '../media/conversation-file-ref.js';

// Delete a single Conversation File. Authorization (uploader-owns-file, or admin on an
// admin-support thread) is enforced inside the callable core's transaction; the ref's
// two-kind union makes a guild-CHANNEL target unrepresentable at the wire boundary.
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
