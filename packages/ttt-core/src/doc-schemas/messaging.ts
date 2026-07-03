// Messaging parent-thread Firestore document SCHEMAS — guildChatChannels, the
// guildInviteConversations shell, and pendingAdminDispatches. Per-message body shapes
// live in @ttt-productions/chat-core (ChatMessageV1); ttt-core owns the thread docs.
// Types inferred via z.infer.

import { z } from 'zod';
import { ReplyToSchema, ChatAttachmentSchema } from '@ttt-productions/chat-schemas';
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
  // Monotonic config version for the chat-realtime sync layer (Contract B). Bumped by
  // each channel create / edit / archive / delete in the authoritative txn; the
  // `config` chatSyncEvents + channel-scoped fanout key on it. Absent ⇒ 0.
  configVersion: z.number().optional(),
});
export type GuildChatChannel = z.infer<typeof GuildChatChannelSchema>;

// The guildInviteConversations/{guildInviteId} doc as actually written by inviteUserToGuild
// (and mutated by the accept/decline/finalize/cancel callables). This is the single source of
// truth — the former duplicate `GuildInviteSchema` in ./work-project.ts was a stale, narrower
// shape that the callable bypassed with an `as unknown as` cast. The inviter is `createdBy`
// (== `sender`); there is no separate `workSteward`/`workProjectTitle` field (the title lives in
// `workProject.workingTitle`).
export const GuildInviteConversationSchema = z.object({
  guildInviteId: z.string(),
  workProjectId: z.string(),
  relatedUserIds: z.array(z.string()),
  workProject: z.object({
    workProjectId: z.string(),
    workingTitle: z.string(),
    type: z.string(),
    workingDescription: z.string(),
  }),
  createdBy: userRefSchema,
  sender: userRefSchema,
  recipient: userRefSchema,
  stakeSharesOffered: z.number(),
  source: InviteSourceSchema,
  // State machine: pending → accepted (transient, trigger-consumed) → finalized (terminal
  // success), or pending → declined / cancelled (terminal failure). No 'error' state is ever
  // written (dead state removed 2026-07-03; see CODE_CHANGE_list_invites_missing_finalized).
  status: z.enum(['pending', 'accepted', 'declined', 'cancelled', 'finalized']),
  createdAt: z.number(),
  updatedAt: z.number(),
  lastUpdatedAt: z.number(),
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

// Per-message body for admin-support `conversationMessages` — the ONE chat surface still
// transported through Firestore (guild channel + invite messages are realtime-only, served
// by the chat Worker Durable Object). Written by runSendGuildChatMessage (senderId/text/
// createdAt + optional replyTo/attachment); the admin-dispatch INITIAL message
// (runStartAdminSupportThread) additionally stores `messageId`. This is the STORED shape — a relaxed
// @ttt-productions/chat-core ChatMessageV1: `messageId` is the doc id (only sometimes persisted) and
// `threadId` is not stored. Reuses the chat-schemas Zod shapes for attachment + replyTo.
export const ChatMessageV1Schema = z.object({
  senderId: z.string(),
  text: z.string(),
  createdAt: z.number(),
  messageId: z.string().optional(),
  threadId: z.string().optional(),
  type: z.string().optional(),
  // Rides on the realtime invite-thread envelope (chat Worker invite Durable Object);
  // guild-invite messages are realtime-only — there is no Firestore inviteMessages
  // subcollection. Optional so the same body schema still fits the guildChat /
  // admin-dispatch messages that don't carry it.
  guildInviteId: z.string().optional(),
  attachment: ChatAttachmentSchema.optional(),
  replyTo: ReplyToSchema.optional(),
  isSystemMessage: z.boolean().optional(),
  meta: z.record(z.string(), z.unknown()).optional(),
});
export type ChatMessageV1Doc = z.infer<typeof ChatMessageV1Schema>;
