import { z } from 'zod';
import { ConversationFileRefSchema } from '../media/conversation-file-ref.js';

// ---- conversation files (guild-invite / admin-support Conversation Files) -------------

// Delete a single Conversation File. Authorization (uploader-owns-file, or admin on an
// admin-support thread) is enforced inside the callable core's transaction; the ref's
// two-kind union makes a guild-CHANNEL target unrepresentable at the wire boundary.
export const DeleteConversationFileInputSchema = z.object({
  conversation: ConversationFileRefSchema,
  conversationFileId: z.string().min(1),
}).strict();
export type DeleteConversationFileInput = z.infer<typeof DeleteConversationFileInputSchema>;
