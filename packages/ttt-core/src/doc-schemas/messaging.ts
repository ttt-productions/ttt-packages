// Messaging parent-thread Firestore document SCHEMAS — guildChatChannels, the
// guildInviteConversations shell, and pendingAdminDispatches. Per-message body shapes
// live in @ttt-productions/chat-core (ChatMessageV1); ttt-core owns the thread docs.
// Types inferred via z.infer.

import { z } from 'zod';
import { InviteSourceSchema } from '../schemas/work-project-management.js';
import {
  guildInviteConversationStatusSchema,
  thresholdItemIdSchema,
  hallItemIdSchema,
  hallSubItemIdSchema,
  changeRequestIdSchema,
  userIdSchema,
} from '../schemas/atoms.js';
import { ContentMediaKindSchema } from './media-assets.js';

const userRefSchema = z.object({ uid: z.string() });

// ===========================================================================
// CONVERSATION FILES — the flat, Firestore-owned file list on a conversation.
// Replaces inline chat attachments: a file is associated WITH a conversation but
// never embedded in, sequenced with, or mutated through a chat message.
// See ttt-prod docs/design/upload-and-media-pipeline.md.
// ===========================================================================

/** Backend-owned Conversation Files counters carried by EVERY conversation parent
 *  (guildInviteConversations/{id} and pendingAdminDispatches/{id}). All four are
 *  optional — an absent field reads as 0, so no pre-existing conversation needs a
 *  backfill. Clients can never write them (rules + callable-only writes). */
const conversationFileCounterFields = {
  /** Published ACTIVE files in this conversation. */
  conversationFileCount: z.number().optional(),
  /** Published STORED-OUTPUT bytes in this conversation. */
  conversationFileBytesUsed: z.number().optional(),
  /** Active quota RESERVATIONS (uploads in flight). */
  conversationFileUploadCount: z.number().optional(),
  /** Bytes reserved by active uploads. */
  conversationFileBytesReserved: z.number().optional(),
} as const;

/**
 * `{conversationParent}/conversationFiles/{conversationFileId}` — the conversation's
 * lightweight ownership/list projection, analogous to `WorkFileSchema`.
 *
 * DELIBERATELY ABSENT (owned elsewhere, never duplicated here):
 *  - no `status` / `ready` / `publicationState` / processing progress — `pendingMedia`
 *    and `mediaAssets` own the lifecycle; the mere EXISTENCE of this doc means the
 *    asset is published;
 *  - no Firebase / R2 / gateway / signed / download URL — display URLs are built at
 *    render time through the protected media gateway;
 *  - no Firebase staging `storagePath`;
 *  - no username / display name / avatar / Work name snapshot (ARCH-103) — resolve
 *    `uploadedByUid` at render time.
 *
 * `conversationFileId` is deterministic: it IS the `pendingMediaId`. The publication
 * adapter creates this doc with `transaction.create` (never `set`), so an id
 * collision cannot overwrite and double-count an existing file.
 */
export const ConversationFileSchema = z.object({
  conversationFileId: z.string(),
  mediaAssetId: z.string(),
  name: z.string(),
  // The canonical stored content media kind — never a re-declared union (ARCH-102).
  mediaKind: ContentMediaKindSchema,
  contentType: z.string(),
  /** Sum of the PUBLISHED variant bytes (stored output, not raw upload bytes). */
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
  // Who may use the channel is decided from this list alone, by `canAccessGuildChatChannel`.
  requiredGuildStandings: z.array(z.string()),
  createdAt: z.number(),
  // NOTE: createdBy here is a flat uid string (unlike the `{ uid }` object form on
  // most other docs). Preserved as-is; flagged in the schema-registry recon.
  createdBy: z.string(),
  lastMessageAt: z.string().optional(),
  lastMessage: z.string().optional(),
  messageCount: z.number(),
  isArchived: z.boolean(),
  // Delete/tombstone marker (ttt-prod docs/design/chat-realtime-system.md "Channel lifecycle semantics").
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
  stakeSharesOffered: z.number().int().min(1),
  source: InviteSourceSchema,
  // State machine: pending → accepted (transient, trigger-consumed) → finalized (terminal
  // success), or pending → declined / cancelled (terminal failure). No 'error' state is ever
  // written (dead state removed 2026-07-03). See ttt-prod
  // docs/design/work-guild-membership-and-stake.md for the invite lifecycle.
  status: guildInviteConversationStatusSchema,
  createdAt: z.number(),
  updatedAt: z.number(),
  lastUpdatedAt: z.number(),
  finalizedAt: z.number().optional(),
  senderConfirmed: z.boolean(),
  // The account that gave the Work's agreement (the sender or any of the Work's invite handlers):
  // set with `senderConfirmed: true`, removed whenever `senderConfirmed` goes false, and carried
  // by the accept audit event.
  senderConfirmedBy: userIdSchema.optional(),
  recipientConfirmed: z.boolean(),
  // Conversation Files quota counters for THIS invite conversation (per-conversation
  // caps: MAX_CONVERSATION_FILES / MAX_CONVERSATION_FILE_STORAGE_BYTES). Reserved at
  // startUpload, transferred to used at publication, released on every terminal path,
  // decremented on delete. Backend-only-writable; absent ⇒ 0.
  ...conversationFileCounterFields,
});
export type GuildInviteConversation = z.infer<typeof GuildInviteConversationSchema>;

// The `listGuildInvites` answer: one page of a Work's invite history and the opaque cursor of
// the next page, `null` on the last. Homed beside the invite doc because this module imports
// ./schemas (`InviteSourceSchema`), so the reverse import would be a module cycle; ./schemas
// re-exports it with the callable's input.
export const ListGuildInvitesResultSchema = z.object({
  invites: z.array(GuildInviteConversationSchema),
  nextCursor: z.string().min(1).nullable(),
}).strict();
export type ListGuildInvitesResult = z.infer<typeof ListGuildInvitesResultSchema>;

// Typed context ref carried by a dispatch thread born from a review send-back, a
// moderation placeholder, or a published change request — lets the admin queue card
// say what the thread is about without parsing the subject line. Extensible union;
// server-validated against the thread's party (never trusted raw from the client).
export const AdminDispatchContextRefSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('thresholdItem'), thresholdItemId: thresholdItemIdSchema }),
  z.object({
    kind: z.literal('hallContent'),
    hallItemId: hallItemIdSchema,
    // null ⇒ the hall parent DETAIL; set ⇒ a chapter/track/episode sub-item.
    subItemId: hallSubItemIdSchema.nullable(),
  }),
  z.object({ kind: z.literal('hallContentChangeRequest'), changeRequestId: changeRequestIdSchema }),
]);
export type AdminDispatchContextRef = z.infer<typeof AdminDispatchContextRefSchema>;

export const AdminDispatchPartyKindSchema = z.enum(['user', 'workProject']);
export type AdminDispatchPartyKind = z.infer<typeof AdminDispatchPartyKindSchema>;

// Who a message on a support thread is from: the system, the admin team, or the member side (the
// thread owner, or a member of the Work on a Work thread). No writer stores it; it is derived from
// the sender and the thread's party when a message is shown.
export const ADMIN_DISPATCH_SENDER_ROLES = ['user', 'admin', 'system'] as const;
export const AdminDispatchSenderRoleSchema = z.enum(ADMIN_DISPATCH_SENDER_ROLES);
export type AdminDispatchSenderRole = z.infer<typeof AdminDispatchSenderRoleSchema>;

export const AdminDispatchSchema = z.object({
  adminDispatchId: z.string(),
  // Party-generic dispatch: the platform corresponds with a PARTY — a user or a
  // workProject. REQUIRED and written explicitly at creation: the personal-threads
  // client query filters `partyKind == 'user'` and the Firestore read rules branch
  // on it party-aware, so an absent field is unqueryable and unauthorizable. For
  // 'user' threads `userId` is the thread owner (the sole member-side authority).
  // For 'workProject' threads `workProjectId` is set, read/reply authority is
  // ACTIVE GUILDMATE standing evaluated server-side (never a stored member list),
  // and `userId` holds the INITIATING member's uid for attribution only — it is
  // never a work-thread authority.
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
  // Epoch ms of the thread's latest message — the anchor of each reader's per-person unread
  // marker (`dispatchReadMarkers`). Unlike `lastUpdatedAt`, a status change or close never moves it.
  lastMessageAt: z.number(),
  // True while the member side spoke last and no admin has replied — the admin queue's shared
  // "Awaiting reply" state. Not a read flag: nothing an admin opens clears it.
  awaitingAdminReply: z.boolean(),
  closedBy: z.string().optional(),
  // Conversation Files quota counters for THIS admin-support thread — same
  // per-conversation caps and same backend-only ownership as the invite conversation.
  ...conversationFileCounterFields,
});
export type AdminDispatch = z.infer<typeof AdminDispatchSchema>;

// Per-message body for admin-support `conversationMessages` — the ONE chat surface still
// transported through Firestore (guild channel + invite messages are realtime-only, served
// by the chat Worker Durable Object). Written by runSendGuildChatMessage (senderId/text/
// createdAt); the admin-dispatch INITIAL message
// (runStartAdminSupportThread) additionally stores `messageId`. This is the STORED shape — a relaxed
// @ttt-productions/chat-core ChatMessageV1: `messageId` is the doc id (only sometimes persisted) and
// `threadId` is not stored.
// A chat message carries NO file reference — files live in the conversation's
// `conversationFiles` subcollection (ConversationFileSchema above).
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
  isSystemMessage: z.boolean().optional(),
  meta: z.record(z.string(), z.unknown()).optional(),
  // NO moderation tombstone flag: the `hidden` field existed solely for the removed
  // admin-work-message report type's single-doc flip, and admin correspondence is not
  // reportable or moderatable at all (DJ ruling 2026-07-29). Nothing can write it, so
  // the field is gone rather than left as unreachable schema surface.
  // NO reply pointer, for the same reason: no chat surface has an authoring affordance
  // for replying to a specific message (chat-react's MessageActions renders only
  // Report/Delete; the composer's onSend takes text alone), so nothing could ever
  // populate a `replyTo` (DJ ruling 2026-07-29). This object is deliberately NOT
  // `.strict()`, so a legacy stored doc that still carries the key parses fine — the
  // value is stripped, never persisted forward, and no migration is required.
});
export type ChatMessageV1Doc = z.infer<typeof ChatMessageV1Schema>;
