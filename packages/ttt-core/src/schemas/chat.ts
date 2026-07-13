import { z } from 'zod';
import {
  workProjectIdSchema,
  guildChatChannelIdSchema,
  guildInviteIdSchema,
  adminDispatchIdSchema,
} from './atoms.js';
import {
  MAX_CHAT_MESSAGE_LENGTH,
  MAX_GUILD_CHAT_CHANNEL_NAME_LENGTH,
  MAX_GUILD_CHAT_CHANNEL_DESCRIPTION_LENGTH,
} from '../constants/chat.js';
import {
  MAX_ADMIN_DISPATCH_SUBJECT_LENGTH,
  MAX_ADMIN_DISPATCH_INITIAL_TEXT_LENGTH,
} from '../constants/business.js';
import {
  ReplyToSchema,
} from '@ttt-productions/chat-schemas';
import { AdminDispatchContextRefSchema } from '../doc-schemas/messaging.js';

export const ArchiveGuildChatChannelInputSchema = z.object({
  workProjectId: workProjectIdSchema,
  guildChatChannelId: guildChatChannelIdSchema,
}).strict();
export type ArchiveGuildChatChannelInput = z.infer<typeof ArchiveGuildChatChannelInputSchema>;

// Tombstone (delete) a guild chat channel — same input shape as archive. The callable marks the
// channel `isDeleted`, bumps configVersion, revokes grants, and re-projects members to `removed`;
// storage is retained (never a physical purge). See docs/design/chat-realtime-system.md.
export const DeleteGuildChatChannelInputSchema = z.object({
  workProjectId: workProjectIdSchema,
  guildChatChannelId: guildChatChannelIdSchema,
}).strict();
export type DeleteGuildChatChannelInput = z.infer<typeof DeleteGuildChatChannelInputSchema>;

export const CreateGuildChatChannelInputSchema = z.object({
  workProjectId: workProjectIdSchema,
  channelName: z.string().min(1).max(MAX_GUILD_CHAT_CHANNEL_NAME_LENGTH),
  description: z.string().max(MAX_GUILD_CHAT_CHANNEL_DESCRIPTION_LENGTH).optional(),
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
}).strict();
export type SendGuildChatMessageInput = z.infer<typeof SendGuildChatMessageInputSchema>;

// Subject/initial-text share the admin-dispatch caps (the "contact admin" composer
// enforces them) — the old MAX_CHAT_MESSAGE_LENGTH bound let a 4000-char SUBJECT through.
export const StartAdminSupportThreadInputSchema = z.object({
  subject: z.string().min(1).max(MAX_ADMIN_DISPATCH_SUBJECT_LENGTH),
  initialMessage: z.string().min(1).max(MAX_ADMIN_DISPATCH_INITIAL_TEXT_LENGTH),
}).strict();
export type StartAdminSupportThreadInput = z.infer<typeof StartAdminSupportThreadInputSchema>;

// Member-initiated workProject → admin correspondence thread (party-generic dispatch,
// partyKind 'workProject'). Initiating is a Work ACTION (`adminDispatch.start`, Rule 23);
// the callable enforces the one-open-work-initiated-thread spam guard. `contextRef` is
// server-validated against the workProject before it is stored.
export const StartWorkProjectAdminSupportThreadInputSchema = z.object({
  workProjectId: workProjectIdSchema,
  subject: z.string().min(1).max(MAX_ADMIN_DISPATCH_SUBJECT_LENGTH),
  initialMessage: z.string().min(1).max(MAX_ADMIN_DISPATCH_INITIAL_TEXT_LENGTH),
  contextRef: AdminDispatchContextRefSchema.optional(),
}).strict();
export type StartWorkProjectAdminSupportThreadInput = z.infer<typeof StartWorkProjectAdminSupportThreadInputSchema>;

// Admin-initiated dispatch to a workProject party (mirrors the admin→user dispatch:
// lands unread for the work's active guildmates, creates NO admin task, uncapped).
export const CreateAdminDispatchToWorkProjectInputSchema = z.object({
  workProjectId: workProjectIdSchema,
  subject: z.string().trim().min(1).max(MAX_ADMIN_DISPATCH_SUBJECT_LENGTH),
  message: z.string().trim().min(1).max(MAX_ADMIN_DISPATCH_INITIAL_TEXT_LENGTH),
  contextRef: AdminDispatchContextRefSchema.optional(),
}).strict();
export type CreateAdminDispatchToWorkProjectInput = z.infer<typeof CreateAdminDispatchToWorkProjectInputSchema>;

// CLIENT-CALLED wire contract for the `mintChatGrant` callable (Contract A; P3).
// Crosses the backend↔frontend boundary — the web client (and any future mobile/TV
// client) constructs this payload — so it lives here per the callable-validation
// convention, not locally in the functions repo. The REAL Firestore authorization
// check happens in the callable; this schema pins the scope shape.
export const ChatGrantInputSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('channel'), workProjectId: workProjectIdSchema, guildChatChannelId: guildChatChannelIdSchema }).strict(),
  z.object({ kind: z.literal('invite'), guildInviteId: guildInviteIdSchema }).strict(),
  z.object({ kind: z.literal('inbox') }).strict(),
]);
export type ChatGrantInput = z.infer<typeof ChatGrantInputSchema>;

export const UpdateGuildChatChannelInputSchema = z.object({
  workProjectId: workProjectIdSchema,
  guildChatChannelId: guildChatChannelIdSchema,
  channelName: z.string().min(1).max(MAX_GUILD_CHAT_CHANNEL_NAME_LENGTH).optional(),
  description: z.string().max(MAX_GUILD_CHAT_CHANNEL_DESCRIPTION_LENGTH).optional(),
  requiredGuildStandings: z.array(z.string().min(1).max(64)).max(20).optional(),
  allowedUserIds: z.array(z.string().min(1).max(128)).max(500).optional(),
}).strict();
export type UpdateGuildChatChannelInput = z.infer<typeof UpdateGuildChatChannelInputSchema>;



