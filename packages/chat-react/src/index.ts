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
  ChatAttachmentConfig,
  ChatUploadAdapter,
  ChatMentionConfig,
  MessageRenderer,
  MessageRendererRegistry,
  RenderableMentionProvider,
  MentionResultRenderer,
} from "./types.js";

// Attachment-URL resolver context (render-time URL building from mediaAssetId).
export type {
  ChatAttachmentUrlResolver,
  ChatAttachmentUrlProviderProps,
} from "./context/ChatAttachmentUrlContext.js";
export {
  ChatAttachmentUrlProvider,
  useChatAttachmentUrlResolver,
} from "./context/ChatAttachmentUrlContext.js";

// Attachment media-component injection (optional) — the app hands chat its own
// display-path wrapper (recovery adapter, diagnostics, telemetry) so chat
// media rides the same pipeline as every other surface; default stays the
// package MediaViewer.
export type {
  ChatAttachmentMediaComponent,
  ChatAttachmentMediaProviderProps,
} from "./context/ChatAttachmentMediaContext.js";
export {
  ChatAttachmentMediaProvider,
  useChatAttachmentMediaComponent,
} from "./context/ChatAttachmentMediaContext.js";

// Name-resolver context.
export type { ChatNameResolverProviderProps } from "./context/ChatNameResolverContext.js";
export {
  ChatNameResolverProvider,
  useChatNameResolver,
  useOptionalChatNameResolver,
  useResolvedSenderName,
} from "./context/ChatNameResolverContext.js";

export type { UseChatMessagesResult } from "./hooks/useChatMessages.js";
export { useChatMessages } from "./hooks/useChatMessages.js";
export { canAccessThread } from "./hooks/useChatThreadAccess.js";

// Realtime (Cloudflare Durable Object) transport — the client half of the chat
// worker wire protocol. Opt-in via `ChatCoreConfig.transport === 'realtime'`; the
// firestore transport stays the unchanged default. See docs/packages/chat-react.md.
export {
  createRealtimeChatClient,
  createInboxClient,
  ChannelClient,
  InboxClient,
  useRealtimeChatMessages,
  browserSocketFactory,
  CHAT_SUBPROTOCOL,
  CHAT_CLOSE_CODES,
  CLIENT_FRAME,
  SERVER_FRAME,
  buildFrame,
  parseFrame,
} from "./realtime/index.js";
export type {
  RealtimeChatClient,
  RealtimeTransportConfig,
  ChannelClientState,
  ChannelClientConfig,
  InboxClientState,
  InboxClientConfig,
  UseRealtimeChatMessagesResult,
  GrantProvider,
  TransportTimers,
  RealtimeStatus,
  RealtimeSocket,
  SocketFactory,
  SocketHandlers,
  ChannelRefTuple,
  WireMessageRow,
  WireInboxSnapshot,
  WireRegistryEntry,
  ServerFrame,
} from "./realtime/index.js";

// TODO (re-export when a consumer needs them): the moderation-overlay helpers
// `RevisionKind`, `ModerationOverlay`, `applyModerationOverlay`, `overlayFromRow`,
// and `MODERATION_REDACTED_TEXT` live in `./realtime` but are intentionally NOT
// re-exported from this package root yet — the consuming app's renderer reads moderation
// state off `message.meta` (the realtime client applies the overlay internally), so
// nothing imports them from here today. Add them to the block above when a consumer
// genuinely needs to apply the overlay directly. (Comment-only; rides the next publish.)

export type { ChatShellProps } from "./ui/ChatShell.js";
export { ChatShell } from "./ui/ChatShell.js";
export { MessageList } from "./ui/MessageList.js";
export type { ComposerProps } from "./ui/Composer.js";
export { Composer } from "./ui/Composer.js";
export type { MessageItemDefaultProps } from "./ui/MessageItemDefault.js";
export { MessageItemDefault } from "./ui/MessageItemDefault.js";
export { MessageActions, ThreadActions } from "./ui/menus.js";
export { MessageText, type MessageTextProps } from "./mentions/MessageText.js";
export {
  MentionAutocomplete,
  type MentionAutocompleteProps,
} from "./mentions/MentionAutocomplete.js";
export {
  useMentionAutocomplete,
  type UseMentionAutocompleteArgs,
  type UseMentionAutocompleteResult,
  type AutocompleteState,
  type AutocompleteResultGroup,
} from "./mentions/use-mention-autocomplete.js";
