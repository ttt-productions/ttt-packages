// Messaging parent-thread Firestore document SCHEMAS — guildChatChannels, the
// guildInviteConversations shell, and pendingAdminDispatches. Per-message body shapes
// live in @ttt-productions/chat-core (ChatMessageV1); ttt-core owns the thread docs.
// Types inferred via z.infer.

import { z } from 'zod';
import { InviteSourceSchema } from '../schemas/work-project-management.js';

const userRefSchema = z.object({ uid: z.string() });

export const GuildChatChannelSchema = z.object({
  guildChatChannelId: z.string(),
  workProjectId: z.string(),
  channelName: z.string(),
  description: z.string().optional(),
  requiredGuildStandings: z.array(z.string()),
  allowedUserIds: z.array(z.string()),
  createdAt: z.number(),
  // NOTE: createdBy here is a flat uid string (unlike the `{ uid }` object form on
  // most other docs). Preserved as-is; flagged in the schema-registry recon.
  createdBy: z.string(),
  lastMessageAt: z.string().optional(),
  lastMessage: z.string().optional(),
  messageCount: z.number(),
  isArchived: z.boolean(),
});
export type GuildChatChannel = z.infer<typeof GuildChatChannelSchema>;

export const GuildInviteConversationSchema = z.object({
  guildInviteId: z.string(),
  workProjectId: z.string(),
  relatedUserIds: z.array(z.string()),
  workProjectTitle: z.string(),
  workProject: z.object({
    workProjectId: z.string(),
    workingTitle: z.string(),
    type: z.string(),
    workingDescription: z.string(),
  }),
  workSteward: userRefSchema,
  sender: userRefSchema,
  recipient: userRefSchema,
  stakeSharesOffered: z.number(),
  source: InviteSourceSchema,
  status: z.enum(['pending', 'accepted', 'declined', 'cancelled', 'finalized', 'error']),
  createdAt: z.number(),
  updatedAt: z.number(),
  finalizedAt: z.number().optional(),
  senderConfirmed: z.boolean(),
  recipientConfirmed: z.boolean(),
  lastMessage: z.string().optional(),
  lastMessageAt: z.string().optional(),
});
export type GuildInviteConversation = z.infer<typeof GuildInviteConversationSchema>;

export const AdminDispatchSchema = z.object({
  adminDispatchId: z.string(),
  userId: z.string(),
  initiatorUserId: z.string(),
  initiatedBy: z.enum(['user', 'admin']),
  subject: z.string(),
  status: z.enum(['open', 'user_reply', 'admin_reply', 'closed_resolved', 'closed_unresolved']),
  createdAt: z.number(),
  lastUpdatedAt: z.number(),
  readByAdmin: z.boolean(),
  readByUser: z.boolean(),
  closedBy: z.string().optional(),
});
export type AdminDispatch = z.infer<typeof AdminDispatchSchema>;
