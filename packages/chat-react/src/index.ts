'use client';

export type {
  ChatCoreConfig,
  ChatTransportMode,
  ChatRealtimeTransportConfig,
  MessageRenderer,
  MessageRendererRegistry,
} from './types.js';

export type {
  ChatNameResolverProviderProps,
  UnresolvedChatName,
} from './context/ChatNameResolverContext.js';
export {
  ChatNameResolverProvider,
  useChatNameResolver,
  useOptionalChatNameResolver,
  useSenderNameResolution,
} from './context/ChatNameResolverContext.js';
export { SenderName } from './ui/SenderName.js';

export type { UseChatMessagesResult } from './hooks/useChatMessages.js';
export { useChatMessages } from './hooks/useChatMessages.js';

export { createRealtimeChatClient, createInboxClient } from './realtime/transport.js';
export { ChannelClient } from './realtime/channel-client.js';
export { InboxClient } from './realtime/inbox-client.js';
export { useRealtimeChatMessages } from './realtime/useRealtimeChatMessages.js';
export { browserSocketFactory } from './realtime/socket.js';
export {
  ChatAccessDeniedError,
  isChatAccessDeniedError,
  CHAT_INITIAL_LOAD_FAILURE_BUDGET_MS,
  INBOX_GRANT_REUSE_MARGIN_MS,
} from './realtime/shared.js';
export { buildFrame, parseFrame } from './realtime/wire.js';
export { CHAT_CLIENT_DIAGNOSTIC_EVENTS } from './realtime/diagnostics.js';
export type { RealtimeChatClient, RealtimeTransportConfig } from './realtime/transport.js';
export type {
  ChatClientDiagnosticsOption,
  ChatClientDiagnosticsSink,
  ChatClientDiagnosticEventName,
} from './realtime/diagnostics.js';
export type { ChannelClientState, ChannelClientConfig } from './realtime/channel-client.js';
export type {
  InboxClientState,
  InboxClientConfig,
  ChatMarkReadOutcome,
} from './realtime/inbox-client.js';
export type { UseRealtimeChatMessagesResult } from './realtime/useRealtimeChatMessages.js';
export type {
  ExpiringGrant,
  GrantProvider,
  InboxGrantProvider,
  TransportTimers,
  RealtimeStatus,
} from './realtime/shared.js';
export type { RealtimeSocket, SocketFactory, SocketHandlers } from './realtime/socket.js';
export type {
  WireMessageRow,
  WireInboxSnapshot,
  WireRegistryEntry,
  ServerFrame,
} from './realtime/wire.js';

export type { ChatShellProps, ChatLoadFailure } from './ui/ChatShell.js';
export { ChatShell } from './ui/ChatShell.js';
export { MessageList } from './ui/MessageList.js';
export type { ChatScrollContainerProps } from './ui/MessageList.js';
export type { ComposerProps } from './ui/Composer.js';
export { Composer } from './ui/Composer.js';
export type { MessageItemDefaultProps } from './ui/MessageItemDefault.js';
export { MessageItemDefault } from './ui/MessageItemDefault.js';
export { MessageActions, ThreadActions } from './ui/menus.js';
export { MessageText, type MessageTextProps } from './ui/MessageText.js';
