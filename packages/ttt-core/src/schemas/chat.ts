import { z } from 'zod';
import { CHAT_MESSAGE_TEXT_MAX_LENGTH, ChatMessageRevisionKindSchema } from '@ttt-productions/chat-schemas';
import type { GuildChatConversation } from '../ids/guild-chat-conversation.js';
import {
  workProjectIdSchema,
  userIdSchema,
  guildChatChannelIdSchema,
  guildInviteIdSchema,
  adminDispatchIdSchema,
  documentIdSegmentSchema,
  reportGroupIdSchema,
} from './atoms.js';
import {
  MAX_GUILD_CHAT_CHANNEL_NAME_LENGTH,
  MAX_GUILD_CHAT_CHANNEL_DESCRIPTION_LENGTH,
} from '../constants/chat.js';
import {
  MAX_ADMIN_DISPATCH_SUBJECT_LENGTH,
  MAX_ADMIN_DISPATCH_INITIAL_TEXT_LENGTH,
  MAX_CHAT_MODERATION_REASON_LENGTH,
} from '../constants/business.js';
import { AdminDispatchContextRefSchema } from '../doc-schemas/messaging.js';

/**
 * The wire shape of a TTT realtime conversation (`GuildChatConversation`): a Work's guild chat
 * channel or a guild invite's conversation, each by its own ids. Every input that names a
 * conversation — the grant request, the admin moderation and context reads, the staged chat
 * tombstone — takes this one schema.
 */
const GuildChatChannelConversationSchema = z.object({
  kind: z.literal('channel'),
  workProjectId: workProjectIdSchema,
  guildChatChannelId: guildChatChannelIdSchema,
}).strict();
const GuildInviteConversationRefSchema = z.object({
  kind: z.literal('invite'),
  guildInviteId: guildInviteIdSchema,
}).strict();
export const GuildChatConversationSchema = z.discriminatedUnion('kind', [
  GuildChatChannelConversationSchema,
  GuildInviteConversationRefSchema,
]) satisfies z.ZodType<GuildChatConversation>;

export const ArchiveGuildChatChannelInputSchema = z.object({
  workProjectId: workProjectIdSchema,
  guildChatChannelId: guildChatChannelIdSchema,
}).strict();
export type ArchiveGuildChatChannelInput = z.infer<typeof ArchiveGuildChatChannelInputSchema>;

// Restore an archived guild chat channel — same input shape as archive. The callable clears
// `isArchived` and bumps configVersion; it is the inverse of archive, never a path to a deleted
// (tombstoned) channel. Declared as its OWN named schema per the delete precedent below: one
// named schema per callable, so a lane's input can diverge without touching its siblings.
export const UnarchiveGuildChatChannelInputSchema = z.object({
  workProjectId: workProjectIdSchema,
  guildChatChannelId: guildChatChannelIdSchema,
}).strict();
export type UnarchiveGuildChatChannelInput = z.infer<typeof UnarchiveGuildChatChannelInputSchema>;

// Tombstone (delete) a guild chat channel — same input shape as archive. The callable marks the
// channel `isDeleted`, bumps configVersion, revokes grants, and re-projects members to `removed`;
// storage is retained (never a physical purge). See ttt-prod docs/design/chat-realtime-system.md.
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
}).strict();
export type CreateGuildChatChannelInput = z.infer<typeof CreateGuildChatChannelInputSchema>;

/**
 * Whether the chat Worker already enforces a channel change when its callable answers:
 * `applied` — the change reached the channel's room before the answer; `pending` — it is
 * committed and queued, and the room applies it within the sync retry window. Never a failure:
 * the change itself is saved either way.
 */
export const GUILD_CHAT_CHANNEL_ENFORCEMENT_STATES = ['applied', 'pending'] as const;
export const GuildChatChannelEnforcementSchema = z.enum(GUILD_CHAT_CHANNEL_ENFORCEMENT_STATES);
export type GuildChatChannelEnforcement = z.infer<typeof GuildChatChannelEnforcementSchema>;

// ONE wire result contract for ALL FIVE channel-lifecycle callables (create / archive /
// unarchive / update / delete): each answers with the id of the channel it acted on and
// whether the chat Worker already enforces the change.
// One named shape, not five aliases — the lanes deliberately share a result contract, and a
// future divergence should be a visible schema split, not a silent drift between app-local
// copies (the frontend once typed unarchive's result as `{ channelId }` against a backend
// returning `guildChatChannelId`; both compiled). Non-strict (server → client result posture).
export const GuildChatChannelLifecycleResultSchema = z.object({
  success: z.literal(true),
  guildChatChannelId: guildChatChannelIdSchema,
  enforcement: GuildChatChannelEnforcementSchema,
});
export type GuildChatChannelLifecycleResult = z.infer<typeof GuildChatChannelLifecycleResultSchema>;

// Guild channels + invite threads moved to the realtime chat (Cloudflare DOs), which
// sends through the DO client — NOT this callable. The Firestore send path is retained
// PERMANENTLY for admin-support threads only (ttt-prod docs/design/chat-realtime-system.md).
export const SendGuildChatMessageInputSchema = z.object({
  threadKind: z.literal('adminSupport'),
  adminDispatchId: adminDispatchIdSchema,
  isUserReply: z.boolean(),
  text: z.string().max(CHAT_MESSAGE_TEXT_MAX_LENGTH),
  // No reply pointer: chat has no reply-authoring affordance, so a client could never
  // legitimately send one. `.strict()` therefore REJECTS a client-sent `replyTo`
  // (DJ ruling 2026-07-29).
}).strict();
export type SendGuildChatMessageInput = z.infer<typeof SendGuildChatMessageInputSchema>;

// Wire result contract for the sendGuildChatMessage callable — what the CLIENT relies on.
// The backend core's internal result type extends this with composition-only
// inline-materialize fields (backend↔backend contract; see runSendGuildChatMessage) —
// those extra fields may appear on the wire and are not part of the client contract,
// so this schema is deliberately non-strict.
export const SendGuildChatMessageResultSchema = z.object({
  success: z.literal(true),
  messageId: z.string().min(1),
  messageDocPath: z.string().min(1),
});
export type SendGuildChatMessageResult = z.infer<typeof SendGuildChatMessageResultSchema>;

// Subject/initial-text share the admin-dispatch caps (the "contact admin" composer enforces them).
export const StartAdminSupportThreadInputSchema = z.object({
  subject: z.string().min(1).max(MAX_ADMIN_DISPATCH_SUBJECT_LENGTH),
  initialMessage: z.string().min(1).max(MAX_ADMIN_DISPATCH_INITIAL_TEXT_LENGTH),
}).strict();
export type StartAdminSupportThreadInput = z.infer<typeof StartAdminSupportThreadInputSchema>;

// Authoritative result of startAdminSupportThread — both ids are minted inside the
// creating transaction. Non-strict (server → client result posture).
export const StartAdminSupportThreadResultSchema = z.object({
  success: z.literal(true),
  adminDispatchId: z.string().min(1),
  /** Doc id of the initial conversation message. */
  messageId: z.string().min(1),
});
export type StartAdminSupportThreadResult = z.infer<typeof StartAdminSupportThreadResultSchema>;

// Member-initiated workProject → admin correspondence thread (party-generic dispatch,
// partyKind 'workProject'). Initiating is a Work ACTION (`adminDispatch.start`, BACKEND-006);
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

// Admin-initiated dispatch to a USER party (partyKind 'user' — the thread owner is the target
// `userId`). Sibling of the workProject dispatch above and the same admin-initiated contract:
// lands unread in the target user's Messages tray, creates NO admin task. No `contextRef` —
// that field is validated against a workProject, which a user-party thread has none of.
export const CreateAdminDispatchToUserInputSchema = z.object({
  userId: userIdSchema,
  subject: z.string().trim().min(1).max(MAX_ADMIN_DISPATCH_SUBJECT_LENGTH),
  message: z.string().trim().min(1).max(MAX_ADMIN_DISPATCH_INITIAL_TEXT_LENGTH),
}).strict();
export type CreateAdminDispatchToUserInput = z.infer<typeof CreateAdminDispatchToUserInputSchema>;

// CLIENT-CALLED wire contract for the `mintChatGrant` callable (Contract A; P3).
// Crosses the backend↔frontend boundary — the web client (and any future mobile/TV
// client) constructs this payload — so it lives here per the callable-validation
// convention, not locally in the functions repo. The REAL Firestore authorization
// check happens in the callable; this schema pins the scope shape.
export const ChatGrantInputSchema = z.discriminatedUnion('kind', [
  GuildChatChannelConversationSchema,
  GuildInviteConversationRefSchema,
  z.object({ kind: z.literal('inbox') }).strict(),
]);
export type ChatGrantInput = z.infer<typeof ChatGrantInputSchema>;

export const UpdateGuildChatChannelInputSchema = z.object({
  workProjectId: workProjectIdSchema,
  guildChatChannelId: guildChatChannelIdSchema,
  channelName: z.string().min(1).max(MAX_GUILD_CHAT_CHANNEL_NAME_LENGTH).optional(),
  description: z.string().max(MAX_GUILD_CHAT_CHANNEL_DESCRIPTION_LENGTH).optional(),
  requiredGuildStandings: z.array(z.string().min(1).max(64)).max(20).optional(),
}).strict();
export type UpdateGuildChatChannelInput = z.infer<typeof UpdateGuildChatChannelInputSchema>;

// --- Admin chat moderation callables (review-only; ttt-prod docs/design/chat-realtime-system.md) ---

// `adminModerateChatMessage` — queue a DO-owned hide/delete command. A chat message carries
// no media (files live in the conversation's Conversation Files list), so this is a text-only
// hide/delete; `.strict()` rejects any asset-id field.
export const AdminModerateChatMessageInputSchema = z.object({
  requestId: documentIdSegmentSchema.max(200),
  action: z.enum(['hide', 'delete']),
  messageSeq: z.number().int().nonnegative(),
  expectedMessageRevision: z.number().int().nonnegative(),
  caseId: reportGroupIdSchema.max(200),
  reason: z.string().min(1).max(MAX_CHAT_MODERATION_REASON_LENGTH),
  channel: GuildChatConversationSchema,
}).strict();
export type AdminModerateChatMessageInput = z.infer<typeof AdminModerateChatMessageInputSchema>;

// `adminReadChannelContext` — case-bound admin read of a bounded (≤50 before / ≤50 after)
// message window around a reported message. Requires a case id + reason; both request and
// outcome are audited.
export const AdminReadChannelContextInputSchema = z.object({
  reportedSeq: z.number().int().nonnegative(),
  caseId: reportGroupIdSchema.max(200),
  reason: z.string().min(1).max(MAX_CHAT_MODERATION_REASON_LENGTH),
  before: z.number().int().min(0).max(50).optional(),
  after: z.number().int().min(0).max(50).optional(),
  channel: GuildChatConversationSchema,
}).strict();
export type AdminReadChannelContextInput = z.infer<typeof AdminReadChannelContextInputSchema>;

/** One message of the context window, as the conversation's room holds it now. */
export const ChatContextMessageSchema = z.object({
  seq: z.number().int().nonnegative(),
  senderUid: z.string(),
  text: z.string(),
  createdAt: z.number(),
  /** The message's moderation overlay, or null when none applies. */
  moderationKind: ChatMessageRevisionKindSchema.nullable(),
  /** The message's current revision (0 if never moderated): a moderation action names it as
   *  `expectedMessageRevision`, so it cannot apply to a message that changed since the read. */
  moderationRevision: z.number().int().nonnegative(),
  /** The accounts a server-written line names; it renders them by their current names. */
  referencedUids: z.array(z.string().min(1)).optional(),
});
export type ChatContextMessage = z.infer<typeof ChatContextMessageSchema>;

/** The `adminReadChannelContext` answer. Non-strict (server → client result posture). */
export const AdminReadChannelContextResultSchema = z.object({
  messages: z.array(ChatContextMessageSchema),
});
export type AdminReadChannelContextResult = z.infer<typeof AdminReadChannelContextResultSchema>;

/** The `mintChatGrant` answer: the signed grant and when it expires (epoch ms) — the client
 *  refreshes before then. Non-strict (server → client result posture). */
export const MintChatGrantResultSchema = z.object({
  grant: z.string().min(1),
  expiresAt: z.number(),
});
export type MintChatGrantResult = z.infer<typeof MintChatGrantResultSchema>;



