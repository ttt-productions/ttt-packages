import { z } from 'zod';
import { InviteSourceSchema } from '../schemas/work-project-management.js';
import {
  guildInviteConversationStatusSchema,
  thresholdItemIdSchema,
  hallItemIdSchema,
  hallSubItemIdSchema,
  changeRequestIdSchema,
  userIdSchema,
  guildChatChannelRequirementSchema,
} from '../schemas/atoms.js';
import { ContentMediaKindSchema } from './media-assets.js';

const userRefSchema = z.object({ uid: z.string() });

const conversationFileCounterFields = {
  conversationFileCount: z.number().optional(),
  conversationFileBytesUsed: z.number().optional(),
  conversationFileUploadCount: z.number().optional(),
  conversationFileBytesReserved: z.number().optional(),
} as const;

export const ConversationFileSchema = z.object({
  conversationFileId: z.string(),
  mediaAssetId: z.string(),
  name: z.string(),
  mediaKind: ContentMediaKindSchema,
  contentType: z.string(),
  sizeBytes: z.number(),
  uploadedByUid: z.string(),
  createdAt: z.number(),
});
export type ConversationFile = z.infer<typeof ConversationFileSchema>;

export const GuildChatChannelSchema = z.object({
  guildChatChannelId: z.string(),
  workProjectId: z.string(),
  channelName: z.string(),
  description: z.string().optional(),
  requiredGuildStandings: z.array(guildChatChannelRequirementSchema),
  createdAt: z.number(),
  createdBy: z.string(),
  lastMessageAt: z.string().optional(),
  lastMessage: z.string().optional(),
  messageCount: z.number(),
  isArchived: z.boolean(),
  isDeleted: z.boolean().optional(),
  configVersion: z.number().optional(),
});
export type GuildChatChannel = z.infer<typeof GuildChatChannelSchema>;

export const GuildInviteConversationSchema = z.object({
  guildInviteId: z.string(),
  workProjectId: z.string(),
  relatedUserIds: z.array(z.string()),
  workProject: z.object({
    workProjectId: z.string(),
    type: z.string(),
  }),
  createdBy: userRefSchema,
  sender: userRefSchema,
  recipient: userRefSchema,
  stakeSharesOffered: z.number().int().min(1),
  source: InviteSourceSchema,
  status: guildInviteConversationStatusSchema,
  createdAt: z.number(),
  updatedAt: z.number(),
  lastUpdatedAt: z.number(),
  finalizedAt: z.number().optional(),
  senderConfirmed: z.boolean(),
  senderConfirmedBy: userIdSchema.optional(),
  recipientConfirmed: z.boolean(),
  ...conversationFileCounterFields,
});
export type GuildInviteConversation = z.infer<typeof GuildInviteConversationSchema>;

// Homed here, not in ./schemas: the reverse import would be a module cycle.
export const ListGuildInvitesResultSchema = z
  .object({
    invites: z.array(GuildInviteConversationSchema),
    nextCursor: z.string().min(1).nullable(),
  })
  .strict();
export type ListGuildInvitesResult = z.infer<typeof ListGuildInvitesResultSchema>;

export const AdminDispatchContextRefSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('thresholdItem'), thresholdItemId: thresholdItemIdSchema }),
  z.object({
    kind: z.literal('hallContent'),
    hallItemId: hallItemIdSchema,
    subItemId: hallSubItemIdSchema.nullable(),
  }),
  z.object({ kind: z.literal('hallContentChangeRequest'), changeRequestId: changeRequestIdSchema }),
]);
export type AdminDispatchContextRef = z.infer<typeof AdminDispatchContextRefSchema>;

export const AdminDispatchPartyKindSchema = z.enum(['user', 'workProject']);
export type AdminDispatchPartyKind = z.infer<typeof AdminDispatchPartyKindSchema>;

export const ChatMessageSentAsSchema = z.enum(['admin']);
export type ChatMessageSentAs = z.infer<typeof ChatMessageSentAsSchema>;

export function isChatMessageSentAsAdmin(sentAs: unknown): boolean {
  return ChatMessageSentAsSchema.safeParse(sentAs).success;
}

export const AdminDispatchSchema = z.object({
  adminDispatchId: z.string(),
  partyKind: AdminDispatchPartyKindSchema,
  workProjectId: z.string().optional(),
  contextRef: AdminDispatchContextRefSchema.optional(),
  userId: z.string(),
  initiatorUserId: z.string(),
  initiatedBy: z.enum(['user', 'admin']),
  subject: z.string(),
  status: z.enum(['open', 'user_reply', 'admin_reply', 'closed_resolved', 'closed_unresolved']),
  createdAt: z.number(),
  lastUpdatedAt: z.number(),
  lastMessageAt: z.number(),
  awaitingAdminReply: z.boolean(),
  closedBy: z.string().optional(),
  ...conversationFileCounterFields,
});
export type AdminDispatch = z.infer<typeof AdminDispatchSchema>;

export const ChatMessageV1Schema = z.object({
  senderId: z.string(),
  text: z.string(),
  createdAt: z.number(),
  messageId: z.string().optional(),
  threadId: z.string().optional(),
  type: z.string().optional(),
  guildInviteId: z.string().optional(),
  isSystemMessage: z.boolean().optional(),
  sentAs: ChatMessageSentAsSchema.optional(),
  meta: z.record(z.string(), z.unknown()).optional(),
  // Not `.strict()`: a stored doc carrying `replyTo` still parses, and the key is stripped.
});
export type ChatMessageV1Doc = z.infer<typeof ChatMessageV1Schema>;
