import { z } from 'zod';
import {
  workProjectIdSchema,
  guildChatChannelIdSchema,
  inviteIdSchema,
  adminDispatchIdSchema,
} from './atoms.js';
import { MAX_CHAT_MESSAGE_LENGTH } from '../constants/chat.js';
import {
  ReplyToSchema,
  ChatAttachmentSchema,
} from '@ttt-productions/chat-schemas';

export const ArchiveGuildChatChannelInputSchema = z.object({
  workProjectId: workProjectIdSchema,
  guildChatChannelId: guildChatChannelIdSchema,
}).strict();
export type ArchiveGuildChatChannelInput = z.infer<typeof ArchiveGuildChatChannelInputSchema>;

export const CreateGuildChatChannelInputSchema = z.object({
  workProjectId: workProjectIdSchema,
  channelName: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
  requiredGuildStandings: z.array(z.string()),
  allowedUserIds: z.array(z.string()),
}).strict();
export type CreateGuildChatChannelInput = z.infer<typeof CreateGuildChatChannelInputSchema>;

export const SendGuildChatMessageInputSchema = z.discriminatedUnion('threadKind', [
  z.object({
    threadKind: z.literal('guildChatChannel'),
    workProjectId: workProjectIdSchema,
    guildChatChannelId: guildChatChannelIdSchema,
    text: z.string().max(MAX_CHAT_MESSAGE_LENGTH),
    replyTo: ReplyToSchema.optional(),
    attachment: ChatAttachmentSchema.optional(),
  }).strict(),
  z.object({
    threadKind: z.literal('guildInvite'),
    inviteId: inviteIdSchema,
    text: z.string().max(MAX_CHAT_MESSAGE_LENGTH),
    replyTo: ReplyToSchema.optional(),
    attachment: ChatAttachmentSchema.optional(),
  }).strict(),
  z.object({
    threadKind: z.literal('adminSupport'),
    adminDispatchId: adminDispatchIdSchema,
    isUserReply: z.boolean(),
    text: z.string().max(MAX_CHAT_MESSAGE_LENGTH),
    replyTo: ReplyToSchema.optional(),
    attachment: ChatAttachmentSchema.optional(),
  }).strict(),
]);
export type SendGuildChatMessageInput = z.infer<typeof SendGuildChatMessageInputSchema>;

export const StartAdminSupportThreadInputSchema = z.object({
  subject: z.string().min(1).max(MAX_CHAT_MESSAGE_LENGTH),
  initialMessage: z.string().min(1).max(MAX_CHAT_MESSAGE_LENGTH),
}).strict();
export type StartAdminSupportThreadInput = z.infer<typeof StartAdminSupportThreadInputSchema>;

export const UpdateGuildChatChannelInputSchema = z.object({
  workProjectId: workProjectIdSchema,
  guildChatChannelId: guildChatChannelIdSchema,
  channelName: z.string().min(1).max(100).optional(),
  description: z.string().max(500).optional(),
  requiredGuildStandings: z.array(z.string()).optional(),
  allowedUserIds: z.array(z.string()).optional(),
}).strict();
export type UpdateGuildChatChannelInput = z.infer<typeof UpdateGuildChatChannelInputSchema>;



