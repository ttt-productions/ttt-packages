"use client";

// @ttt-productions/chat-react — chat React UI, hooks, the Firebase-client
// adapter config types, and React render types. Depends on the pure
// @ttt-productions/chat-core for contracts, parser, and grouping.
//
// Apps import chat CSS via "@ttt-productions/chat-react/styles".

// React-coupled config + render types (previously on chat-core root).
export type {
  ChatCoreConfig,
  ChatTransportMode,
  ChatRealtimeTransportConfig,
  MessageRenderer,
  MessageRendererRegistry,
} from "./types.js";

// Name-resolver context.
export type {
  ChatNameResolverProviderProps,
  UnresolvedChatName,
} from "./context/ChatNameResolverContext.js";
export {
  ChatNameResolverProvider,
  useChatNameResolver,
  useOptionalChatNameResolver,
  useSenderNameResolution,
} from "./context/ChatNameResolverContext.js";
export { SenderName } from "./ui/SenderName.js";

export type { UseChatMessagesResult } from "./hooks/useChatMessages.js";
export { useChatMessages } from "./hooks/useChatMessages.js";

// Realtime (Cloudflare Durable Object) transport — the client half of the chat
// worker wire protocol. Opt-in via `ChatCoreConfig.transport === 'realtime'`; the
// firestore transport stays the unchanged default. See docs/packages/chat-react.md.
export { createRealtimeChatClient, createInboxClient } from "./realtime/transport.js";
export { ChannelClient } from "./realtime/channel-client.js";
export { InboxClient } from "./realtime/inbox-client.js";
export { useRealtimeChatMessages } from "./realtime/useRealtimeChatMessages.js";
export { browserSocketFactory } from "./realtime/socket.js";
export {
  ChatAccessDeniedError,
  isChatAccessDeniedError,
  CHAT_INITIAL_LOAD_FAILURE_BUDGET_MS,
} from "./realtime/shared.js";
export { buildFrame, parseFrame } from "./realtime/wire.js";
export { CHAT_CLIENT_DIAGNOSTIC_EVENTS } from "./realtime/diagnostics.js";
export type { RealtimeChatClient, RealtimeTransportConfig } from "./realtime/transport.js";
export type {
  ChatClientDiagnosticsOption,
  ChatClientDiagnosticsSink,
  ChatClientDiagnosticEventName,
} from "./realtime/diagnostics.js";
export type { ChannelClientState, ChannelClientConfig } from "./realtime/channel-client.js";
export type {
  InboxClientState,
  InboxClientConfig,
  ChatMarkReadOutcome,
} from "./realtime/inbox-client.js";
export type { UseRealtimeChatMessagesResult } from "./realtime/useRealtimeChatMessages.js";
export type { GrantProvider, TransportTimers, RealtimeStatus } from "./realtime/shared.js";
export type { RealtimeSocket, SocketFactory, SocketHandlers } from "./realtime/socket.js";
export type {
  WireMessageRow,
  WireInboxSnapshot,
  WireRegistryEntry,
  ServerFrame,
} from "./realtime/wire.js";

// TODO (re-export when a consumer needs them): the moderation-overlay helpers
// `RevisionKind`, `ModerationOverlay`, `applyModerationOverlay`, `overlayFromRow`,
// and `MODERATION_REDACTED_TEXT` live in `./realtime` but are intentionally NOT
// re-exported from this package root yet — the consuming app's renderer reads moderation
// state off `message.meta` (the realtime client applies the overlay internally), so
// nothing imports them from here today. Add them to the block above when a consumer
// genuinely needs to apply the overlay directly. (Comment-only; rides the next publish.)

export type { ChatShellProps, ChatLoadFailure } from "./ui/ChatShell.js";
export { ChatShell } from "./ui/ChatShell.js";
export { MessageList } from "./ui/MessageList.js";
export type { ChatScrollContainerProps } from "./ui/MessageList.js";
export type { ComposerProps } from "./ui/Composer.js";
export { Composer } from "./ui/Composer.js";
export type { MessageItemDefaultProps } from "./ui/MessageItemDefault.js";
export { MessageItemDefault } from "./ui/MessageItemDefault.js";
export { MessageActions, ThreadActions } from "./ui/menus.js";
export { MessageText, type MessageTextProps } from "./ui/MessageText.js";
