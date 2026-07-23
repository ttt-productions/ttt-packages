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
  MAX_CHAT_MODERATION_REASON_LENGTH,
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

// Subject/initial-text share the admin-dispatch caps (the "contact admin" composer
// enforces them) — the old MAX_CHAT_MESSAGE_LENGTH bound let a 4000-char SUBJECT through.
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

// --- Admin chat moderation callables (review-only; chat-realtime-system.md) ---

// The CLIENT-facing channel-ref for the admin chat-moderation callables
// (`adminModerateChatMessage` / `adminReadChannelContext`). This is the WIRE shape, which
// is `kind`-discriminated — NOT the internal `scope`-keyed `ChannelRefTupleSchema`
// (@ttt-productions/chat-schemas), which the callables map to server-side AFTER parsing.
// Mirrors the existing `TombstoneChatSchema.channel` union in schemas/admin.ts.
export const AdminChatModerationChannelSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('channel'), workProjectId: workProjectIdSchema, guildChatChannelId: guildChatChannelIdSchema }).strict(),
  z.object({ kind: z.literal('invite'), guildInviteId: guildInviteIdSchema }).strict(),
]);
export type AdminChatModerationChannel = z.infer<typeof AdminChatModerationChannelSchema>;

// `adminModerateChatMessage` — queue a DO-owned hide/delete command. The moderated message's
// attachment asset id(s) are NEVER client-supplied (the drain derives them server-side), so
// `.strict()` rejects any such field.
export const AdminModerateChatMessageInputSchema = z.object({
  requestId: z.string().min(1).max(200),
  action: z.enum(['hide', 'delete']),
  messageSeq: z.number().int().nonnegative(),
  expectedMessageRevision: z.number().int().nonnegative(),
  caseId: z.string().min(1).max(200),
  reason: z.string().min(1).max(MAX_CHAT_MODERATION_REASON_LENGTH),
  channel: AdminChatModerationChannelSchema,
}).strict();
export type AdminModerateChatMessageInput = z.infer<typeof AdminModerateChatMessageInputSchema>;

// `adminReadChannelContext` — case-bound admin read of a bounded (≤50 before / ≤50 after)
// message window around a reported message. Requires a case id + reason; both request and
// outcome are audited.
export const AdminReadChannelContextInputSchema = z.object({
  reportedSeq: z.number().int().nonnegative(),
  caseId: z.string().min(1).max(200),
  reason: z.string().min(1).max(MAX_CHAT_MODERATION_REASON_LENGTH),
  before: z.number().int().min(0).max(50).optional(),
  after: z.number().int().min(0).max(50).optional(),
  channel: AdminChatModerationChannelSchema,
}).strict();
export type AdminReadChannelContextInput = z.infer<typeof AdminReadChannelContextInputSchema>;



