import { z } from 'zod';
import {
  projectIdSchema,
  channelIdSchema,
  inviteIdSchema,
  messageIdSchema,
} from './atoms.js';
import { MAX_CHAT_MESSAGE_LENGTH } from '../constants/chat.js';
import {
  ReplyToSchema,
  ChatAttachmentSchema,
} from '@ttt-productions/chat-schemas';

export const ArchiveChatChannelInputSchema = z.object({
  projectId: projectIdSchema,
  channelId: channelIdSchema,
}).strict();
export type ArchiveChatChannelInput = z.infer<typeof ArchiveChatChannelInputSchema>;

export const CreateChatChannelInputSchema = z.object({
  projectId: projectIdSchema,
  channelName: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
  requiredRoles: z.array(z.string()),
  allowedUserIds: z.array(z.string()),
}).strict();
export type CreateChatChannelInput = z.infer<typeof CreateChatChannelInputSchema>;

export const SendChatMessageInputSchema = z.discriminatedUnion('threadKind', [
  z.object({
    threadKind: z.literal('projectChannel'),
    projectId: projectIdSchema,
    channelId: channelIdSchema,
    text: z.string().max(MAX_CHAT_MESSAGE_LENGTH),
    replyTo: ReplyToSchema.optional(),
    attachment: ChatAttachmentSchema.optional(),
  }).strict(),
  z.object({
    threadKind: z.literal('projectInvite'),
    inviteId: inviteIdSchema,
    text: z.string().max(MAX_CHAT_MESSAGE_LENGTH),
    replyTo: ReplyToSchema.optional(),
    attachment: ChatAttachmentSchema.optional(),
  }).strict(),
  z.object({
    threadKind: z.literal('adminSupport'),
    adminMessageId: messageIdSchema,
    isUserReply: z.boolean(),
    text: z.string().max(MAX_CHAT_MESSAGE_LENGTH),
    replyTo: ReplyToSchema.optional(),
    attachment: ChatAttachmentSchema.optional(),
  }).strict(),
]);
export type SendChatMessageInput = z.infer<typeof SendChatMessageInputSchema>;

export const StartAdminSupportThreadInputSchema = z.object({
  subject: z.string().min(1).max(MAX_CHAT_MESSAGE_LENGTH),
  initialMessage: z.string().min(1).max(MAX_CHAT_MESSAGE_LENGTH),
}).strict();
export type StartAdminSupportThreadInput = z.infer<typeof StartAdminSupportThreadInputSchema>;

export const UpdateChatChannelInputSchema = z.object({
  projectId: projectIdSchema,
  channelId: channelIdSchema,
  channelName: z.string().min(1).max(100).optional(),
  description: z.string().max(500).optional(),
  requiredRoles: z.array(z.string()).optional(),
  allowedUserIds: z.array(z.string()).optional(),
}).strict();
export type UpdateChatChannelInput = z.infer<typeof UpdateChatChannelInputSchema>;
