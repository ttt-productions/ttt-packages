// Messaging types: chat channels, invite conversations, admin dispatches.
//
// NOTE: Per-message body shapes (channel messages, invite messages,
// admin conversation messages) live in @ttt-productions/chat-core as
// ChatMessageV1. ttt-core only owns the parent thread document shapes.

// Parent-thread shapes are defined as Zod schemas in ../doc-schemas/messaging.ts.
export type {
  GuildChatChannel,
  GuildInviteConversation,
  AdminDispatch,
  AdminDispatchPartyKind,
  AdminDispatchContextRef,
} from '../doc-schemas/messaging.js';
