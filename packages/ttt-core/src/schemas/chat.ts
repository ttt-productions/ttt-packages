import { z } from 'zod';
import { ChatMessageRevisionKindSchema } from '@ttt-productions/chat-schemas';
import type { GuildChatConversation } from '../ids/guild-chat-conversation.js';
import {
  workProjectIdSchema,
  userIdSchema,
  guildChatChannelIdSchema,
  guildInviteIdSchema,
  adminDispatchIdSchema,
  documentIdSegmentSchema,
  reportGroupIdSchema,
  guildChatChannelRequirementSchema,
} from './atoms.js';
import { MAX_GUILD_CHAT_CHANNEL_REQUIRED_STANDINGS } from '../constants/chat.js';
import { MAX_CHAT_MODERATION_REASON_LENGTH } from '../constants/business-admin.js';
import {
  ADMIN_DISPATCH_MESSAGE_INPUT,
  ADMIN_DISPATCH_SUBJECT_INPUT,
  GUILD_CHAT_CHANNEL_DESCRIPTION_INPUT,
  GUILD_CHAT_CHANNEL_NAME_INPUT,
  SUPPORT_THREAD_MESSAGE_INPUT,
} from '../constants/text-fields.js';
import { textFieldSchema } from './text-field.js';
import { AdminDispatchContextRefSchema } from '../doc-schemas/messaging.js';

const GuildChatChannelConversationSchema = z
  .object({
    kind: z.literal('channel'),
    workProjectId: workProjectIdSchema,
    guildChatChannelId: guildChatChannelIdSchema,
  })
  .strict();
const GuildInviteConversationRefSchema = z
  .object({
    kind: z.literal('invite'),
    guildInviteId: guildInviteIdSchema,
  })
  .strict();
export const GuildChatConversationSchema = z.discriminatedUnion('kind', [
  GuildChatChannelConversationSchema,
  GuildInviteConversationRefSchema,
]) satisfies z.ZodType<GuildChatConversation>;

export const ArchiveGuildChatChannelInputSchema = z
  .object({
    workProjectId: workProjectIdSchema,
    guildChatChannelId: guildChatChannelIdSchema,
  })
  .strict();
export type ArchiveGuildChatChannelInput = z.infer<typeof ArchiveGuildChatChannelInputSchema>;

export const UnarchiveGuildChatChannelInputSchema = z
  .object({
    workProjectId: workProjectIdSchema,
    guildChatChannelId: guildChatChannelIdSchema,
  })
  .strict();
export type UnarchiveGuildChatChannelInput = z.infer<typeof UnarchiveGuildChatChannelInputSchema>;

export const DeleteGuildChatChannelInputSchema = z
  .object({
    workProjectId: workProjectIdSchema,
    guildChatChannelId: guildChatChannelIdSchema,
  })
  .strict();
export type DeleteGuildChatChannelInput = z.infer<typeof DeleteGuildChatChannelInputSchema>;

export const CreateGuildChatChannelInputSchema = z
  .object({
    workProjectId: workProjectIdSchema,
    channelName: textFieldSchema(GUILD_CHAT_CHANNEL_NAME_INPUT),
    description: textFieldSchema(GUILD_CHAT_CHANNEL_DESCRIPTION_INPUT).optional(),
    requiredGuildStandings: z
      .array(guildChatChannelRequirementSchema)
      .max(MAX_GUILD_CHAT_CHANNEL_REQUIRED_STANDINGS),
  })
  .strict();
export type CreateGuildChatChannelInput = z.infer<typeof CreateGuildChatChannelInputSchema>;

export const GUILD_CHAT_CHANNEL_ENFORCEMENT_STATES = ['applied', 'pending'] as const;
export const GuildChatChannelEnforcementSchema = z.enum(GUILD_CHAT_CHANNEL_ENFORCEMENT_STATES);
export type GuildChatChannelEnforcement = z.infer<typeof GuildChatChannelEnforcementSchema>;

export const GuildChatChannelLifecycleResultSchema = z.object({
  success: z.literal(true),
  guildChatChannelId: guildChatChannelIdSchema,
  enforcement: GuildChatChannelEnforcementSchema,
});
export type GuildChatChannelLifecycleResult = z.infer<typeof GuildChatChannelLifecycleResultSchema>;

export const SendGuildChatMessageInputSchema = z
  .object({
    threadKind: z.literal('adminSupport'),
    adminDispatchId: adminDispatchIdSchema,
    text: textFieldSchema(SUPPORT_THREAD_MESSAGE_INPUT),
  })
  .strict();
export type SendGuildChatMessageInput = z.infer<typeof SendGuildChatMessageInputSchema>;

// Non-strict: the backend core's result extends this, and its extra fields may appear on the wire.
export const SendGuildChatMessageResultSchema = z.object({
  success: z.literal(true),
  messageId: z.string().min(1),
  messageDocPath: z.string().min(1),
});
export type SendGuildChatMessageResult = z.infer<typeof SendGuildChatMessageResultSchema>;

export const StartAdminSupportThreadInputSchema = z
  .object({
    subject: textFieldSchema(ADMIN_DISPATCH_SUBJECT_INPUT),
    initialMessage: textFieldSchema(ADMIN_DISPATCH_MESSAGE_INPUT),
  })
  .strict();
export type StartAdminSupportThreadInput = z.infer<typeof StartAdminSupportThreadInputSchema>;

export const StartAdminSupportThreadResultSchema = z.object({
  success: z.literal(true),
  adminDispatchId: z.string().min(1),
  messageId: z.string().min(1),
});
export type StartAdminSupportThreadResult = z.infer<typeof StartAdminSupportThreadResultSchema>;

export const StartWorkProjectAdminSupportThreadInputSchema = z
  .object({
    workProjectId: workProjectIdSchema,
    subject: textFieldSchema(ADMIN_DISPATCH_SUBJECT_INPUT),
    initialMessage: textFieldSchema(ADMIN_DISPATCH_MESSAGE_INPUT),
    contextRef: AdminDispatchContextRefSchema.optional(),
  })
  .strict();
export type StartWorkProjectAdminSupportThreadInput = z.infer<
  typeof StartWorkProjectAdminSupportThreadInputSchema
>;

export const CreateAdminDispatchToWorkProjectInputSchema = z
  .object({
    workProjectId: workProjectIdSchema,
    subject: textFieldSchema(ADMIN_DISPATCH_SUBJECT_INPUT),
    message: textFieldSchema(ADMIN_DISPATCH_MESSAGE_INPUT),
    contextRef: AdminDispatchContextRefSchema.optional(),
  })
  .strict();
export type CreateAdminDispatchToWorkProjectInput = z.infer<
  typeof CreateAdminDispatchToWorkProjectInputSchema
>;

export const CreateAdminDispatchResultSchema = z.object({
  success: z.literal(true),
  adminDispatchId: adminDispatchIdSchema,
});
export type CreateAdminDispatchResult = z.infer<typeof CreateAdminDispatchResultSchema>;

export const CreateAdminDispatchToUserInputSchema = z
  .object({
    userId: userIdSchema,
    subject: textFieldSchema(ADMIN_DISPATCH_SUBJECT_INPUT),
    message: textFieldSchema(ADMIN_DISPATCH_MESSAGE_INPUT),
  })
  .strict();
export type CreateAdminDispatchToUserInput = z.infer<typeof CreateAdminDispatchToUserInputSchema>;

export const ChatGrantInputSchema = z.discriminatedUnion('kind', [
  GuildChatChannelConversationSchema,
  GuildInviteConversationRefSchema,
  z.object({ kind: z.literal('inbox') }).strict(),
]);
export type ChatGrantInput = z.infer<typeof ChatGrantInputSchema>;

export const UpdateGuildChatChannelInputSchema = z
  .object({
    workProjectId: workProjectIdSchema,
    guildChatChannelId: guildChatChannelIdSchema,
    channelName: textFieldSchema(GUILD_CHAT_CHANNEL_NAME_INPUT).optional(),
    description: textFieldSchema(GUILD_CHAT_CHANNEL_DESCRIPTION_INPUT).optional(),
    requiredGuildStandings: z
      .array(guildChatChannelRequirementSchema)
      .max(MAX_GUILD_CHAT_CHANNEL_REQUIRED_STANDINGS)
      .optional(),
  })
  .strict();
export type UpdateGuildChatChannelInput = z.infer<typeof UpdateGuildChatChannelInputSchema>;

export const AdminModerateChatMessageInputSchema = z
  .object({
    requestId: documentIdSegmentSchema.max(200),
    action: z.enum(['hide', 'delete']),
    messageSeq: z.number().int().nonnegative(),
    expectedMessageRevision: z.number().int().nonnegative(),
    caseId: reportGroupIdSchema.max(200),
    reason: z.string().min(1).max(MAX_CHAT_MODERATION_REASON_LENGTH),
    channel: GuildChatConversationSchema,
  })
  .strict();
export type AdminModerateChatMessageInput = z.infer<typeof AdminModerateChatMessageInputSchema>;

export const AdminReadChannelContextInputSchema = z
  .object({
    reportedSeq: z.number().int().nonnegative(),
    caseId: reportGroupIdSchema.max(200),
    reason: z.string().min(1).max(MAX_CHAT_MODERATION_REASON_LENGTH),
    before: z.number().int().min(0).max(50).optional(),
    after: z.number().int().min(0).max(50).optional(),
    channel: GuildChatConversationSchema,
  })
  .strict();
export type AdminReadChannelContextInput = z.infer<typeof AdminReadChannelContextInputSchema>;

export const ChatContextMessageSchema = z.object({
  seq: z.number().int().nonnegative(),
  senderUid: z.string(),
  text: z.string(),
  createdAt: z.number(),
  moderationKind: ChatMessageRevisionKindSchema.nullable(),
  moderationRevision: z.number().int().nonnegative(),
  referencedUids: z.array(z.string().min(1)).optional(),
});
export type ChatContextMessage = z.infer<typeof ChatContextMessageSchema>;

export const AdminReadChannelContextResultSchema = z.object({
  messages: z.array(ChatContextMessageSchema),
});
export type AdminReadChannelContextResult = z.infer<typeof AdminReadChannelContextResultSchema>;

export const MintChatGrantResultSchema = z.object({
  grant: z.string().min(1),
  expiresAt: z.number(),
});
export type MintChatGrantResult = z.infer<typeof MintChatGrantResultSchema>;
