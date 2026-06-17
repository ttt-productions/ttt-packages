import { z } from 'zod';
import {
  workProjectIdSchema,
  guildChatChannelIdSchema,
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
  requiredGuildStandings: z.array(z.string().min(1).max(64)).max(20),
  allowedUserIds: z.array(z.string().min(1).max(128)).max(500),
}).strict();
export type CreateGuildChatChannelInput = z.infer<typeof CreateGuildChatChannelInputSchema>;

// Guild channels + invite threads moved to the realtime chat (Cloudflare DOs), which
// sends through the DO client — NOT this callable. The Firestore send path is retained
// PERMANENTLY for admin-support threads only (docs/design/chat-realtime-system.md).
export const SendGuildChatMessageInputSchema = z.object({
  threadKind: z.literal('adminSupport'),
  adminDispatchId: adminDispatchIdSchema,
  isUserReply: z.boolean(),
  text: z.string().max(MAX_CHAT_MESSAGE_LENGTH),
  replyTo: ReplyToSchema.optional(),
  attachment: ChatAttachmentSchema.optional(),
}).strict();
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
  requiredGuildStandings: z.array(z.string().min(1).max(64)).max(20).optional(),
  allowedUserIds: z.array(z.string().min(1).max(128)).max(500).optional(),
}).strict();
export type UpdateGuildChatChannelInput = z.infer<typeof UpdateGuildChatChannelInputSchema>;



