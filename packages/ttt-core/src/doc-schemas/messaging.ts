// Messaging parent-thread Firestore document SCHEMAS — guildChatChannels, the
// guildInviteConversations shell, and pendingAdminDispatches. Per-message body shapes
// live in @ttt-productions/chat-core (ChatMessageV1); ttt-core owns the thread docs.
// Types inferred via z.infer.

import { z } from 'zod';
import { ReplyToSchema, ChatAttachmentSchema } from '@ttt-productions/chat-schemas';
import { InviteSourceSchema } from '../schemas/work-project-management.js';
import { guildInviteConversationStatusSchema } from '../schemas/atoms.js';

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
  // Delete/tombstone marker (docs/design/chat-realtime-system.md "Channel lifecycle semantics").
  // Independent of `isArchived`: archive = visible-under-a-toggle, delete = gone from every user's
  // UI with grants revoked and sends rejected DO-side; storage is RETAINED (never a physical purge).
  // Optional, absent ⇒ false, so existing/seeded channels need no backfill. Backend-only-writable.
  isDeleted: z.boolean().optional(),
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
  // Title/description are NOT snapshotted (Display Identity Invariant — resolve at render
  // from publicWorkProjects by id). `type` (Tales/Tunes/Television) is an immutable
  // classification, not display text, and IS consumed by an invites-list type filter
  // (guild-invites-section.tsx), so it stays. Triggers read only `workProjectId`.
  workProject: z.object({
    workProjectId: z.string(),
    type: z.string(),
  }),
  createdBy: userRefSchema,
  sender: userRefSchema,
  recipient: userRefSchema,
  stakeSharesOffered: z.number(),
  source: InviteSourceSchema,
  // State machine: pending → accepted (transient, trigger-consumed) → finalized (terminal
  // success), or pending → declined / cancelled (terminal failure). No 'error' state is ever
  // written (dead state removed 2026-07-03; see CODE_CHANGE_list_invites_missing_finalized).
  status: guildInviteConversationStatusSchema,
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

// Typed context ref carried by a dispatch thread born from a review send-back, a
// moderation placeholder, or a published change request — lets the admin queue card
// say what the thread is about without parsing the subject line. Extensible union;
// server-validated against the thread's party (never trusted raw from the client).
export const AdminDispatchContextRefSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('thresholdItem'), thresholdItemId: z.string() }),
  z.object({
    kind: z.literal('hallContent'),
    hallItemId: z.string(),
    // null ⇒ the hall parent DETAIL; set ⇒ a chapter/track/episode sub-item.
    subItemId: z.string().nullable(),
  }),
  z.object({ kind: z.literal('hallContentChangeRequest'), changeRequestId: z.string() }),
]);
export type AdminDispatchContextRef = z.infer<typeof AdminDispatchContextRefSchema>;

export const AdminDispatchPartyKindSchema = z.enum(['user', 'workProject']);
export type AdminDispatchPartyKind = z.infer<typeof AdminDispatchPartyKindSchema>;

export const AdminDispatchSchema = z.object({
  adminDispatchId: z.string(),
  // Party-generic dispatch: the platform corresponds with a PARTY — a user or a
  // workProject. Absent ⇒ 'user' (every pre-generalization thread). For 'user'
  // threads `userId` is the thread owner (the sole member-side authority). For
  // 'workProject' threads `workProjectId` is set, read/reply authority is ACTIVE
  // GUILDMATE standing evaluated server-side (never a stored member list), and
  // `userId` holds the INITIATING member's uid for attribution only — it is never
  // a work-thread authority.
  partyKind: AdminDispatchPartyKindSchema.optional(),
  workProjectId: z.string().optional(),
  contextRef: AdminDispatchContextRefSchema.optional(),
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
  // Moderation tombstone flag — the single-doc `hidden` flip written by the admin
  // moderateReportedContent pipeline (the admin-work-message itemType). Backend-only
  // writable (conversationMessages is callable-only in rules); absent ⇒ visible.
  // Thread views render a hidden message as a moderation tombstone.
  hidden: z.boolean().optional(),
});
export type ChatMessageV1Doc = z.infer<typeof ChatMessageV1Schema>;
