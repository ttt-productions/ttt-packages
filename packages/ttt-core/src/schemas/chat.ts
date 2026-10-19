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
// storage is retained (never a physical purge).
export const DeleteGuildChatChannelInputSchema = z.object({
  workProjectId: workProjectIdSchema,
  guildChatChannelId: guildChatChannelIdSchema,
}).strict();
export type DeleteGuildChatChannelInput = z.infer<typeof DeleteGuildChatChannelInputSchema>;

export const CreateGuildChatChannelInputSchema = z.object({
  workProjectId: workProjectIdSchema,
  channelName: textFieldSchema(GUILD_CHAT_CHANNEL_NAME_INPUT),
  description: textFieldSchema(GUILD_CHAT_CHANNEL_DESCRIPTION_INPUT).optional(),
  requiredGuildStandings: z.array(guildChatChannelRequirementSchema).max(MAX_GUILD_CHAT_CHANNEL_REQUIRED_STANDINGS),
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
// divergence must be a visible schema split, never a silent drift between app-local copies.
export const GuildChatChannelLifecycleResultSchema = z.object({
  success: z.literal(true),
  guildChatChannelId: guildChatChannelIdSchema,
  enforcement: GuildChatChannelEnforcementSchema,
});
export type GuildChatChannelLifecycleResult = z.infer<typeof GuildChatChannelLifecycleResultSchema>;

// The Firestore send path serves admin-support threads only; guild channels and invite threads
// send through the realtime chat (Cloudflare DOs). ONE input for both sides of a support thread:
// `sendGuildChatMessage` is the thread owner's reply and `adminSendGuildChatMessage` the admin's,
// so the callable — never a flag in the input — says which side is speaking.
export const SendGuildChatMessageInputSchema = z.object({
  threadKind: z.literal('adminSupport'),
  adminDispatchId: adminDispatchIdSchema,
  text: textFieldSchema(SUPPORT_THREAD_MESSAGE_INPUT),
  // No reply pointer: chat has no reply-authoring affordance, so a client could never
  // legitimately send one. `.strict()` therefore REJECTS a client-sent `replyTo`.
}).strict();
export type SendGuildChatMessageInput = z.infer<typeof SendGuildChatMessageInputSchema>;

// Wire result contract for both support-thread send callables — what the CLIENT relies on.
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
  subject: textFieldSchema(ADMIN_DISPATCH_SUBJECT_INPUT),
  initialMessage: textFieldSchema(ADMIN_DISPATCH_MESSAGE_INPUT),
}).strict();
export type StartAdminSupportThreadInput = z.infer<typeof StartAdminSupportThreadInputSchema>;

// Authoritative result of startAdminSupportThread — both ids are minted inside the
// creating transaction.
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
  subject: textFieldSchema(ADMIN_DISPATCH_SUBJECT_INPUT),
  initialMessage: textFieldSchema(ADMIN_DISPATCH_MESSAGE_INPUT),
  contextRef: AdminDispatchContextRefSchema.optional(),
}).strict();
export type StartWorkProjectAdminSupportThreadInput = z.infer<typeof StartWorkProjectAdminSupportThreadInputSchema>;

// Admin-initiated dispatch to a workProject party (mirrors the admin→user dispatch:
// lands unread for the work's active guildmates, creates NO admin task, uncapped).
export const CreateAdminDispatchToWorkProjectInputSchema = z.object({
  workProjectId: workProjectIdSchema,
  subject: textFieldSchema(ADMIN_DISPATCH_SUBJECT_INPUT),
  message: textFieldSchema(ADMIN_DISPATCH_MESSAGE_INPUT),
  contextRef: AdminDispatchContextRefSchema.optional(),
}).strict();
export type CreateAdminDispatchToWorkProjectInput = z.infer<typeof CreateAdminDispatchToWorkProjectInputSchema>;

// ONE result for both dispatch-creation callables (to a user, to a Work).
export const CreateAdminDispatchResultSchema = z.object({
  success: z.literal(true),
  adminDispatchId: adminDispatchIdSchema,
});
export type CreateAdminDispatchResult = z.infer<typeof CreateAdminDispatchResultSchema>;

// Admin-initiated dispatch to a USER party (partyKind 'user' — the thread owner is the target
// `userId`). Sibling of the workProject dispatch above and the same admin-initiated contract:
// lands unread in the target user's Messages tray, creates NO admin task. No `contextRef` —
// that field is validated against a workProject, which a user-party thread has none of.
export const CreateAdminDispatchToUserInputSchema = z.object({
  userId: userIdSchema,
  subject: textFieldSchema(ADMIN_DISPATCH_SUBJECT_INPUT),
  message: textFieldSchema(ADMIN_DISPATCH_MESSAGE_INPUT),
}).strict();
export type CreateAdminDispatchToUserInput = z.infer<typeof CreateAdminDispatchToUserInputSchema>;

// CLIENT-CALLED wire contract for the `mintChatGrant` callable. The REAL Firestore
// authorization check happens in the callable; this schema pins the scope shape.
export const ChatGrantInputSchema = z.discriminatedUnion('kind', [
  GuildChatChannelConversationSchema,
  GuildInviteConversationRefSchema,
  z.object({ kind: z.literal('inbox') }).strict(),
]);
export type ChatGrantInput = z.infer<typeof ChatGrantInputSchema>;

export const UpdateGuildChatChannelInputSchema = z.object({
  workProjectId: workProjectIdSchema,
  guildChatChannelId: guildChatChannelIdSchema,
  channelName: textFieldSchema(GUILD_CHAT_CHANNEL_NAME_INPUT).optional(),
  description: textFieldSchema(GUILD_CHAT_CHANNEL_DESCRIPTION_INPUT).optional(),
  requiredGuildStandings: z.array(guildChatChannelRequirementSchema).max(MAX_GUILD_CHAT_CHANNEL_REQUIRED_STANDINGS).optional(),
}).strict();
export type UpdateGuildChatChannelInput = z.infer<typeof UpdateGuildChatChannelInputSchema>;

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

/** The `adminReadChannelContext` answer. */
export const AdminReadChannelContextResultSchema = z.object({
  messages: z.array(ChatContextMessageSchema),
});
export type AdminReadChannelContextResult = z.infer<typeof AdminReadChannelContextResultSchema>;

/** The `mintChatGrant` answer: the signed grant and when it expires (epoch ms) — the client
 *  refreshes before then. */
export const MintChatGrantResultSchema = z.object({
  grant: z.string().min(1),
  expiresAt: z.number(),
});
export type MintChatGrantResult = z.infer<typeof MintChatGrantResultSchema>;



